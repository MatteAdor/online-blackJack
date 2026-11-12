/**
 * Royal Casino Blackjack - Card SVG & DOM Renderer
 * Renders high-resolution vector cards with 3D flip structure.
 */

const CardRenderer = {
    suitSymbols: {
        spades: '♠',
        hearts: '♥',
        diamonds: '♦',
        clubs: '♣',
        '♠': '♠',
        '♥': '♥',
        '♦': '♦',
        '♣': '♣'
    },

    suitColors: {
        spades: '#1a1a24',
        hearts: '#c62828',
        diamonds: '#c62828',
        clubs: '#1a1a24',
        '♠': '#1a1a24',
        '♥': '#c62828',
        '♦': '#c62828',
        '♣': '#1a1a24'
    },

    getSuitName(suit) {
        if (suit === '♠' || suit === 'spades') return 'spades';
        if (suit === '♥' || suit === 'hearts') return 'hearts';
        if (suit === '♦' || suit === 'diamonds') return 'diamonds';
        return 'clubs';
    },

    // Generates the intricate SVG pattern for card backs
    getCardBackSVG() {
        return `
        <svg viewBox="0 0 160 224" class="card-svg" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="backGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#141a29"/>
                    <stop offset="50%" stop-color="#0a0e17"/>
                    <stop offset="100%" stop-color="#192338"/>
                </linearGradient>
                <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#e2c875"/>
                    <stop offset="50%" stop-color="#ffd700"/>
                    <stop offset="100%" stop-color="#b8860b"/>
                </linearGradient>
                <pattern id="damask" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M10 0 L20 10 L10 20 L0 10 Z" fill="none" stroke="rgba(218, 165, 32, 0.16)" stroke-width="1"/>
                    <circle cx="10" cy="10" r="2.5" fill="rgba(218, 165, 32, 0.22)"/>
                </pattern>
            </defs>
            <rect width="160" height="224" rx="10" fill="#f8f9fa"/>
            <rect x="6" y="6" width="148" height="212" rx="7" fill="url(#backGrad)" stroke="url(#goldGrad)" stroke-width="2.5"/>
            <rect x="12" y="12" width="136" height="200" rx="5" fill="url(#damask)"/>
            <rect x="14" y="14" width="132" height="196" rx="4" fill="none" stroke="url(#goldGrad)" stroke-width="1.2" stroke-dasharray="3,2"/>
            
            <!-- Central Medallion -->
            <circle cx="80" cy="112" r="32" fill="#0d131f" stroke="url(#goldGrad)" stroke-width="2"/>
            <circle cx="80" cy="112" r="26" fill="none" stroke="rgba(255,215,0,0.4)" stroke-width="1"/>
            
            <!-- Crown / Crest Icon in Center -->
            <path d="M68 120 L72 104 L80 114 L88 104 L92 120 Z" fill="url(#goldGrad)"/>
            <circle cx="72" cy="103" r="1.5" fill="#fff"/>
            <circle cx="80" cy="113" r="1.5" fill="#fff"/>
            <circle cx="88" cy="103" r="1.5" fill="#fff"/>
            <rect x="68" y="121" width="24" height="3" rx="1" fill="url(#goldGrad)"/>
        </svg>
        `;
    },

    // Generates Court Royal Face Illustration SVG
    getCourtFaceSVG(rank, color) {
        let crown = '';
        if (rank === 'K') {
            crown = `
            <path d="M-18 -15 L-12 -30 L0 -18 L12 -30 L18 -15 Z" fill="#e5a93c" stroke="#b27d1a" stroke-width="1.2"/>
            <circle cx="-12" cy="-30" r="2" fill="#d32f2f"/>
            <circle cx="0" cy="-18" r="2" fill="#1976d2"/>
            <circle cx="12" cy="-30" r="2" fill="#d32f2f"/>
            <circle cx="0" cy="-2" r="14" fill="#f8d7b3"/>
            <path d="M-6 5 Q0 12 6 5" stroke="#4a3728" stroke-width="2" fill="none"/>
            <path d="M-10 -2 Q-7 -4 -4 -2" stroke="#222" stroke-width="1.5" fill="none"/>
            <path d="M4 -2 Q7 -4 10 -2" stroke="#222" stroke-width="1.5" fill="none"/>
            `;
        } else if (rank === 'Q') {
            crown = `
            <path d="M-16 -16 L-8 -28 L0 -14 L8 -28 L16 -16 Z" fill="#e5a93c" stroke="#b27d1a" stroke-width="1.2"/>
            <circle cx="-8" cy="-28" r="2" fill="#e91e63"/>
            <circle cx="8" cy="-28" r="2" fill="#e91e63"/>
            <circle cx="0" cy="-2" r="13" fill="#fce4d6"/>
            <path d="M-5 4 Q0 9 5 4" stroke="#c2185b" stroke-width="2" fill="none"/>
            <circle cx="-4" cy="-2" r="1.5" fill="#222"/>
            <circle cx="4" cy="-2" r="1.5" fill="#222"/>
            `;
        } else { // Jack
            crown = `
            <path d="M-16 -14 Q0 -24 16 -14 L12 -6 L-12 -6 Z" fill="#3949ab" stroke="#1a237e" stroke-width="1"/>
            <polygon points="0,-24 4,-30 0,-34 -4,-30" fill="#ffd700"/>
            <circle cx="0" cy="-2" r="13" fill="#fce4d6"/>
            <path d="M-5 4 Q0 8 5 4" stroke="#4a3728" stroke-width="1.5" fill="none"/>
            <circle cx="-4" cy="-2" r="1.5" fill="#222"/>
            <circle cx="4" cy="-2" r="1.5" fill="#222"/>
            `;
        }

        return `
        <g transform="translate(80, 112)">
            <rect x="-34" y="-48" width="68" height="96" rx="6" fill="#fdfbf7" stroke="#e0d7c7" stroke-width="1.5"/>
            ${crown}
            <rect x="-24" y="16" width="48" height="24" rx="4" fill="${color}" opacity="0.85"/>
            <text x="0" y="32" font-family="'Cinzel', 'Times New Roman', serif" font-size="14" font-weight="bold" fill="#fff" text-anchor="middle">${rank}</text>
        </g>
        `;
    },

    // Generates Card Front SVG
    getCardFrontSVG(rank, suit) {
        const suitName = this.getSuitName(suit);
        const symbol = this.suitSymbols[suitName];
        const color = this.suitColors[suitName];
        const isCourt = ['J', 'Q', 'K'].includes(rank);
        const isAce = rank === 'A';

        let centerContent = '';

        if (isCourt) {
            centerContent = this.getCourtFaceSVG(rank, color);
        } else if (isAce) {
            centerContent = `
            <g transform="translate(80, 112)">
                <circle cx="0" cy="0" r="30" fill="none" stroke="${color}" stroke-width="1" opacity="0.25"/>
                <text x="0" y="18" font-size="56" fill="${color}" text-anchor="middle" font-family="serif" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))">${symbol}</text>
            </g>
            `;
        } else {
            // Number Card Pip Layouts
            const pips = [];
            const val = parseInt(rank, 10);
            const posMap = {
                2: [[80, 70], [80, 154]],
                3: [[80, 68], [80, 112], [80, 156]],
                4: [[54, 70], [106, 70], [54, 154], [106, 154]],
                5: [[54, 68], [106, 68], [80, 112], [54, 156], [106, 156]],
                6: [[54, 68], [106, 68], [54, 112], [106, 112], [54, 156], [106, 156]],
                7: [[54, 65], [106, 65], [80, 88], [54, 112], [106, 112], [54, 159], [106, 159]],
                8: [[54, 65], [106, 65], [80, 88], [54, 112], [106, 112], [80, 136], [54, 159], [106, 159]],
                9: [[54, 60], [106, 60], [54, 94], [106, 94], [80, 112], [54, 130], [106, 130], [54, 164], [106, 164]],
                10: [[54, 58], [106, 58], [80, 78], [54, 98], [106, 98], [54, 126], [106, 126], [80, 146], [54, 166], [106, 166]]
            };

            const points = posMap[val] || [[80, 112]];
            points.forEach(([x, y]) => {
                pips.push(`<text x="${x}" y="${y + 7}" font-size="22" fill="${color}" text-anchor="middle" font-family="serif">${symbol}</text>`);
            });
            centerContent = `<g>${pips.join('')}</g>`;
        }

        return `
        <svg viewBox="0 0 160 224" class="card-svg" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="cardBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#ffffff"/>
                    <stop offset="100%" stop-color="#f5f4ef"/>
                </linearGradient>
            </defs>
            <rect width="160" height="224" rx="10" fill="url(#cardBgGrad)" stroke="#dcd6c8" stroke-width="1.5"/>
            <rect x="5" y="5" width="150" height="214" rx="8" fill="none" stroke="rgba(0,0,0,0.06)" stroke-width="1"/>
            
            <!-- Top Left Index -->
            <g transform="translate(14, 26)">
                <text x="0" y="0" font-family="'Cinzel', 'Georgia', serif" font-size="20" font-weight="900" fill="${color}" text-anchor="middle">${rank}</text>
                <text x="0" y="16" font-size="16" fill="${color}" text-anchor="middle">${symbol}</text>
            </g>

            <!-- Bottom Right Index (Inverted) -->
            <g transform="translate(146, 198) rotate(180)">
                <text x="0" y="0" font-family="'Cinzel', 'Georgia', serif" font-size="20" font-weight="900" fill="${color}" text-anchor="middle">${rank}</text>
                <text x="0" y="16" font-size="16" fill="${color}" text-anchor="middle">${symbol}</text>
            </g>

            <!-- Center Artwork / Pips -->
            ${centerContent}
        </svg>
        `;
    },

    // Creates the complete 3D Card DOM element
    createCardElement(card, options = {}) {
        const el = document.createElement('div');
        el.className = 'playing-card';
        if (options.extraClass) {
            el.classList.add(options.extraClass);
        }

        const isHidden = card.hidden === true;
        if (isHidden) {
            el.classList.add('is-flipped');
        }

        const inner = document.createElement('div');
        inner.className = 'card-inner';

        // Front Face
        const front = document.createElement('div');
        front.className = 'card-face card-front';
        if (!isHidden && card.rank && card.suit) {
            front.innerHTML = this.getCardFrontSVG(card.rank, card.suit);
        }

        // Back Face
        const back = document.createElement('div');
        back.className = 'card-face card-back';
        back.innerHTML = this.getCardBackSVG();

        inner.appendChild(front);
        inner.appendChild(back);
        el.appendChild(inner);

        // Store card data on element
        el.dataset.cardId = card.id || (card.rank ? `${card.rank}_${card.suit}` : 'hidden');

        return el;
    },

    // Smoothly flip a hidden card face up
    flipCard(cardElement, cardData) {
        if (!cardElement) return;
        const front = cardElement.querySelector('.card-front');
        if (front && cardData && cardData.rank && cardData.suit) {
            front.innerHTML = this.getCardFrontSVG(cardData.rank, cardData.suit);
        }
        cardElement.classList.remove('is-flipped');
        if (window.soundEngine) {
            window.soundEngine.playCardFlip();
        }
    }
};

window.CardRenderer = CardRenderer;
