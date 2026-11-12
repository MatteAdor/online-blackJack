/**
 * Royal Casino Blackjack - In-Browser Client Engine (for GitHub Pages / Static Mode)
 * Replicates the full casino blackjack dealer and table logic entirely client-side.
 */

class ClientBlackjackEngine {
    constructor(app) {
        this.app = app;
        this.lobbies = {};
        this.gameTimers = {};
        this.bc = null;

        if (window.BroadcastChannel) {
            this.bc = new BroadcastChannel('rc_blackjack_mesh_sync');
            this.bc.onmessage = (e) => this.handleMeshMessage(e.data);
        }

        this.initDefaultLobby();
    }

    initDefaultLobby() {
        const defaultId = 'room_vip_main';
        this.lobbies[defaultId] = this.createNewLobbyObject(defaultId, 'Tavolo VIP Reale', 'Casino', 5, 10, 1000, 20);
    }

    createDeck(numDecks = 6) {
        const suits = ['♠', '♥', '♦', '♣'];
        const suitNames = { '♠': 'spades', '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs' };
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        const deck = [];

        for (let d = 0; d < numDecks; d++) {
            for (const s of suits) {
                for (const r of ranks) {
                    deck.push({
                        id: `${r}_${suitNames[s]}_${d}_${Math.random().toString(36).substr(2, 4)}`,
                        rank: r,
                        suit: s,
                        suit_name: suitNames[s]
                    });
                }
            }
        }
        // Shuffle (Fisher-Yates)
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    calculateHandValue(cards) {
        let total = 0;
        let aces = 0;

        for (const card of cards) {
            if (card.hidden) continue;
            const r = card.rank;
            if (['J', 'Q', 'K'].includes(r)) {
                total += 10;
            } else if (r === 'A') {
                aces += 1;
                total += 11;
            } else {
                total += parseInt(r, 10);
            }
        }

        while (total > 21 && aces > 0) {
            total -= 10;
            aces -= 1;
        }

        const isBlackjack = (cards.length === 2 && total === 21 && !cards.some(c => c.hidden));
        return {
            total,
            is_soft: (aces > 0 && total <= 21),
            is_bust: total > 21,
            is_blackjack: isBlackjack
        };
    }

    createNewLobbyObject(id, name, hostId, maxSeats = 5, minBet = 10, maxBet = 1000, timer = 20) {
        const seats = [];
        for (let i = 0; i < maxSeats; i++) {
            seats.push({
                index: i,
                player: null,
                hands: [{
                    cards: [],
                    bet: 0,
                    insurance_bet: 0,
                    status: 'betting',
                    is_split: false,
                    payout: 0,
                    result: '',
                    total: 0,
                    is_soft: false,
                    is_bust: false,
                    is_blackjack: false
                }],
                active_hand_idx: 0,
                is_ready: false,
                last_bet: 0
            });
        }

        return {
            id,
            name,
            host_id: hostId,
            max_seats: maxSeats,
            min_bet: minBet,
            max_bet: maxBet,
            turn_timer: timer,
            phase: 'betting',
            active_seat_idx: null,
            timer_seconds_left: 15,
            dealer: {
                cards: [],
                total: 0,
                is_soft: false,
                is_bust: false,
                is_blackjack: false,
                status: 'waiting'
            },
            seats,
            spectators_count: 0,
            cards_remaining: 312,
            shoe: this.createDeck(6),
            chat: [
                {
                    id: 'init_msg',
                    name: 'BANCO',
                    avatar: '🎰',
                    text: `Benvenuto al tavolo '${name}'! Scegli un posto per sederti.`,
                    is_system: true,
                    time: new Date().toLocaleTimeString().slice(0, 5)
                }
            ]
        };
    }

    drawCard(lobby) {
        if (!lobby.shoe || lobby.shoe.length < 52) {
            lobby.shoe = this.createDeck(6);
            this.addChat(lobby, 'BANCO', '🎰', '🃏 Mazzo rimescolato (6 mazzi).', true);
        }
        lobby.cards_remaining = lobby.shoe.length - 1;
        return lobby.shoe.pop();
    }

    addChat(lobby, name, avatar, text, isSystem = false) {
        const msg = {
            id: 'm_' + Math.random().toString(36).substr(2, 6),
            name,
            avatar,
            text,
            is_system: isSystem,
            time: new Date().toLocaleTimeString().slice(0, 5)
        };
        lobby.chat.push(msg);
        if (lobby.chat.length > 50) lobby.chat.shift();
        return msg;
    }

    getLobbiesSummary() {
        return Object.values(this.lobbies).map(l => ({
            id: l.id,
            name: l.name,
            seated_count: l.seats.filter(s => s.player !== null).length,
            max_seats: l.max_seats,
            spectators_count: l.spectators_count || 0,
            min_bet: l.min_bet,
            max_bet: l.max_bet,
            phase: l.phase
        }));
    }

    // Prepare state payload for client rendering (masks hole card if needed)
    getLobbyStateForClient(lobby) {
        const hideHole = ['betting', 'dealing', 'insurance', 'players_turn'].includes(lobby.phase);
        const displayDealerCards = lobby.dealer.cards.map((c, idx) => {
            if (hideHole && idx === 1) return { hidden: true };
            return c;
        });

        const dealerCalc = hideHole && lobby.dealer.cards.length >= 2
            ? this.calculateHandValue([lobby.dealer.cards[0]])
            : this.calculateHandValue(lobby.dealer.cards);

        return {
            id: lobby.id,
            name: lobby.name,
            host_id: lobby.host_id,
            max_seats: lobby.max_seats,
            min_bet: lobby.min_bet,
            max_bet: lobby.max_bet,
            turn_timer: lobby.turn_timer,
            phase: lobby.phase,
            active_seat_idx: lobby.active_seat_idx,
            timer_seconds_left: lobby.timer_seconds_left,
            cards_remaining: lobby.cards_remaining,
            dealer: {
                cards: displayDealerCards,
                total: dealerCalc.total,
                is_soft: dealerCalc.is_soft,
                is_bust: dealerCalc.is_bust,
                is_blackjack: dealerCalc.is_blackjack,
                status: lobby.dealer.status
            },
            seats: lobby.seats.map(s => ({
                index: s.index,
                player: s.player,
                hands: s.hands.map(h => {
                    const calc = this.calculateHandValue(h.cards);
                    return {
                        cards: h.cards,
                        bet: h.bet,
                        insurance_bet: h.insurance_bet,
                        status: h.status,
                        is_split: h.is_split,
                        total: calc.total,
                        is_soft: calc.is_soft,
                        is_bust: calc.is_bust,
                        is_blackjack: calc.is_blackjack,
                        payout: h.payout,
                        result: h.result
                    };
                }),
                active_hand_idx: s.active_hand_idx,
                is_ready: s.is_ready,
                last_bet: s.last_bet
            })),
            spectators_count: lobby.spectators_count || 0,
            chat: lobby.chat.slice(-30)
        };
    }

    broadcastState(lobby, soundEvent = null, eventData = null) {
        const state = this.getLobbyStateForClient(lobby);
        const msg = {
            type: 'lobby_state',
            state,
            sound: soundEvent,
            event: eventData
        };

        // Notify current client instance
        this.app.handleServerMessage(msg);

        // Notify other tabs on the same computer
        if (this.bc) {
            this.bc.postMessage(msg);
        }
    }

    broadcastLobbiesList() {
        const list = this.getLobbiesSummary();
        const msg = { type: 'lobbies_list', lobbies: list };
        this.app.handleServerMessage(msg);
        if (this.bc) this.bc.postMessage(msg);
    }

    handleMeshMessage(data) {
        if (!data || !data.type) return;
        this.app.handleServerMessage(data);
    }

    // ----------------- Action Handler -----------------
    handleAction(player, type, payload) {
        switch (type) {
            case 'list_lobbies':
                this.broadcastLobbiesList();
                break;

            case 'create_lobby': {
                const id = 'room_' + Math.random().toString(36).substr(2, 6);
                const name = payload.name || `Tavolo di ${player.name}`;
                const maxSeats = Math.max(1, Math.min(6, parseInt(payload.max_seats, 10) || 5));
                const minBet = Math.max(5, parseInt(payload.min_bet, 10) || 10);
                const maxBet = Math.max(minBet, parseInt(payload.max_bet, 10) || 1000);
                const timer = Math.max(10, Math.min(60, parseInt(payload.timer, 10) || 20));

                const lobby = this.createNewLobbyObject(id, name, player.id, maxSeats, minBet, maxBet, timer);
                this.lobbies[id] = lobby;
                this.broadcastLobbiesList();
                this.handleAction(player, 'join_lobby', { lobby_id: id });
                this.handleAction(player, 'sit_down', { seat_index: 0 });
                break;
            }

            case 'join_lobby': {
                const lid = payload.lobby_id;
                let lobby = this.lobbies[lid];
                if (!lobby) {
                    lobby = Object.values(this.lobbies)[0];
                }
                player.lobby_id = lobby.id;
                this.addChat(lobby, player.name, player.avatar, `${player.name} è entrato al tavolo.`, true);
                this.broadcastState(lobby);
                this.broadcastLobbiesList();
                break;
            }

            case 'leave_lobby': {
                if (player.lobby_id && this.lobbies[player.lobby_id]) {
                    const lobby = this.lobbies[player.lobby_id];
                    if (player.seat_index !== null && lobby.seats[player.seat_index]) {
                        const s = lobby.seats[player.seat_index];
                        s.player = null;
                        s.hands = [{ cards: [], bet: 0, status: 'betting' }];
                        player.seat_index = null;
                    }
                    this.addChat(lobby, player.name, player.avatar, `${player.name} ha lasciato il tavolo.`, true);
                    this.broadcastState(lobby);
                    this.broadcastLobbiesList();
                }
                player.lobby_id = null;
                player.seat_index = null;
                this.app.handleServerMessage({ type: 'left_lobby' });
                this.broadcastLobbiesList();
                break;
            }

            case 'sit_down': {
                if (!player.lobby_id || !this.lobbies[player.lobby_id]) return;
                const lobby = this.lobbies[player.lobby_id];
                const sIdx = parseInt(payload.seat_index, 10);
                if (sIdx >= 0 && sIdx < lobby.seats.length && !lobby.seats[sIdx].player) {
                    // Free existing seat if any
                    if (player.seat_index !== null && lobby.seats[player.seat_index]) {
                        lobby.seats[player.seat_index].player = null;
                    }
                    lobby.seats[sIdx].player = { ...player };
                    player.seat_index = sIdx;
                    this.addChat(lobby, player.name, player.avatar, `${player.name} si è seduto al Posto ${sIdx + 1}.`, true);
                    this.broadcastState(lobby);
                    this.broadcastLobbiesList();

                    // Start betting loop if not started
                    this.ensureGameLoopRunning(lobby);
                }
                break;
            }

            case 'place_bet': {
                if (!player.lobby_id || !this.lobbies[player.lobby_id]) return;
                const lobby = this.lobbies[player.lobby_id];
                if (lobby.phase !== 'betting' || player.seat_index === null) return;
                const seat = lobby.seats[player.seat_index];
                const amt = parseInt(payload.amount, 10) || 0;
                const newBet = seat.hands[0].bet + amt;
                if (newBet <= player.bankroll && newBet <= lobby.max_bet) {
                    seat.hands[0].bet = newBet;
                    this.broadcastState(lobby, 'chip_click');
                }
                break;
            }

            case 'clear_bet': {
                if (!player.lobby_id || !this.lobbies[player.lobby_id]) return;
                const lobby = this.lobbies[player.lobby_id];
                if (lobby.phase !== 'betting' || player.seat_index === null) return;
                const seat = lobby.seats[player.seat_index];
                seat.hands[0].bet = 0;
                seat.is_ready = false;
                this.broadcastState(lobby, 'chip_click');
                break;
            }

            case 'confirm_bet': {
                if (!player.lobby_id || !this.lobbies[player.lobby_id]) return;
                const lobby = this.lobbies[player.lobby_id];
                if (lobby.phase !== 'betting' || player.seat_index === null) return;
                const seat = lobby.seats[player.seat_index];
                if (seat.hands[0].bet >= lobby.min_bet) {
                    seat.is_ready = true;
                    this.broadcastState(lobby, 'confirm');
                }
                break;
            }

            case 'player_action': {
                if (!player.lobby_id || !this.lobbies[player.lobby_id]) return;
                const lobby = this.lobbies[player.lobby_id];
                const act = payload.action;

                if (lobby.phase === 'players_turn' && lobby.active_seat_idx === player.seat_index) {
                    const seat = lobby.seats[player.seat_index];
                    const hand = seat.hands[seat.active_hand_idx];

                    if (act === 'hit' && hand.status === 'playing') {
                        const card = this.drawCard(lobby);
                        hand.cards.push(card);
                        const calc = this.calculateHandValue(hand.cards);
                        if (calc.is_bust) {
                            hand.status = 'bust';
                            this.addChat(lobby, player.name, player.avatar, `${player.name} ha SBALLATO con ${calc.total}!`, true);
                            this.broadcastState(lobby, 'bust');
                        } else if (calc.total === 21) {
                            hand.status = 'stood';
                            this.addChat(lobby, player.name, player.avatar, `${player.name} ha 21!`, true);
                            this.broadcastState(lobby, 'stand');
                        } else {
                            this.broadcastState(lobby, 'card_slide');
                        }
                    } else if (act === 'stand' && hand.status === 'playing') {
                        hand.status = 'stood';
                        const calc = this.calculateHandValue(hand.cards);
                        this.addChat(lobby, player.name, player.avatar, `${player.name} sta con ${calc.total}.`, true);
                        this.broadcastState(lobby, 'stand');
                    } else if (act === 'double' && hand.status === 'playing' && hand.cards.length === 2) {
                        if (player.bankroll >= hand.bet) {
                            player.bankroll -= hand.bet;
                            if (seat.player) seat.player.bankroll = player.bankroll;
                            hand.bet *= 2;
                            const card = this.drawCard(lobby);
                            hand.cards.push(card);
                            const calc = this.calculateHandValue(hand.cards);
                            hand.status = calc.is_bust ? 'bust' : 'doubled';
                            this.addChat(lobby, player.name, player.avatar, `${player.name} RADDOPPIA a $${hand.bet} (Totale: ${calc.total})!`, true);
                            this.broadcastState(lobby, 'chip_double');
                        }
                    } else if (act === 'split' && hand.status === 'playing' && hand.cards.length === 2 && !hand.is_split) {
                        const c1 = hand.cards[0];
                        const c2 = hand.cards[1];
                        const v1 = ['10', 'J', 'Q', 'K'].includes(c1.rank) ? '10' : c1.rank;
                        const v2 = ['10', 'J', 'Q', 'K'].includes(c2.rank) ? '10' : c2.rank;
                        if (v1 === v2 && player.bankroll >= hand.bet) {
                            player.bankroll -= hand.bet;
                            if (seat.player) seat.player.bankroll = player.bankroll;
                            hand.is_split = true;
                            const newHand = {
                                cards: [hand.cards.pop()],
                                bet: hand.bet,
                                insurance_bet: 0,
                                status: 'playing',
                                is_split: true,
                                payout: 0,
                                result: '',
                                total: 0,
                                is_soft: false,
                                is_bust: false,
                                is_blackjack: false
                            };
                            hand.cards.push(this.drawCard(lobby));
                            newHand.cards.push(this.drawCard(lobby));
                            seat.hands.push(newHand);
                            this.addChat(lobby, player.name, player.avatar, `${player.name} DIVIDE la mano!`, true);
                            this.broadcastState(lobby, 'split');
                        }
                    }
                } else if (lobby.phase === 'insurance' && act === 'insurance' && player.seat_index !== null) {
                    const seat = lobby.seats[player.seat_index];
                    const insCost = Math.floor(seat.hands[0].bet / 2);
                    if (insCost > 0 && player.bankroll >= insCost && seat.hands[0].insurance_bet === 0) {
                        player.bankroll -= insCost;
                        if (seat.player) seat.player.bankroll = player.bankroll;
                        seat.hands[0].insurance_bet = insCost;
                        this.addChat(lobby, player.name, player.avatar, `${player.name} ha assicurato la puntata ($${insCost}).`, true);
                        this.broadcastState(lobby, 'chip_click');
                    }
                }
                break;
            }

            case 'rebuy': {
                if (player.bankroll < 50) {
                    player.bankroll = 1000;
                    if (player.lobby_id && this.lobbies[player.lobby_id] && player.seat_index !== null) {
                        const s = this.lobbies[player.lobby_id].seats[player.seat_index];
                        if (s && s.player) s.player.bankroll = 1000;
                        this.addChat(this.lobbies[player.lobby_id], player.name, player.avatar, `💵 ${player.name} ha ricaricato il bankroll a $1,000!`, true);
                        this.broadcastState(this.lobbies[player.lobby_id], 'rebuy');
                    }
                    this.app.handleServerMessage({ type: 'profile_updated', player });
                }
                break;
            }

            case 'chat': {
                if (player.lobby_id && this.lobbies[player.lobby_id]) {
                    const lobby = this.lobbies[player.lobby_id];
                    const msg = this.addChat(lobby, player.name, player.avatar, payload.text || '');
                    this.broadcastState(lobby, null, { new_chat: msg });
                }
                break;
            }
        }
    }

    // ----------------- Autonomous Blackjack Game Cycle -----------------
    ensureGameLoopRunning(lobby) {
        if (this.gameTimers[lobby.id]) return;
        this.runGameCycle(lobby);
    }

    async sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    async runGameCycle(lobby) {
        while (true) {
            const seated = lobby.seats.filter(s => s.player !== null);
            if (seated.length === 0) {
                lobby.phase = 'waiting';
                this.broadcastState(lobby);
                await this.sleep(1500);
                continue;
            }

            // 1. BETTING PHASE
            lobby.phase = 'betting';
            lobby.dealer.cards = [];
            lobby.dealer.status = 'waiting';
            lobby.active_seat_idx = null;
            for (const s of lobby.seats) {
                s.hands = [{
                    cards: [],
                    bet: s.hands[0] ? s.hands[0].bet : 0,
                    insurance_bet: 0,
                    status: 'betting',
                    is_split: false,
                    payout: 0,
                    result: ''
                }];
                s.active_hand_idx = 0;
                s.is_ready = false;
            }
            this.broadcastState(lobby, 'chips_ready');

            // Countdown betting time (12s or until all seated confirm)
            for (let rem = 12; rem > 0; rem--) {
                lobby.timer_seconds_left = rem;
                this.broadcastState(lobby);

                const currentSeated = lobby.seats.filter(s => s.player !== null);
                if (currentSeated.length === 0) break;
                const allReady = currentSeated.every(s => s.is_ready);
                if (allReady && currentSeated.some(s => s.hands[0].bet >= lobby.min_bet)) {
                    break;
                }
                await this.sleep(1000);
            }

            lobby.timer_seconds_left = 0;
            const activeSeats = lobby.seats.filter(s => s.player !== null && s.hands[0].bet >= lobby.min_bet);

            if (activeSeats.length === 0) {
                this.addChat(lobby, 'BANCO', '🎰', 'Nessuna puntata valida. Nuove scommesse...', true);
                this.broadcastState(lobby);
                await this.sleep(2500);
                continue;
            }

            // Deduct bets from players
            for (const s of activeSeats) {
                s.player.bankroll -= s.hands[0].bet;
                s.last_bet = s.hands[0].bet;
                s.hands[0].status = 'playing';
            }

            // 2. DEALING PHASE
            lobby.phase = 'dealing';
            this.broadcastState(lobby, 'shuffle');
            await this.sleep(500);

            // Deal card 1 to players
            for (const s of activeSeats) {
                s.hands[0].cards.push(this.drawCard(lobby));
                this.broadcastState(lobby, 'card_slide');
                await this.sleep(400);
            }

            // Deal card 1 to dealer
            lobby.dealer.cards.push(this.drawCard(lobby));
            this.broadcastState(lobby, 'card_slide');
            await this.sleep(400);

            // Deal card 2 to players
            for (const s of activeSeats) {
                const c = this.drawCard(lobby);
                s.hands[0].cards.push(c);
                const calc = this.calculateHandValue(s.hands[0].cards);
                if (calc.is_blackjack) s.hands[0].status = 'blackjack';
                this.broadcastState(lobby, 'card_slide');
                await this.sleep(400);
            }

            // Deal card 2 to dealer (hole card)
            lobby.dealer.cards.push(this.drawCard(lobby));
            this.broadcastState(lobby, 'card_slide');
            await this.sleep(600);

            // Check Insurance if dealer up card is Ace
            const upCard = lobby.dealer.cards[0];
            if (upCard.rank === 'A') {
                lobby.phase = 'insurance';
                this.addChat(lobby, 'BANCO', '🎰', 'Il Dealer mostra un Asso! Assicurazione aperta.', true);
                for (let ins = 6; ins > 0; ins--) {
                    lobby.timer_seconds_left = ins;
                    this.broadcastState(lobby);
                    await this.sleep(1000);
                }
                lobby.timer_seconds_left = 0;
            }

            // Check Dealer Blackjack
            const dealerCalc = this.calculateHandValue(lobby.dealer.cards);
            if (dealerCalc.is_blackjack) {
                lobby.dealer.status = 'blackjack';
                lobby.phase = 'dealer_turn';
                this.addChat(lobby, 'BANCO', '🎰', '⚡ BLACKJACK DEL DEALER!', true);
                this.broadcastState(lobby, 'dealer_blackjack');
                await this.sleep(1500);
            } else {
                // 3. PLAYERS TURN
                lobby.phase = 'players_turn';
                for (const s of activeSeats) {
                    let hIdx = 0;
                    while (hIdx < s.hands.length) {
                        const hand = s.hands[hIdx];
                        s.active_hand_idx = hIdx;
                        lobby.active_seat_idx = s.index;

                        const calc = this.calculateHandValue(hand.cards);
                        if (calc.is_blackjack) {
                            hand.status = 'blackjack';
                            this.addChat(lobby, 'BANCO', '🌟', `${s.player.name} ha fatto BLACKJACK!`, true);
                            this.broadcastState(lobby, 'blackjack');
                            await this.sleep(1000);
                            hIdx++;
                            continue;
                        }

                        // Turn countdown
                        const turnTime = lobby.turn_timer || 20;
                        for (let rem = turnTime; rem > 0; rem--) {
                            lobby.timer_seconds_left = rem;
                            this.broadcastState(lobby);
                            if (['stood', 'bust', 'doubled'].includes(hand.status)) break;
                            await this.sleep(1000);
                        }

                        if (hand.status === 'playing') {
                            hand.status = 'stood';
                            this.addChat(lobby, 'BANCO', '🎰', `Tempo scaduto per ${s.player.name}. Stai automatico.`, true);
                            this.broadcastState(lobby, 'stand');
                            await this.sleep(400);
                        }
                        hIdx++;
                    }
                }

                lobby.active_seat_idx = null;
                lobby.timer_seconds_left = 0;

                // 4. DEALER TURN
                lobby.phase = 'dealer_turn';
                this.broadcastState(lobby, 'card_flip');
                await this.sleep(800);

                const allBusted = activeSeats.every(s => s.hands.every(h => h.status === 'bust'));
                if (!allBusted) {
                    while (true) {
                        const dCalc = this.calculateHandValue(lobby.dealer.cards);
                        if (dCalc.total >= 17) break;
                        await this.sleep(900);
                        lobby.dealer.cards.push(this.drawCard(lobby));
                        this.broadcastState(lobby, 'card_slide');
                    }
                }

                const dFinal = this.calculateHandValue(lobby.dealer.cards);
                if (dFinal.is_bust) {
                    lobby.dealer.status = 'bust';
                    this.addChat(lobby, 'BANCO', '💥', `IL DEALER HA SBALLATO con ${dFinal.total}!`, true);
                    this.broadcastState(lobby, 'bust');
                } else {
                    lobby.dealer.status = 'done';
                    this.addChat(lobby, 'BANCO', '🎰', `Il Dealer si ferma a ${dFinal.total}.`, true);
                    this.broadcastState(lobby);
                }
                await this.sleep(1200);
            }

            // 5. PAYOUT RESOLUTION
            lobby.phase = 'payout';
            const dRes = this.calculateHandValue(lobby.dealer.cards);
            const winners = [];

            for (const s of activeSeats) {
                for (const h of s.hands) {
                    const pRes = this.calculateHandValue(h.cards);

                    // Insurance resolve
                    if (h.insurance_bet > 0) {
                        if (dRes.is_blackjack) {
                            const insWin = h.insurance_bet * 3;
                            s.player.bankroll += insWin;
                            this.addChat(lobby, 'BANCO', '🛡️', `Assicurazione vinta da ${s.player.name} (+${insWin})!`, true);
                        }
                    }

                    if (pRes.is_bust) {
                        h.result = 'lose';
                        h.payout = 0;
                    } else if (dRes.is_blackjack) {
                        if (pRes.is_blackjack) {
                            h.result = 'push';
                            h.payout = h.bet;
                            s.player.bankroll += h.payout;
                        } else {
                            h.result = 'lose';
                            h.payout = 0;
                        }
                    } else if (pRes.is_blackjack) {
                        const winAmt = Math.floor(h.bet * 2.5);
                        h.result = 'blackjack';
                        h.payout = winAmt;
                        s.player.bankroll += winAmt;
                        winners.push(`${s.player.name} (Blackjack +$${winAmt - h.bet})`);
                    } else if (dRes.is_bust || pRes.total > dRes.total) {
                        const winAmt = h.bet * 2;
                        h.result = 'win';
                        h.payout = winAmt;
                        s.player.bankroll += winAmt;
                        winners.push(`${s.player.name} (+$${h.bet})`);
                    } else if (pRes.total === dRes.total) {
                        h.result = 'push';
                        h.payout = h.bet;
                        s.player.bankroll += h.payout;
                    } else {
                        h.result = 'lose';
                        h.payout = 0;
                    }
                }
            }

            if (winners.length > 0) {
                this.addChat(lobby, 'BANCO', '🏆', `Vincitori: ${winners.join(', ')}`, true);
                this.broadcastState(lobby, 'win_fanfare');
            } else {
                this.broadcastState(lobby, 'chips_collect');
            }

            // 6. ROUND END PAUSE
            lobby.phase = 'round_end';
            for (let endWait = 4; endWait > 0; endWait--) {
                lobby.timer_seconds_left = endWait;
                this.broadcastState(lobby);
                await this.sleep(1000);
            }
        }
    }
}

window.ClientBlackjackEngine = ClientBlackjackEngine;
