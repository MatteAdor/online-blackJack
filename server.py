"""
Royal Casino Blackjack - Multiplayer LAN Server
Built with Python asyncio & aiohttp.
"""

import asyncio
import json
import logging
import os
import random
import socket
import sys
import time
import uuid

# Ensure user site-packages are loaded even if using alternate Python binaries
user_site = os.path.expanduser(r"~\AppData\Roaming\Python\Python39\site-packages")
if os.path.exists(user_site) and user_site not in sys.path:
    sys.path.insert(0, user_site)

from typing import Dict, List, Optional, Any
from aiohttp import web, WSMsgType

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("blackjack")

PORT = 8080
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))

# ----------------- Network Utilities -----------------

def get_local_ip_addresses() -> List[str]:
    """Retrieve all non-loopback IPv4 addresses on the host machine, prioritizing the active LAN interface."""
    ips = []
    primary = None
    try:
        # Detect the route actually used for outbound traffic
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        primary = s.getsockname()[0]
        s.close()
        if primary and not primary.startswith("127."):
            ips.append(primary)
    except Exception:
        pass

    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if not ip.startswith("127.") and ip not in ips:
                # Deprioritize virtual adapters like VirtualBox (192.168.56.x)
                if not ip.startswith("192.168.56."):
                    ips.append(ip)
                else:
                    # Put virtual adapters at the end
                    ips.append(ip)
    except Exception:
        pass

    if not ips:
        ips = ["127.0.0.1"]

    return ips

PRIMARY_LAN_IP = get_local_ip_addresses()[0]


# ----------------- Card & Deck Logic -----------------

SUITS = ["♠", "♥", "♦", "♣"]
SUIT_NAMES = {"♠": "spades", "♥": "hearts", "♦": "diamonds", "♣": "clubs"}
RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]

def create_deck(num_decks: int = 6) -> List[Dict[str, Any]]:
    deck = []
    for d in range(num_decks):
        for suit in SUITS:
            for rank in RANKS:
                card_id = f"{rank}_{SUIT_NAMES[suit]}_{d}_{uuid.uuid4().hex[:4]}"
                deck.append({
                    "id": card_id,
                    "rank": rank,
                    "suit": suit,
                    "suit_name": SUIT_NAMES[suit],
                })
    random.shuffle(deck)
    return deck

def calculate_hand_value(cards: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate the blackjack hand value, checking for Aces and Blackjack."""
    total = 0
    aces = 0

    for card in cards:
        rank = card["rank"]
        if rank in ["J", "Q", "K"]:
            total += 10
        elif rank == "A":
            aces += 1
            total += 11
        else:
            total += int(rank)

    # Soft hand adjustments
    while total > 21 and aces > 0:
        total -= 10
        aces -= 1

    is_blackjack = (len(cards) == 2 and total == 21)
    is_soft = (aces > 0 and total <= 21)
    is_bust = total > 21

    return {
        "total": total,
        "is_blackjack": is_blackjack,
        "is_soft": is_soft,
        "is_bust": is_bust
    }


# ----------------- Game State Classes -----------------

class Player:
    def __init__(self, ws: web.WebSocketResponse, player_id: str, name: str = "Giocatore", avatar: str = "🎩"):
        self.ws = ws
        self.id = player_id
        self.name = name
        self.avatar = avatar
        self.bankroll = 1000
        self.lobby_id: Optional[str] = None
        self.seat_index: Optional[int] = None

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "avatar": self.avatar,
            "bankroll": self.bankroll,
            "lobby_id": self.lobby_id,
            "seat_index": self.seat_index,
        }

class Hand:
    def __init__(self, bet: int = 0):
        self.cards: List[Dict[str, Any]] = []
        self.bet = bet
        self.status = "betting"  # 'betting', 'playing', 'stood', 'bust', 'blackjack', 'doubled'
        self.is_split = False
        self.insurance_bet = 0
        self.payout = 0
        self.result = ""  # 'win', 'lose', 'push', 'blackjack', 'insurance_win'

    def to_dict(self, hide_hole_card: bool = False):
        display_cards = []
        for i, card in enumerate(self.cards):
            if hide_hole_card and i == 1:
                display_cards.append({"hidden": True})
            else:
                display_cards.append(card)

        if hide_hole_card and len(self.cards) >= 2:
            calc = calculate_hand_value([self.cards[0]])
            visible_total = calc["total"]
            is_soft = calc["is_soft"]
        else:
            calc = calculate_hand_value(self.cards) if self.cards else {"total": 0, "is_soft": False, "is_bust": False, "is_blackjack": False}
            visible_total = calc["total"]
            is_soft = calc["is_soft"]

        return {
            "cards": display_cards,
            "bet": self.bet,
            "insurance_bet": self.insurance_bet,
            "status": self.status,
            "is_split": self.is_split,
            "total": visible_total,
            "is_soft": is_soft,
            "is_bust": calc.get("is_bust", False),
            "is_blackjack": calc.get("is_blackjack", False),
            "payout": self.payout,
            "result": self.result,
        }

class Seat:
    def __init__(self, index: int):
        self.index = index
        self.player: Optional[Player] = None
        self.hands: List[Hand] = [Hand()]
        self.active_hand_idx = 0
        self.is_ready = False
        self.last_bet = 0

    def reset_for_new_round(self):
        self.hands = [Hand()]
        self.active_hand_idx = 0
        self.is_ready = False

    def to_dict(self):
        return {
            "index": self.index,
            "player": self.player.to_dict() if self.player else None,
            "hands": [h.to_dict() for h in self.hands],
            "active_hand_idx": self.active_hand_idx,
            "is_ready": self.is_ready,
            "last_bet": self.last_bet,
        }

class Lobby:
    def __init__(self, lobby_id: str, name: str, host_id: str, max_seats: int = 5, min_bet: int = 10, max_bet: int = 1000, turn_timer: int = 20):
        self.id = lobby_id
        self.name = name
        self.host_id = host_id
        self.max_seats = max_seats
        self.min_bet = min_bet
        self.max_bet = max_bet
        self.turn_timer = turn_timer

        self.seats: List[Seat] = [Seat(i) for i in range(max_seats)]
        self.spectators: Dict[str, Player] = {}
        self.shoe: List[Dict[str, Any]] = create_deck(6)
        self.dealer_cards: List[Dict[str, Any]] = []
        self.dealer_status = "waiting"

        self.phase = "betting"  # 'betting', 'dealing', 'insurance', 'players_turn', 'dealer_turn', 'payout', 'round_end'
        self.active_seat_idx: Optional[int] = None
        self.timer_seconds_left: int = 0
        self.timer_task: Optional[asyncio.Task] = None
        self.game_loop_task: Optional[asyncio.Task] = None
        self.chat_history: List[Dict[str, Any]] = []

    def draw_card(self) -> Dict[str, Any]:
        if len(self.shoe) < 52:
            self.shoe = create_deck(6)
            self.add_system_chat("🃏 Mazzo rimescolato (6 mazzi).")
        return self.shoe.pop()

    def get_seated_players(self) -> List[Player]:
        return [seat.player for seat in self.seats if seat.player is not None]

    def get_active_betting_seats(self) -> List[Seat]:
        return [s for s in self.seats if s.player is not None and s.hands[0].bet >= self.min_bet]

    def add_chat(self, sender_name: str, sender_avatar: str, text: str, is_system: bool = False):
        msg = {
            "id": uuid.uuid4().hex[:8],
            "name": sender_name,
            "avatar": sender_avatar,
            "text": text,
            "is_system": is_system,
            "time": time.strftime("%H:%M:%S")
        }
        self.chat_history.append(msg)
        if len(self.chat_history) > 60:
            self.chat_history.pop(0)
        return msg

    def add_system_chat(self, text: str):
        return self.add_chat("BANCO", "🎰", text, is_system=True)

    def to_dict(self, hide_dealer_hole: bool = True):
        dealer_display_cards = []
        for i, card in enumerate(self.dealer_cards):
            if hide_dealer_hole and i == 1:
                dealer_display_cards.append({"hidden": True})
            else:
                dealer_display_cards.append(card)

        if hide_dealer_hole and len(self.dealer_cards) >= 2:
            calc = calculate_hand_value([self.dealer_cards[0]])
            dealer_total = calc["total"]
            dealer_soft = calc["is_soft"]
        else:
            calc = calculate_hand_value(self.dealer_cards) if self.dealer_cards else {"total": 0, "is_soft": False, "is_bust": False, "is_blackjack": False}
            dealer_total = calc["total"]
            dealer_soft = calc["is_soft"]

        return {
            "id": self.id,
            "name": self.name,
            "host_id": self.host_id,
            "max_seats": self.max_seats,
            "min_bet": self.min_bet,
            "max_bet": self.max_bet,
            "turn_timer": self.turn_timer,
            "phase": self.phase,
            "active_seat_idx": self.active_seat_idx,
            "timer_seconds_left": self.timer_seconds_left,
            "dealer": {
                "cards": dealer_display_cards,
                "total": dealer_total,
                "is_soft": dealer_soft,
                "is_bust": calc.get("is_bust", False),
                "is_blackjack": calc.get("is_blackjack", False),
                "status": self.dealer_status
            },
            "seats": [s.to_dict() for s in self.seats],
            "spectators_count": len(self.spectators),
            "cards_remaining": len(self.shoe),
            "chat": self.chat_history[-30:]
        }

    def summary_dict(self):
        seated_count = sum(1 for s in self.seats if s.player is not None)
        return {
            "id": self.id,
            "name": self.name,
            "seated_count": seated_count,
            "max_seats": self.max_seats,
            "spectators_count": len(self.spectators),
            "min_bet": self.min_bet,
            "max_bet": self.max_bet,
            "phase": self.phase,
        }


# ----------------- Server & Lobby Manager -----------------

class GameManager:
    def __init__(self):
        self.players: Dict[str, Player] = {}
        self.lobbies: Dict[str, Lobby] = {}

    def get_player(self, player_id: str) -> Optional[Player]:
        return self.players.get(player_id)

    def register_player(self, ws: web.WebSocketResponse, player_id: str, name: str, avatar: str) -> Player:
        if player_id in self.players:
            player = self.players[player_id]
            player.ws = ws
            player.name = name or player.name
            player.avatar = avatar or player.avatar
        else:
            player = Player(ws, player_id, name, avatar)
            self.players[player_id] = player
        return player

    def unregister_player(self, player_id: str):
        player = self.players.get(player_id)
        if not player:
            return
        if player.lobby_id and player.lobby_id in self.lobbies:
            lobby = self.lobbies[player.lobby_id]
            self.leave_lobby(player, lobby)
        del self.players[player_id]

    async def broadcast_lobbies_list(self):
        """Notify all clients in the main menu about current lobby status."""
        lobby_list = [lobby.summary_dict() for lobby in self.lobbies.values()]
        payload = json.dumps({"type": "lobbies_list", "lobbies": lobby_list})
        for p in list(self.players.values()):
            if p.lobby_id is None:
                try:
                    await p.ws.send_str(payload)
                except Exception:
                    pass

    async def broadcast_lobby_state(self, lobby: Lobby, sound_event: Optional[str] = None, event_data: Optional[Dict] = None):
        """Broadcast state to all players and spectators at this table."""
        # Hide dealer's 2nd card if round is still playing
        hide_hole = lobby.phase in ["betting", "dealing", "insurance", "players_turn"]
        data = lobby.to_dict(hide_dealer_hole=hide_hole)

        msg = {
            "type": "lobby_state",
            "state": data,
            "sound": sound_event,
            "event": event_data,
        }
        raw_msg = json.dumps(msg)

        all_recipients = []
        for seat in lobby.seats:
            if seat.player and seat.player.ws and not seat.player.ws.closed:
                all_recipients.append(seat.player.ws)
        for spec in lobby.spectators.values():
            if spec.ws and not spec.ws.closed:
                all_recipients.append(spec.ws)

        for ws in all_recipients:
            try:
                await ws.send_str(raw_msg)
            except Exception:
                pass

    def create_lobby(self, host_player: Player, name: str, max_seats: int, min_bet: int, max_bet: int, turn_timer: int) -> Lobby:
        lobby_id = f"room_{uuid.uuid4().hex[:6]}"
        lobby = Lobby(lobby_id, name, host_player.id, max_seats, min_bet, max_bet, turn_timer)
        self.lobbies[lobby_id] = lobby
        lobby.add_system_chat(f"Tavolo '{name}' creato da {host_player.name}.")
        return lobby

    def join_lobby(self, player: Player, lobby: Lobby):
        player.lobby_id = lobby.id
        lobby.spectators[player.id] = player
        lobby.add_system_chat(f"{player.name} è entrato come spettatore.")

    def leave_lobby(self, player: Player, lobby: Lobby):
        if player.seat_index is not None and player.seat_index < len(lobby.seats):
            seat = lobby.seats[player.seat_index]
            seat.player = None
            seat.reset_for_new_round()
            player.seat_index = None

        if player.id in lobby.spectators:
            del lobby.spectators[player.id]

        player.lobby_id = None
        lobby.add_system_chat(f"{player.name} ha lasciato il tavolo.")

        # If lobby is completely empty, clean it up
        if not lobby.get_seated_players() and not lobby.spectators:
            if lobby.timer_task and not lobby.timer_task.done():
                lobby.timer_task.cancel()
            if lobby.game_loop_task and not lobby.game_loop_task.done():
                lobby.game_loop_task.cancel()
            if lobby.id in self.lobbies:
                del self.lobbies[lobby.id]

    async def sit_player(self, player: Player, lobby: Lobby, seat_index: int) -> bool:
        if seat_index < 0 or seat_index >= lobby.max_seats:
            return False
        seat = lobby.seats[seat_index]
        if seat.player is not None:
            return False

        # If already sitting elsewhere in this lobby, free previous seat
        if player.seat_index is not None:
            prev_seat = lobby.seats[player.seat_index]
            prev_seat.player = None
            prev_seat.reset_for_new_round()

        # Remove from spectators
        if player.id in lobby.spectators:
            del lobby.spectators[player.id]

        seat.player = player
        player.seat_index = seat_index
        lobby.add_system_chat(f"{player.name} si è seduto al Posto {seat_index + 1}.")

        # If we are in betting phase and this is the first player, check start
        if lobby.phase == "waiting" or lobby.phase == "betting":
            if not lobby.game_loop_task or lobby.game_loop_task.done():
                lobby.game_loop_task = asyncio.create_task(self.run_lobby_game(lobby))

        await self.broadcast_lobby_state(lobby)
        await self.broadcast_lobbies_list()
        return True

    async def stand_up_player(self, player: Player, lobby: Lobby):
        if player.seat_index is None:
            return
        seat = lobby.seats[player.seat_index]
        seat.player = None
        seat.reset_for_new_round()
        player.seat_index = None
        lobby.spectators[player.id] = player
        lobby.add_system_chat(f"{player.name} si è alzato dal tavolo.")
        await self.broadcast_lobby_state(lobby)
        await self.broadcast_lobbies_list()

    # ----------------- Blackjack Game Loop -----------------

    async def run_lobby_game(self, lobby: Lobby):
        """Asynchronous game cycle coordinator for a lobby."""
        logger.info(f"Starting game cycle for lobby {lobby.id}")
        try:
            while True:
                seated = lobby.get_seated_players()
                if not seated:
                    lobby.phase = "waiting"
                    await self.broadcast_lobby_state(lobby)
                    await asyncio.sleep(2)
                    continue

                # ================= 1. BETTING PHASE =================
                lobby.phase = "betting"
                lobby.dealer_cards = []
                lobby.dealer_status = "waiting"
                lobby.active_seat_idx = None
                for s in lobby.seats:
                    s.reset_for_new_round()

                await self.broadcast_lobby_state(lobby, sound_event="chips_ready")

                # Wait for bets (countdown 15 seconds or until all seated confirm)
                bet_time = 15
                for remaining in range(bet_time, 0, -1):
                    lobby.timer_seconds_left = remaining
                    await self.broadcast_lobby_state(lobby)

                    # Check if all seated players have placed bets and marked ready
                    seated_now = lobby.get_seated_players()
                    if not seated_now:
                        break
                    all_ready = all(s.is_ready for s in lobby.seats if s.player is not None)
                    if all_ready and any(s.hands[0].bet >= lobby.min_bet for s in lobby.seats if s.player is not None):
                        break
                    await asyncio.sleep(1)

                lobby.timer_seconds_left = 0
                active_seats = lobby.get_active_betting_seats()

                if not active_seats:
                    lobby.add_system_chat("Nessuna puntata valida effettuata. Riapertura scommesse...")
                    await self.broadcast_lobby_state(lobby)
                    await asyncio.sleep(3)
                    continue

                # Deduct bets from players' bankrolls
                for s in active_seats:
                    s.player.bankroll -= s.hands[0].bet
                    s.last_bet = s.hands[0].bet
                    s.hands[0].status = "playing"

                # ================= 2. DEALING PHASE =================
                lobby.phase = "dealing"
                await self.broadcast_lobby_state(lobby, sound_event="shuffle")
                await asyncio.sleep(0.6)

                # Deal First Card to each active player
                for s in active_seats:
                    card = lobby.draw_card()
                    s.hands[0].cards.append(card)
                    await self.broadcast_lobby_state(lobby, sound_event="card_slide", event_data={"seat": s.index, "card": card})
                    await asyncio.sleep(0.4)

                # Deal First Card to Dealer (face up)
                dealer_c1 = lobby.draw_card()
                lobby.dealer_cards.append(dealer_c1)
                await self.broadcast_lobby_state(lobby, sound_event="card_slide", event_data={"seat": "dealer", "card": dealer_c1})
                await asyncio.sleep(0.4)

                # Deal Second Card to each active player
                for s in active_seats:
                    card = lobby.draw_card()
                    s.hands[0].cards.append(card)
                    # Check instant natural blackjack
                    calc = calculate_hand_value(s.hands[0].cards)
                    if calc["is_blackjack"]:
                        s.hands[0].status = "blackjack"
                    await self.broadcast_lobby_state(lobby, sound_event="card_slide", event_data={"seat": s.index, "card": card})
                    await asyncio.sleep(0.4)

                # Deal Second Card to Dealer (Hole card, face down)
                dealer_c2 = lobby.draw_card()
                lobby.dealer_cards.append(dealer_c2)
                await self.broadcast_lobby_state(lobby, sound_event="card_slide", event_data={"seat": "dealer", "hidden": True})
                await asyncio.sleep(0.6)

                # Check Dealer Ace for Insurance
                dealer_up_card = lobby.dealer_cards[0]
                if dealer_up_card["rank"] == "A":
                    lobby.phase = "insurance"
                    lobby.add_system_chat("Il Dealer mostra un Asso! Opzione Assicurazione disponibile.")
                    for ins_sec in range(7, 0, -1):
                        lobby.timer_seconds_left = ins_sec
                        await self.broadcast_lobby_state(lobby)
                        await asyncio.sleep(1)
                    lobby.timer_seconds_left = 0

                # Check if Dealer has Natural Blackjack
                dealer_calc = calculate_hand_value(lobby.dealer_cards)
                if dealer_calc["is_blackjack"]:
                    lobby.dealer_status = "blackjack"
                    lobby.phase = "dealer_turn"
                    lobby.add_system_chat("⚡ BLACKJACK DEL DEALER!")
                    await self.broadcast_lobby_state(lobby, sound_event="dealer_blackjack")
                    await asyncio.sleep(1.5)
                    # Skip player turns directly to payouts
                else:
                    # ================= 3. PLAYERS TURN =================
                    lobby.phase = "players_turn"
                    for s in active_seats:
                        # Iterate through each hand of the seat (can be multiple if split)
                        h_idx = 0
                        while h_idx < len(s.hands):
                            hand = s.hands[h_idx]
                            s.active_hand_idx = h_idx
                            lobby.active_seat_idx = s.index

                            # If natural blackjack, auto-stands
                            calc = calculate_hand_value(hand.cards)
                            if calc["is_blackjack"]:
                                hand.status = "blackjack"
                                lobby.add_system_chat(f"🌟 {s.player.name} ha fatto BLACKJACK!")
                                await self.broadcast_lobby_state(lobby, sound_event="blackjack")
                                await asyncio.sleep(1.0)
                                h_idx += 1
                                continue

                            # Otherwise, give player their turn
                            turn_time = lobby.turn_timer if lobby.turn_timer > 0 else 20
                            for remaining in range(turn_time, 0, -1):
                                lobby.timer_seconds_left = remaining
                                await self.broadcast_lobby_state(lobby)

                                if hand.status in ["stood", "bust", "doubled"]:
                                    break
                                await asyncio.sleep(1)

                            if hand.status == "playing":
                                # Timeout auto-stand
                                hand.status = "stood"
                                lobby.add_system_chat(f"Tempo scaduto per {s.player.name}. Stai automatico.")
                                await self.broadcast_lobby_state(lobby, sound_event="stand")
                                await asyncio.sleep(0.5)

                            h_idx += 1

                    lobby.active_seat_idx = None
                    lobby.timer_seconds_left = 0

                    # ================= 4. DEALER TURN =================
                    lobby.phase = "dealer_turn"
                    await self.broadcast_lobby_state(lobby, sound_event="card_flip")
                    await asyncio.sleep(0.8)

                    # Check if all player hands busted; if so, dealer doesn't need to hit
                    all_busted = all(h.status == "bust" for s in active_seats for h in s.hands)

                    if not all_busted:
                        while True:
                            d_calc = calculate_hand_value(lobby.dealer_cards)
                            # Dealer stands on all 17s
                            if d_calc["total"] >= 17:
                                break
                            await asyncio.sleep(0.9)
                            card = lobby.draw_card()
                            lobby.dealer_cards.append(card)
                            await self.broadcast_lobby_state(lobby, sound_event="card_slide", event_data={"seat": "dealer", "card": card})

                    d_final = calculate_hand_value(lobby.dealer_cards)
                    if d_final["is_bust"]:
                        lobby.dealer_status = "bust"
                        lobby.add_system_chat(f"💥 IL DEALER HA SBALLATO con {d_final['total']}!")
                        await self.broadcast_lobby_state(lobby, sound_event="bust")
                    else:
                        lobby.dealer_status = "done"
                        lobby.add_system_chat(f"Il Dealer si ferma a {d_final['total']}.")
                        await self.broadcast_lobby_state(lobby)
                    await asyncio.sleep(1.2)

                # ================= 5. PAYOUT & RESOLUTION =================
                lobby.phase = "payout"
                dealer_calc = calculate_hand_value(lobby.dealer_cards)
                d_total = dealer_calc["total"]
                d_bj = dealer_calc["is_blackjack"]
                d_bust = dealer_calc["is_bust"]

                round_winners = []

                for s in active_seats:
                    for h in s.hands:
                        h_calc = calculate_hand_value(h.cards)
                        p_total = h_calc["total"]
                        p_bj = h_calc["is_blackjack"]
                        p_bust = h_calc["is_bust"]

                        # Resolve insurance first if applicable
                        if h.insurance_bet > 0:
                            if d_bj:
                                ins_win = h.insurance_bet * 3  # pays 2:1 plus original bet
                                s.player.bankroll += ins_win
                                lobby.add_system_chat(f"Assicurazione vinta da {s.player.name} (+${ins_win})!")
                            else:
                                lobby.add_system_chat(f"Assicurazione persa da {s.player.name}.")

                        # Hand resolution
                        if p_bust:
                            h.result = "lose"
                            h.payout = 0
                        elif d_bj:
                            if p_bj:
                                h.result = "push"
                                h.payout = h.bet
                                s.player.bankroll += h.payout
                            else:
                                h.result = "lose"
                                h.payout = 0
                        elif p_bj:
                            # Blackjack pays 3:2 (return 2.5x bet)
                            win_amount = int(h.bet * 2.5)
                            h.result = "blackjack"
                            h.payout = win_amount
                            s.player.bankroll += win_amount
                            round_winners.append(f"{s.player.name} (Blackjack +${win_amount - h.bet})")
                        elif d_bust:
                            win_amount = h.bet * 2
                            h.result = "win"
                            h.payout = win_amount
                            s.player.bankroll += win_amount
                            round_winners.append(f"{s.player.name} (+${h.bet})")
                        elif p_total > d_total:
                            win_amount = h.bet * 2
                            h.result = "win"
                            h.payout = win_amount
                            s.player.bankroll += win_amount
                            round_winners.append(f"{s.player.name} (+${h.bet})")
                        elif p_total == d_total:
                            h.result = "push"
                            h.payout = h.bet
                            s.player.bankroll += h.payout
                        else:
                            h.result = "lose"
                            h.payout = 0

                if round_winners:
                    lobby.add_system_chat(f"🏆 Vincitori: {', '.join(round_winners)}")
                    await self.broadcast_lobby_state(lobby, sound_event="win_fanfare")
                else:
                    await self.broadcast_lobby_state(lobby, sound_event="chips_collect")

                # ================= 6. ROUND END PAUSE =================
                lobby.phase = "round_end"
                for countdown in range(4, 0, -1):
                    lobby.timer_seconds_left = countdown
                    await self.broadcast_lobby_state(lobby)
                    await asyncio.sleep(1)

        except asyncio.CancelledError:
            logger.info(f"Game loop cancelled for lobby {lobby.id}")
        except Exception as e:
            logger.error(f"Error in game loop for lobby {lobby.id}: {e}", exc_info=True)


# ----------------- HTTP & WebSocket Handlers -----------------

manager = GameManager()

async def index_handler(request):
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        return web.FileResponse(index_file)
    return web.Response(text="Royal Casino Blackjack - In attesa di file statici.")

async def api_info_handler(request):
    ips = get_local_ip_addresses()
    return web.json_response({
        "server_name": "Royal Casino Blackjack",
        "primary_ip": PRIMARY_LAN_IP,
        "all_ips": ips,
        "port": PORT,
        "url": f"http://{PRIMARY_LAN_IP}:{PORT}",
        "active_lobbies": len(manager.lobbies),
        "active_players": len(manager.players),
    })

async def api_qr_handler(request):
    """Generate SVG QR code for the primary LAN address."""
    try:
        import qrcode
        import qrcode.image.svg
        factory = qrcode.image.svg.SvgPathImage
        url = f"http://{PRIMARY_LAN_IP}:{PORT}"
        img = qrcode.make(url, image_factory=factory)
        svg_content = img.to_string()
        return web.Response(body=svg_content, content_type="image/svg+xml")
    except Exception as e:
        return web.Response(status=500, text=f"QR error: {e}")

async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    player_id = request.query.get("player_id", uuid.uuid4().hex[:8])
    player_name = request.query.get("name", "Ospite")
    player_avatar = request.query.get("avatar", "🎩")

    player = manager.register_player(ws, player_id, player_name, player_avatar)
    logger.info(f"Player connected: {player.name} ({player.id}) from {request.remote}")

    # Send initial welcome & lobbies
    await ws.send_str(json.dumps({
        "type": "welcome",
        "player": player.to_dict(),
        "primary_ip": PRIMARY_LAN_IP,
        "port": PORT,
        "url": f"http://{PRIMARY_LAN_IP}:{PORT}",
    }))
    await manager.broadcast_lobbies_list()

    try:
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                data = json.loads(msg.data)
                action = data.get("type")

                if action == "set_profile":
                    player.name = data.get("name", player.name).strip()[:20] or "Giocatore"
                    player.avatar = data.get("avatar", player.avatar)
                    await ws.send_str(json.dumps({"type": "profile_updated", "player": player.to_dict()}))
                    if player.lobby_id and player.lobby_id in manager.lobbies:
                        await manager.broadcast_lobby_state(manager.lobbies[player.lobby_id])

                elif action == "list_lobbies":
                    await manager.broadcast_lobbies_list()

                elif action == "create_lobby":
                    name = data.get("name", f"Tavolo di {player.name}").strip()[:30] or "Tavolo VIP"
                    max_seats = max(1, min(6, int(data.get("max_seats", 5))))
                    min_bet = max(5, int(data.get("min_bet", 10)))
                    max_bet = max(min_bet, int(data.get("max_bet", 1000)))
                    timer = max(10, min(60, int(data.get("timer", 20))))

                    lobby = manager.create_lobby(player, name, max_seats, min_bet, max_bet, timer)
                    manager.join_lobby(player, lobby)
                    await manager.sit_player(player, lobby, 0)
                    await manager.broadcast_lobbies_list()

                elif action == "join_lobby":
                    lobby_id = data.get("lobby_id")
                    if lobby_id in manager.lobbies:
                        lobby = manager.lobbies[lobby_id]
                        if player.lobby_id:
                            manager.leave_lobby(player, manager.lobbies[player.lobby_id])
                        manager.join_lobby(player, lobby)
                        await manager.broadcast_lobby_state(lobby)
                        await manager.broadcast_lobbies_list()

                elif action == "leave_lobby":
                    if player.lobby_id and player.lobby_id in manager.lobbies:
                        lobby = manager.lobbies[player.lobby_id]
                        manager.leave_lobby(player, lobby)
                        await ws.send_str(json.dumps({"type": "left_lobby"}))
                        await manager.broadcast_lobbies_list()

                elif action == "sit_down":
                    seat_idx = int(data.get("seat_index", 0))
                    if player.lobby_id and player.lobby_id in manager.lobbies:
                        lobby = manager.lobbies[player.lobby_id]
                        await manager.sit_player(player, lobby, seat_idx)

                elif action == "stand_up":
                    if player.lobby_id and player.lobby_id in manager.lobbies:
                        lobby = manager.lobbies[player.lobby_id]
                        await manager.stand_up_player(player, lobby)

                elif action == "place_bet":
                    amount = int(data.get("amount", 0))
                    if player.lobby_id and player.lobby_id in manager.lobbies:
                        lobby = manager.lobbies[player.lobby_id]
                        if lobby.phase == "betting" and player.seat_index is not None:
                            seat = lobby.seats[player.seat_index]
                            new_bet = seat.hands[0].bet + amount
                            if new_bet <= player.bankroll and new_bet <= lobby.max_bet:
                                seat.hands[0].bet = new_bet
                                await manager.broadcast_lobby_state(lobby, sound_event="chip_click")

                elif action == "clear_bet":
                    if player.lobby_id and player.lobby_id in manager.lobbies:
                        lobby = manager.lobbies[player.lobby_id]
                        if lobby.phase == "betting" and player.seat_index is not None:
                            seat = lobby.seats[player.seat_index]
                            seat.hands[0].bet = 0
                            seat.is_ready = False
                            await manager.broadcast_lobby_state(lobby, sound_event="chip_clear")

                elif action == "confirm_bet":
                    if player.lobby_id and player.lobby_id in manager.lobbies:
                        lobby = manager.lobbies[player.lobby_id]
                        if lobby.phase == "betting" and player.seat_index is not None:
                            seat = lobby.seats[player.seat_index]
                            if seat.hands[0].bet >= lobby.min_bet:
                                seat.is_ready = True
                                await manager.broadcast_lobby_state(lobby, sound_event="confirm")

                elif action == "player_action":
                    act = data.get("action")  # 'hit', 'stand', 'double', 'split', 'insurance'
                    if player.lobby_id and player.lobby_id in manager.lobbies:
                        lobby = manager.lobbies[player.lobby_id]
                        if lobby.phase == "players_turn" and player.seat_index == lobby.active_seat_idx:
                            seat = lobby.seats[player.seat_index]
                            hand = seat.hands[seat.active_hand_idx]

                            if act == "hit" and hand.status == "playing":
                                card = lobby.draw_card()
                                hand.cards.append(card)
                                calc = calculate_hand_value(hand.cards)
                                if calc["is_bust"]:
                                    hand.status = "bust"
                                    lobby.add_system_chat(f"{player.name} ha SBALLATO con {calc['total']}!")
                                    await manager.broadcast_lobby_state(lobby, sound_event="bust", event_data={"seat": seat.index, "card": card})
                                elif calc["total"] == 21:
                                    hand.status = "stood"
                                    lobby.add_system_chat(f"{player.name} ha 21!")
                                    await manager.broadcast_lobby_state(lobby, sound_event="stand", event_data={"seat": seat.index, "card": card})
                                else:
                                    await manager.broadcast_lobby_state(lobby, sound_event="card_slide", event_data={"seat": seat.index, "card": card})

                            elif act == "stand" and hand.status == "playing":
                                hand.status = "stood"
                                calc = calculate_hand_value(hand.cards)
                                lobby.add_system_chat(f"{player.name} sta con {calc['total']}.")
                                await manager.broadcast_lobby_state(lobby, sound_event="stand")

                            elif act == "double" and hand.status == "playing" and len(hand.cards) == 2:
                                if player.bankroll >= hand.bet:
                                    player.bankroll -= hand.bet
                                    hand.bet *= 2
                                    card = lobby.draw_card()
                                    hand.cards.append(card)
                                    calc = calculate_hand_value(hand.cards)
                                    hand.status = "bust" if calc["is_bust"] else "doubled"
                                    lobby.add_system_chat(f"{player.name} RADDOPPIA a ${hand.bet} (Totale: {calc['total']})!")
                                    await manager.broadcast_lobby_state(lobby, sound_event="chip_double", event_data={"seat": seat.index, "card": card})

                            elif act == "split" and hand.status == "playing" and len(hand.cards) == 2 and not hand.is_split:
                                # Check matching ranks or 10-value cards
                                c1, c2 = hand.cards[0], hand.cards[1]
                                r1_val = 10 if c1["rank"] in ["10", "J", "Q", "K"] else c1["rank"]
                                r2_val = 10 if c2["rank"] in ["10", "J", "Q", "K"] else c2["rank"]
                                if r1_val == r2_val and player.bankroll >= hand.bet:
                                    player.bankroll -= hand.bet
                                    hand.is_split = True
                                    new_hand = Hand(bet=hand.bet)
                                    new_hand.is_split = True
                                    new_hand.cards.append(hand.cards.pop())
                                    # Deal 1 extra card to both hands
                                    hand.cards.append(lobby.draw_card())
                                    new_hand.cards.append(lobby.draw_card())
                                    seat.hands.append(new_hand)
                                    lobby.add_system_chat(f"{player.name} DIVIDE la mano!")
                                    await manager.broadcast_lobby_state(lobby, sound_event="split")

                        elif lobby.phase == "insurance" and act == "insurance":
                            if player.seat_index is not None:
                                seat = lobby.seats[player.seat_index]
                                main_bet = seat.hands[0].bet
                                ins_cost = main_bet // 2
                                if ins_cost > 0 and player.bankroll >= ins_cost and seat.hands[0].insurance_bet == 0:
                                    player.bankroll -= ins_cost
                                    seat.hands[0].insurance_bet = ins_cost
                                    lobby.add_system_chat(f"{player.name} ha assicurato la puntata (${ins_cost}).")
                                    await manager.broadcast_lobby_state(lobby, sound_event="chip_click")

                elif action == "rebuy":
                    if player.bankroll < 50:
                        player.bankroll = 1000
                        await ws.send_str(json.dumps({"type": "profile_updated", "player": player.to_dict()}))
                        if player.lobby_id and player.lobby_id in manager.lobbies:
                            lobby = manager.lobbies[player.lobby_id]
                            lobby.add_system_chat(f"💵 {player.name} ha ricaricato il bankroll a $1,000!")
                            await manager.broadcast_lobby_state(lobby, sound_event="rebuy")

                elif action == "chat":
                    text = data.get("text", "").strip()[:140]
                    if text and player.lobby_id and player.lobby_id in manager.lobbies:
                        lobby = manager.lobbies[player.lobby_id]
                        msg_obj = lobby.add_chat(player.name, player.avatar, text)
                        await manager.broadcast_lobby_state(lobby, event_data={"new_chat": msg_obj})

            elif msg.type == WSMsgType.ERROR:
                logger.error(f"WS error: {ws.exception()}")
    finally:
        logger.info(f"Player disconnected: {player.name} ({player.id})")
        manager.unregister_player(player.id)
        await manager.broadcast_lobbies_list()

    return ws


# ----------------- App Factory & Server Startup -----------------

def create_app():
    app = web.Application()
    app.router.add_get("/", index_handler)
    app.router.add_get("/api/info", api_info_handler)
    app.router.add_get("/api/qr", api_qr_handler)
    app.router.add_get("/ws", websocket_handler)
    app.router.add_static("/css/", os.path.join(STATIC_DIR, "css"), name="css")
    app.router.add_static("/js/", os.path.join(STATIC_DIR, "js"), name="js")
    if os.path.exists(os.path.join(STATIC_DIR, "static")):
        app.router.add_static("/static/", os.path.join(STATIC_DIR, "static"), name="static")
    return app

if __name__ == "__main__":
    import sys
    # Ensure stdout handles utf-8 safely on Windows
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    app = create_app()
    ips = get_local_ip_addresses()
    print("=" * 65)
    print("      [+] ROYAL CASINO BLACKJACK - MULTIPLAYER LAN [+]")
    print("=" * 65)
    print(f"  Locale sul tuo PC:  http://localhost:{PORT}")
    print(f"  Per giocare in LAN (amici/telefoni):")
    for ip in ips:
        print(f"   -> http://{ip}:{PORT}")
    print("=" * 65)
    web.run_app(app, host="0.0.0.0", port=PORT)
