/**
 * Royal Casino Blackjack - Main Client Application
 */

const AVATARS = ['🎩', '👑', '💎', '🦁', '🐯', '🦊', '🕶️', '🍀', '🎲', '🏆', '🏎️', '🚀'];
const RANDOM_NAMES = ['VipPlayer', 'HighRoller', 'LuckyStrike', 'CardShark', 'RoyalAce', 'VegasKing', 'CasinoBoss'];

class BlackjackApp {
    constructor() {
        this.ws = null;
        this.player = {
            id: localStorage.getItem('rc_player_id') || this.generateId(),
            name: localStorage.getItem('rc_player_name') || this.getRandomName(),
            avatar: localStorage.getItem('rc_player_avatar') || '🎩',
            bankroll: 1000,
            lobby_id: null,
            seat_index: null,
        };
        this.serverInfo = {
            primary_ip: window.location.hostname,
            port: window.location.port || 8080,
            url: window.location.origin
        };
        this.currentLobby = null;
        this.prevDealerCards = [];
        this.prevSeatCards = {};
        this.turnTimerInterval = null;
        this.isStaticMode = false;
        this.clientEngine = null;

        this.init();
    }

    generateId() {
        const id = 'p_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('rc_player_id', id);
        return id;
    }

    getRandomName() {
        const base = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
        const num = Math.floor(Math.random() * 899 + 100);
        const name = `${base}_${num}`;
        localStorage.setItem('rc_player_name', name);
        return name;
    }

    async init() {
        this.updateHeaderProfile();
        this.setupDOMEvents();
        await this.fetchServerInfo();
        this.connectWebSocket();
    }

    // ----------------- Network & Server Info -----------------

    async fetchServerInfo() {
        try {
            const res = await fetch('/api/info');
            if (res.ok) {
                const data = await res.json();
                this.serverInfo = data;
                this.updateLanDisplays();
            }
        } catch (e) {
            console.warn('Could not fetch /api/info:', e);
        }
    }

    updateLanDisplays() {
        const url = this.serverInfo.url || `http://${this.serverInfo.primary_ip}:${this.serverInfo.port}`;
        const headerText = document.getElementById('headerLanText');
        const lanNoticeUrl = document.getElementById('lanFullUrl');
        const qrInput = document.getElementById('qrUrlInput');

        if (headerText) headerText.textContent = `LAN: ${this.serverInfo.primary_ip}:${this.serverInfo.port}`;
        if (lanNoticeUrl) lanNoticeUrl.textContent = url;
        if (qrInput) qrInput.value = url;
    }

    loadQrCodeSvg() {
        const container = document.getElementById('qrContainer');
        if (!container) return;
        container.innerHTML = '<span style="color:#64748b; font-size:12px;">Caricamento QR Code...</span>';
        fetch('/api/qr')
            .then(res => res.text())
            .then(svg => {
                container.innerHTML = svg;
            })
            .catch(err => {
                container.innerHTML = `<span style="color:#ef4444; font-size:12px;">Errore QR: ${err}</span>`;
            });
    }

    // ----------------- WebSocket Connection -----------------

    connectWebSocket() {
        // Detect if running on GitHub Pages or static server without local Python backend
        const isStaticHost = window.location.hostname.includes('github.io') || 
                             window.location.protocol === 'file:' ||
                             window.location.search.includes('mode=static');

        if (isStaticHost) {
            console.log('Running on GitHub Pages / Static Mode. Initializing Cloud & P2P Engine...');
            this.initStaticCloudMode();
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws?player_id=${encodeURIComponent(this.player.id)}&name=${encodeURIComponent(this.player.name)}&avatar=${encodeURIComponent(this.player.avatar)}`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.showToast('Connesso al Royal Casino', 'success');
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this.handleServerMessage(msg);
            } catch (err) {
                console.error('Failed to parse WS message:', err);
            }
        };

        this.ws.onclose = () => {
            console.warn('WebSocket closed. Reconnecting in 2 seconds...');
            setTimeout(() => this.connectWebSocket(), 2000);
        };

        this.ws.onerror = (err) => {
            console.warn('WebSocket error, switching to static cloud fallback...', err);
            this.initStaticCloudMode();
        };
    }

    // ----------------- Static GitHub Pages Engine -----------------
    initStaticCloudMode() {
        this.isStaticMode = true;
        if (!this.clientEngine && window.ClientBlackjackEngine) {
            this.clientEngine = new window.ClientBlackjackEngine(this);
        }

        const headerText = document.getElementById('headerLanText');
        if (headerText) headerText.textContent = '🌐 GitHub Pages Online';
        
        const lanNotice = document.querySelector('.lan-notice-card');
        if (lanNotice) {
            lanNotice.innerHTML = `
                <div class="lan-notice-info">
                    <div class="lan-wifi-icon">🌍</div>
                    <div>
                        <div class="lan-notice-title">Blackjack Online su GitHub Pages</div>
                        <div class="lan-notice-text">
                            Invia questo link al tuo amico per giocare insieme da qualsiasi PC o smartphone:
                            <span class="lan-notice-url" id="lanFullUrl">${window.location.href}</span>
                        </div>
                    </div>
                </div>
                <div class="lan-btn-group">
                    <button class="btn-secondary" id="btnCopyLanLink">📋 Copia Link</button>
                    <button class="btn-gold" id="btnShowQrCode">📱 Mostra QR Code</button>
                </div>
            `;
            this.setupCopyButton();
        }

        if (this.clientEngine) {
            this.clientEngine.broadcastLobbiesList();
        }
        this.showToast('Modalità Online GitHub Pages Attiva', 'success');
    }

    setupCopyButton() {
        document.getElementById('btnCopyLanLink')?.addEventListener('click', () => {
            navigator.clipboard.writeText(window.location.href).then(() => {
                this.showToast('Link GitHub Pages copiato negli appunti!', 'success');
            });
        });
    }

    send(type, payload = {}) {
        if (this.isStaticMode && this.clientEngine) {
            this.clientEngine.handleAction(this.player, type, payload);
            return;
        }
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, ...payload }));
        } else if (this.clientEngine) {
            this.clientEngine.handleAction(this.player, type, payload);
        }
    }

    // ----------------- Incoming Message Dispatcher -----------------

    handleServerMessage(msg) {
        // Audio event handler
        if (msg.sound && window.soundEngine) {
            window.soundEngine.playEvent(msg.sound);
        }

        switch (msg.type) {
            case 'welcome':
                if (msg.player) {
                    this.player.bankroll = msg.player.bankroll;
                    this.updateHeaderProfile();
                }
                if (msg.url) {
                    this.serverInfo.url = msg.url;
                    this.updateLanDisplays();
                }
                break;

            case 'profile_updated':
                if (msg.player) {
                    this.player.name = msg.player.name;
                    this.player.avatar = msg.player.avatar;
                    this.player.bankroll = msg.player.bankroll;
                    this.updateHeaderProfile();
                }
                break;

            case 'lobbies_list':
                this.renderLobbiesList(msg.lobbies || []);
                break;

            case 'lobby_state':
                this.currentLobby = msg.state;
                this.renderLobbyState(msg.state);
                if (msg.event && msg.event.new_chat) {
                    this.appendChatMessage(msg.event.new_chat);
                }
                break;

            case 'left_lobby':
                this.currentLobby = null;
                this.player.lobby_id = null;
                this.player.seat_index = null;
                this.showLobbyView();
                break;

            default:
                break;
        }
    }

    // ----------------- UI View Switching -----------------

    showLobbyView() {
        document.getElementById('lobbyView').style.display = 'block';
        document.getElementById('gameView').style.display = 'none';
        this.send('list_lobbies');
    }

    showGameView() {
        document.getElementById('lobbyView').style.display = 'none';
        document.getElementById('gameView').style.display = 'flex';
    }

    // ----------------- Lobby List Renderer -----------------

    renderLobbiesList(lobbies) {
        const grid = document.getElementById('tablesGrid');
        if (!grid) return;

        if (lobbies.length === 0) {
            grid.innerHTML = `
                <div class="empty-tables-msg">
                    <p style="font-size: 18px; margin-bottom: 8px;">Nessun tavolo aperto al momento.</p>
                    <p style="font-size: 14px;">Clicca su "Crea Nuovo Tavolo" per avviare una partita con i tuoi amici!</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = lobbies.map(l => {
            const isFull = l.seated_count >= l.max_seats;
            const phaseLabel = l.phase === 'betting' ? 'Scommesse Aperte' : (l.phase === 'waiting' ? 'In Attesa' : 'Mano in Corso');
            const phaseClass = l.phase === 'betting' ? 'betting' : 'playing';

            return `
            <div class="table-card">
                <div>
                    <div class="table-card-top">
                        <div>
                            <div class="table-card-name">${this.escapeHtml(l.name)}</div>
                            <span class="table-phase-badge ${phaseClass}">${phaseLabel}</span>
                        </div>
                    </div>
                    <div class="table-card-stats">
                        <div class="stat-item">
                            <span class="stat-label">Posti</span>
                            <span class="stat-value">🪑 ${l.seated_count}/${l.max_seats}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Min Bet</span>
                            <span class="stat-value" style="color:#4ade80;">$${l.min_bet}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Spettatori</span>
                            <span class="stat-value">👁️ ${l.spectators_count}</span>
                        </div>
                    </div>
                </div>
                <button class="btn-join-table" onclick="app.joinLobby('${l.id}')">
                    ${isFull ? '👁️ Guarda come Spettatore' : '🪑 Entra al Tavolo'}
                </button>
            </div>
            `;
        }).join('');
    }

    joinLobby(lobbyId) {
        if (window.soundEngine) window.soundEngine.playClick();
        this.send('join_lobby', { lobby_id: lobbyId });
    }

    // ----------------- Casino Game Table Renderer -----------------

    renderLobbyState(lobby) {
        this.showGameView();

        // Update Deck / Discard counts
        const shoeCountEl = document.getElementById('shoeCardCount');
        const discardCountEl = document.getElementById('discardCount');
        if (shoeCountEl) shoeCountEl.textContent = lobby.cards_remaining;
        if (discardCountEl) discardCountEl.textContent = 312 - lobby.cards_remaining;

        // Render Dealer Area
        this.renderDealer(lobby.dealer);

        // Render Seats
        this.renderSeats(lobby);

        // Render Bottom Action Dock
        this.renderControlDock(lobby);

        // Synchronize Chat History
        if (lobby.chat) {
            this.renderChatHistory(lobby.chat);
        }
    }

    renderDealer(dealer) {
        const area = document.getElementById('dealerCardsArea');
        if (!area) return;

        area.innerHTML = '';
        dealer.cards.forEach((card, idx) => {
            const cardEl = window.CardRenderer.createCardElement(card);
            cardEl.style.zIndex = idx + 1;
            area.appendChild(cardEl);
        });

        // Dealer Score Badge
        if (dealer.cards.length > 0) {
            const badge = document.createElement('div');
            badge.className = 'hand-score-pill';
            if (dealer.is_bust) {
                badge.classList.add('bust');
                badge.textContent = `SBALLA (${dealer.total})`;
            } else if (dealer.is_blackjack) {
                badge.classList.add('blackjack');
                badge.textContent = 'BLACKJACK!';
            } else {
                badge.textContent = dealer.is_soft ? `Soft ${dealer.total}` : `${dealer.total}`;
            }
            area.appendChild(badge);
        }
    }

    renderSeats(lobby) {
        const container = document.getElementById('seatsContainer');
        if (!container) return;

        container.innerHTML = '';

        lobby.seats.forEach((seat, idx) => {
            const isMySeat = (seat.player && seat.player.id === this.player.id);
            if (isMySeat) {
                this.player.seat_index = idx;
                this.player.bankroll = seat.player.bankroll;
                this.updateHeaderProfile();
            }

            const seatEl = document.createElement('div');
            seatEl.className = 'player-seat';
            if (lobby.active_seat_idx === idx) {
                seatEl.classList.add('is-active');
            }

            // Cards in Seat Hand
            const cardsArea = document.createElement('div');
            cardsArea.className = 'seat-cards-area';

            if (seat.hands.length > 1) {
                // Split Hands rendering
                const splitContainer = document.createElement('div');
                splitContainer.className = 'split-hands-container';

                seat.hands.forEach((hand, hIdx) => {
                    const handDiv = document.createElement('div');
                    handDiv.className = 'single-split-hand';
                    if (seat.active_hand_idx === hIdx && lobby.active_seat_idx === idx) {
                        handDiv.classList.add('is-active-split');
                    }
                    this.renderCardsInContainer(handDiv, hand);
                    splitContainer.appendChild(handDiv);
                });
                cardsArea.appendChild(splitContainer);
            } else if (seat.hands.length === 1 && seat.hands[0].cards.length > 0) {
                this.renderCardsInContainer(cardsArea, seat.hands[0]);
            }

            seatEl.appendChild(cardsArea);

            // Betting Spot
            const bettingSpot = document.createElement('div');
            bettingSpot.className = 'betting-spot';
            bettingSpot.dataset.seatIndex = idx;

            const totalBet = seat.hands.reduce((acc, h) => acc + h.bet, 0);
            window.ChipRenderer.renderChipStack(bettingSpot, totalBet);

            if (totalBet === 0) {
                bettingSpot.innerHTML = `<span class="betting-spot-label">PUNTATA</span>`;
            }

            // Click betting spot to bet (if seated here)
            if (isMySeat && lobby.phase === 'betting') {
                bettingSpot.title = 'Clicca una fiche in basso per puntare';
            }
            seatEl.appendChild(bettingSpot);

            // Player Badge or Empty Seat
            if (seat.player) {
                const playerBox = document.createElement('div');
                playerBox.className = 'seat-player-box';

                let statusBadge = '';
                if (seat.hands[0].result === 'win') {
                    statusBadge = `<div style="color:#4ade80; font-size:11px; font-weight:bold;">🏆 VINTO! +$${seat.hands[0].payout}</div>`;
                } else if (seat.hands[0].result === 'blackjack') {
                    statusBadge = `<div style="color:#fef08a; font-size:11px; font-weight:bold;">🌟 BLACKJACK! +$${seat.hands[0].payout}</div>`;
                } else if (seat.hands[0].result === 'push') {
                    statusBadge = `<div style="color:#38bdf8; font-size:11px; font-weight:bold;">🤝 PAREGGIO (Rimborso)</div>`;
                } else if (seat.hands[0].result === 'lose') {
                    statusBadge = `<div style="color:#f87171; font-size:11px; font-weight:bold;">PERSO</div>`;
                } else if (seat.is_ready && lobby.phase === 'betting') {
                    statusBadge = `<div style="color:#4ade80; font-size:11px; font-weight:bold;">✅ PRONTO</div>`;
                }

                playerBox.innerHTML = `
                    <div class="seat-avatar">${seat.player.avatar}</div>
                    <div class="seat-player-name">${this.escapeHtml(seat.player.name)}</div>
                    <div class="seat-player-bankroll">$${seat.player.bankroll.toLocaleString()}</div>
                    ${statusBadge}
                `;

                // If active turn, show countdown line
                if (lobby.active_seat_idx === idx && lobby.timer_seconds_left > 0) {
                    const timerWrap = document.createElement('div');
                    timerWrap.className = 'turn-timer-container';
                    const pct = Math.max(0, Math.min(100, (lobby.timer_seconds_left / (lobby.turn_timer || 20)) * 100));
                    timerWrap.innerHTML = `<div class="turn-timer-fill" style="width: ${pct}%"></div>`;
                    playerBox.appendChild(timerWrap);
                }

                seatEl.appendChild(playerBox);
            } else {
                // Empty Seat: Click to sit
                const emptyBtn = document.createElement('button');
                emptyBtn.className = 'empty-seat-btn';
                emptyBtn.innerHTML = `<span>🪑</span><span>Siediti Qui</span>`;
                emptyBtn.onclick = () => {
                    if (window.soundEngine) window.soundEngine.playClick();
                    this.send('sit_down', { seat_index: idx });
                };
                seatEl.appendChild(emptyBtn);
            }

            container.appendChild(seatEl);
        });
    }

    renderCardsInContainer(container, hand) {
        hand.cards.forEach((card, idx) => {
            const cardEl = window.CardRenderer.createCardElement(card);
            cardEl.style.zIndex = idx + 1;
            container.appendChild(cardEl);
        });

        if (hand.cards.length > 0) {
            const badge = document.createElement('div');
            badge.className = 'hand-score-pill';
            if (hand.is_bust) {
                badge.classList.add('bust');
                badge.textContent = `SBALLATO (${hand.total})`;
            } else if (hand.is_blackjack) {
                badge.classList.add('blackjack');
                badge.textContent = 'BLACKJACK!';
            } else if (hand.result === 'win') {
                badge.classList.add('win');
                badge.textContent = `${hand.total} (VINCE!)`;
            } else {
                badge.textContent = hand.is_soft ? `Soft ${hand.total}` : `${hand.total}`;
            }
            container.appendChild(badge);
        }
    }

    // ----------------- Bottom Controls Dock -----------------

    renderControlDock(lobby) {
        const dock = document.getElementById('dockCenterControls');
        if (!dock) return;

        const mySeatIdx = this.player.seat_index;
        const isSeated = (mySeatIdx !== null && mySeatIdx !== undefined && lobby.seats[mySeatIdx] && lobby.seats[mySeatIdx].player);
        const mySeat = isSeated ? lobby.seats[mySeatIdx] : null;

        dock.innerHTML = '';

        // PHASE 1: BETTING
        if (lobby.phase === 'betting') {
            if (isSeated) {
                const currentBet = mySeat.hands[0].bet;
                const isReady = mySeat.is_ready;

                if (!isReady) {
                    // Show Chip Selection Rack
                    const chipRack = document.createElement('div');
                    chipRack.className = 'chip-rack';

                    const denoms = [5, 25, 50, 100, 500, 1000];
                    denoms.forEach(val => {
                        const chipBtn = document.createElement('button');
                        chipBtn.className = 'chip-selector-btn';
                        chipBtn.title = `Punta $${val}`;
                        chipBtn.innerHTML = window.ChipRenderer.getChipSVG(val, 50);
                        chipBtn.onclick = (e) => {
                            const targetSpot = document.querySelector(`.betting-spot[data-seat-index="${mySeatIdx}"]`);
                            window.ChipRenderer.animateChipToss(chipBtn, targetSpot, val);
                            this.send('place_bet', { amount: val });
                        };
                        chipRack.appendChild(chipBtn);
                    });

                    // Quick Bet modifiers
                    const clearBtn = document.createElement('button');
                    clearBtn.className = 'btn-secondary';
                    clearBtn.innerHTML = '<span>🧹</span><span>Azzera</span>';
                    clearBtn.onclick = () => this.send('clear_bet');

                    const doubleBetBtn = document.createElement('button');
                    doubleBetBtn.className = 'btn-secondary';
                    doubleBetBtn.innerHTML = '<span>✖2</span><span>Raddoppia</span>';
                    doubleBetBtn.onclick = () => {
                        if (currentBet > 0) this.send('place_bet', { amount: currentBet });
                    };

                    const confirmBtn = document.createElement('button');
                    confirmBtn.className = 'btn-action btn-deal-confirm';
                    confirmBtn.innerHTML = `<span>DISTRIBUISCI</span><span style="font-size:11px; opacity:0.8;">Puntata: $${currentBet}</span>`;
                    confirmBtn.disabled = currentBet < lobby.min_bet;
                    confirmBtn.onclick = () => {
                        if (window.soundEngine) window.soundEngine.playClick();
                        this.send('confirm_bet');
                    };

                    dock.appendChild(clearBtn);
                    dock.appendChild(chipRack);
                    dock.appendChild(doubleBetBtn);
                    dock.appendChild(confirmBtn);
                } else {
                    dock.innerHTML = `
                        <div style="font-family:'Cinzel',serif; color:#4ade80; font-size:16px; font-weight:bold; display:flex; align-items:center; gap:8px;">
                            <span>⏳</span>
                            <span>Puntata confermata ($${currentBet}). Distribuzione tra ${lobby.timer_seconds_left}s...</span>
                        </div>
                    `;
                }
            } else {
                dock.innerHTML = `
                    <div style="color:#94a3b8; font-size:14px;">
                        🎲 Fase scommesse in corso (${lobby.timer_seconds_left}s). Clicca su un posto libero per sederti!
                    </div>
                `;
            }
        }
        // PHASE 2: INSURANCE
        else if (lobby.phase === 'insurance') {
            if (isSeated && mySeat.hands[0].bet > 0) {
                const insCost = Math.floor(mySeat.hands[0].bet / 2);
                const hasIns = mySeat.hands[0].insurance_bet > 0;

                if (!hasIns) {
                    dock.innerHTML = `
                        <div class="action-buttons-group">
                            <span style="color:#ffd700; font-family:'Cinzel',serif; font-size:14px; font-weight:bold; margin-right:12px;">
                                🛡️ Vuoi l'Assicurazione? (${lobby.timer_seconds_left}s)
                            </span>
                            <button class="btn-action btn-double" onclick="app.sendAction('insurance')">
                                <span>ASSICURA</span>
                                <span style="font-size:11px;">$${insCost}</span>
                            </button>
                        </div>
                    `;
                } else {
                    dock.innerHTML = `<div style="color:#4ade80; font-weight:bold;">🛡️ Assicurazione Attiva ($${hasIns}). In attesa...</div>`;
                }
            } else {
                dock.innerHTML = `<div style="color:#94a3b8;">Il dealer controlla se ha Blackjack...</div>`;
            }
        }
        // PHASE 3: PLAYERS TURN
        else if (lobby.phase === 'players_turn') {
            const isMyTurn = (isSeated && lobby.active_seat_idx === mySeatIdx);

            if (isMyTurn) {
                const activeHand = mySeat.hands[mySeat.active_hand_idx];
                const canDouble = (activeHand.cards.length === 2 && this.player.bankroll >= activeHand.bet);
                const canSplit = (
                    activeHand.cards.length === 2 &&
                    !activeHand.is_split &&
                    this.player.bankroll >= activeHand.bet &&
                    this.canCardsSplit(activeHand.cards[0], activeHand.cards[1])
                );

                dock.innerHTML = `
                    <div class="action-buttons-group">
                        <button class="btn-action btn-hit" onclick="app.sendAction('hit')">
                            <span>🃏 CARTA</span>
                            <span style="font-size:10px;">(Hit)</span>
                        </button>
                        <button class="btn-action btn-stand" onclick="app.sendAction('stand')">
                            <span>🛑 STAI</span>
                            <span style="font-size:10px;">(Stand)</span>
                        </button>
                        <button class="btn-action btn-double" ${!canDouble ? 'disabled' : ''} onclick="app.sendAction('double')">
                            <span>⚡ RADDOPPIA</span>
                            <span style="font-size:10px;">(Double x2)</span>
                        </button>
                        <button class="btn-action btn-split" ${!canSplit ? 'disabled' : ''} onclick="app.sendAction('split')">
                            <span>✂️ DIVIDI</span>
                            <span style="font-size:10px;">(Split)</span>
                        </button>
                    </div>
                `;
            } else {
                const activeSeat = lobby.seats[lobby.active_seat_idx];
                const activeName = (activeSeat && activeSeat.player) ? activeSeat.player.name : 'Giocatore';
                dock.innerHTML = `
                    <div style="font-family:'Cinzel',serif; color:#ffd700; font-size:15px; font-weight:bold;">
                        ⏳ Turno di ${this.escapeHtml(activeName)} (${lobby.timer_seconds_left}s)...
                    </div>
                `;
            }
        }
        // PHASE 4: DEALER TURN
        else if (lobby.phase === 'dealer_turn') {
            dock.innerHTML = `
                <div style="font-family:'Cinzel',serif; color:#ffd700; font-size:16px; font-weight:bold;">
                    🎰 Il Dealer gioca la sua mano...
                </div>
            `;
        }
        // PHASE 5 & 6: PAYOUT & ROUND END
        else if (lobby.phase === 'payout' || lobby.phase === 'round_end') {
            dock.innerHTML = `
                <div style="font-family:'Cinzel',serif; color:#4ade80; font-size:16px; font-weight:bold;">
                    ✨ Pagamento vincite! Nuovo giro tra ${lobby.timer_seconds_left || 3}s...
                </div>
            `;
        }
    }

    canCardsSplit(c1, c2) {
        if (!c1 || !c2) return false;
        const v1 = ['10', 'J', 'Q', 'K'].includes(c1.rank) ? '10' : c1.rank;
        const v2 = ['10', 'J', 'Q', 'K'].includes(c2.rank) ? '10' : c2.rank;
        return v1 === v2;
    }

    sendAction(act) {
        if (window.soundEngine) window.soundEngine.playClick();
        this.send('player_action', { action: act });
    }

    // ----------------- Chat System -----------------

    renderChatHistory(messages) {
        const box = document.getElementById('chatMessages');
        if (!box) return;
        box.innerHTML = '';
        messages.forEach(m => this.appendChatMessage(m));
    }

    appendChatMessage(m) {
        const box = document.getElementById('chatMessages');
        if (!box) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg' + (m.is_system ? ' system' : '');

        if (m.is_system) {
            msgDiv.textContent = m.text;
        } else {
            msgDiv.innerHTML = `
                <span class="chat-msg-author">${m.avatar || ''} ${this.escapeHtml(m.name)}:</span>
                <span>${this.escapeHtml(m.text)}</span>
            `;
        }

        box.appendChild(msgDiv);
        box.scrollTop = box.scrollHeight;
    }

    sendChat() {
        const input = document.getElementById('chatInput');
        if (!input) return;
        const text = input.value.trim();
        if (text) {
            this.send('chat', { text });
            input.value = '';
        }
    }

    // ----------------- Header & Profile -----------------

    updateHeaderProfile() {
        const avatarEl = document.getElementById('headerPlayerAvatar');
        const nameEl = document.getElementById('headerPlayerName');
        const chipsEl = document.getElementById('headerPlayerChips');

        if (avatarEl) avatarEl.textContent = this.player.avatar;
        if (nameEl) nameEl.textContent = this.player.name;
        if (chipsEl) chipsEl.textContent = `$${this.player.bankroll.toLocaleString()}`;

        localStorage.setItem('rc_player_name', this.player.name);
        localStorage.setItem('rc_player_avatar', this.player.avatar);
    }

    // ----------------- DOM Event Bindings -----------------

    setupDOMEvents() {
        // Logo / Home click
        document.getElementById('btnLogoHome')?.addEventListener('click', () => {
            if (this.currentLobby) {
                if (confirm('Vuoi lasciare il tavolo e tornare alla lista lobby?')) {
                    this.send('leave_lobby');
                }
            } else {
                this.showLobbyView();
            }
        });

        // Sound toggle
        document.getElementById('btnToggleSound')?.addEventListener('click', () => {
            if (window.soundEngine) {
                const enabled = window.soundEngine.toggleMute();
                document.getElementById('soundIcon').textContent = enabled ? '🔊' : '🔇';
                this.showToast(enabled ? 'Audio Attivato' : 'Audio Disattivato');
            }
        });

        // LAN Modals
        document.getElementById('btnOpenLanModal')?.addEventListener('click', () => this.openQrModal());
        document.getElementById('btnShowQrCode')?.addEventListener('click', () => this.openQrModal());
        document.getElementById('btnTableShare')?.addEventListener('click', () => this.openQrModal());
        document.getElementById('btnCloseQrModal')?.addEventListener('click', () => this.closeModal('qrModal'));

        // Copy LAN Link
        const copyHandler = () => {
            const url = this.serverInfo.url || `http://${this.serverInfo.primary_ip}:${this.serverInfo.port}`;
            navigator.clipboard.writeText(url).then(() => {
                this.showToast('Link LAN copiato negli appunti! Incollalo agli amici.', 'success');
            }).catch(() => {
                this.showToast(`Indirizzo: ${url}`);
            });
        };
        document.getElementById('btnCopyLanLink')?.addEventListener('click', copyHandler);
        document.getElementById('btnCopyQrUrl')?.addEventListener('click', copyHandler);

        // Create Table Modal
        document.getElementById('btnOpenCreateModal')?.addEventListener('click', () => {
            this.openModal('createModal');
        });
        document.getElementById('btnCloseCreateModal')?.addEventListener('click', () => {
            this.closeModal('createModal');
        });

        document.getElementById('createTableForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('inputTableName').value;
            const max_seats = parseInt(document.getElementById('inputMaxSeats').value, 10);
            const min_bet = parseInt(document.getElementById('inputMinBet').value, 10);
            const timer = parseInt(document.getElementById('inputTurnTimer').value, 10);

            this.send('create_lobby', { name, max_seats, min_bet, max_bet: min_bet * 100, timer });
            this.closeModal('createModal');
        });

        // Profile Modal
        document.getElementById('btnOpenProfileModal')?.addEventListener('click', () => {
            document.getElementById('inputProfileName').value = this.player.name;
            this.renderAvatarGrid();
            this.openModal('profileModal');
        });
        document.getElementById('btnCloseProfileModal')?.addEventListener('click', () => {
            this.closeModal('profileModal');
        });
        document.getElementById('btnSaveProfile')?.addEventListener('click', () => {
            const name = document.getElementById('inputProfileName').value.trim() || 'Giocatore';
            this.player.name = name;
            this.updateHeaderProfile();
            this.send('set_profile', { name: this.player.name, avatar: this.player.avatar });
            this.closeModal('profileModal');
            this.showToast('Profilo aggiornato!');
        });

        // In-Game Leave Table
        document.getElementById('btnLeaveTable')?.addEventListener('click', () => {
            if (confirm('Sei sicuro di voler lasciare il tavolo?')) {
                this.send('leave_lobby');
            }
        });

        // Rebuy Buttons
        const rebuyHandler = () => {
            if (this.player.bankroll < 50) {
                this.send('rebuy');
                this.showToast('Bankroll ricaricato a $1,000!', 'success');
            } else {
                this.showToast(`Hai ancora $${this.player.bankroll}. Puoi ricaricare quando scendi sotto $50.`);
            }
        };
        document.getElementById('btnTableRebuy')?.addEventListener('click', rebuyHandler);

        // Chat Toggle & Events
        const chatPanel = document.getElementById('chatPanel');
        document.getElementById('btnToggleChat')?.addEventListener('click', () => {
            chatPanel.classList.toggle('collapsed');
        });
        document.getElementById('btnCloseChat')?.addEventListener('click', () => {
            chatPanel.classList.add('collapsed');
        });

        document.getElementById('btnSendChat')?.addEventListener('click', () => this.sendChat());
        document.getElementById('chatInput')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.sendChat();
        });

        document.querySelectorAll('.emoji-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const emoji = btn.dataset.emoji;
                this.send('chat', { text: emoji });
            });
        });
    }

    renderAvatarGrid() {
        const grid = document.getElementById('avatarGrid');
        if (!grid) return;
        grid.innerHTML = '';
        AVATARS.forEach(av => {
            const el = document.createElement('div');
            el.className = 'avatar-choice' + (av === this.player.avatar ? ' selected' : '');
            el.textContent = av;
            el.onclick = () => {
                this.player.avatar = av;
                document.querySelectorAll('.avatar-choice').forEach(c => c.classList.remove('selected'));
                el.classList.add('selected');
            };
            grid.appendChild(el);
        });
    }

    openQrModal() {
        this.loadQrCodeSvg();
        this.openModal('qrModal');
    }

    openModal(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'flex';
    }

    closeModal(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast';
        if (type === 'success') toast.style.borderColor = '#4ade80';
        toast.textContent = message;

        container.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 3200);
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

// Global instance
window.addEventListener('DOMContentLoaded', () => {
    window.app = new BlackjackApp();
});
