/**
 * Royal Casino Blackjack - 3D Casino Chips Renderer
 * Realistic clay composite chips with edge stripes and 3D stacking.
 */

const ChipRenderer = {
    denominations: [
        { value: 1000, name: '1K', bg: '#f59e0b', ring: '#d97706', stripe: '#fef3c7', text: '#78350f', label: '$1,000' },
        { value: 500,  name: '500', bg: '#7c3aed', ring: '#5b21b6', stripe: '#ede9fe', text: '#ffffff', label: '$500' },
        { value: 100,  name: '100', bg: '#18181b', ring: '#09090b', stripe: '#f43f5e', text: '#ffffff', label: '$100' },
        { value: 50,   name: '50',  bg: '#2563eb', ring: '#1d4ed8', stripe: '#dbeafe', text: '#ffffff', label: '$50' },
        { value: 25,   name: '25',  bg: '#16a34a', ring: '#15803d', stripe: '#dcfce7', text: '#ffffff', label: '$25' },
        { value: 5,    name: '5',   bg: '#dc2626', ring: '#b91c1c', stripe: '#fee2e2', text: '#ffffff', label: '$5' },
    ],

    getChipConfig(value) {
        return this.denominations.find(d => d.value === value) || this.denominations[denominations.length - 1];
    },

    getChipSVG(val, size = 64) {
        const d = this.getChipConfig(val);
        const radius = 30;
        const center = 32;

        return `
        <svg viewBox="0 0 64 64" width="${size}" height="${size}" class="casino-chip-svg" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <radialGradient id="chipBaseGrad_${d.value}" cx="35%" cy="35%" r="65%">
                    <stop offset="0%" stop-color="${d.bg}"/>
                    <stop offset="70%" stop-color="${d.ring}"/>
                    <stop offset="100%" stop-color="#0a0a0c"/>
                </radialGradient>
                <linearGradient id="goldRim_${d.value}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#fef08a"/>
                    <stop offset="50%" stop-color="#ca8a04"/>
                    <stop offset="100%" stop-color="#854d0e"/>
                </linearGradient>
                <filter id="chipShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="rgba(0,0,0,0.5)"/>
                </filter>
            </defs>

            <!-- Outer Base Disc -->
            <circle cx="${center}" cy="${center}" r="${radius}" fill="url(#chipBaseGrad_${d.value})" filter="url(#chipShadow)" stroke="#27272a" stroke-width="1"/>

            <!-- Edge Notches (Authentic Striped Clay Casino Chip) -->
            <g stroke="${d.stripe}" stroke-width="3" stroke-dasharray="6, 9.7" fill="none">
                <circle cx="${center}" cy="${center}" r="27.5"/>
            </g>

            <!-- Inner Gold Accent Ring -->
            <circle cx="${center}" cy="${center}" r="22" fill="none" stroke="url(#goldRim_${d.value})" stroke-width="1.2"/>

            <!-- Center Inlay Disc -->
            <circle cx="${center}" cy="${center}" r="17" fill="#ffffff" stroke="${d.ring}" stroke-width="1.5"/>
            <circle cx="${center}" cy="${center}" r="14.5" fill="none" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="2,2"/>

            <!-- Denomination Text -->
            <text x="${center}" y="${center + 4}" font-family="'Cinzel', 'Arial Black', sans-serif" font-size="12" font-weight="900" fill="${d.text === '#ffffff' ? d.ring : d.text}" text-anchor="middle">
                $${d.name}
            </text>
        </svg>
        `;
    },

    // Breaks down an amount into a stack of physical chips (up to max 8 rendered for performance & height)
    breakdownAmount(amount) {
        if (amount <= 0) return [];
        let remaining = amount;
        const stack = [];

        for (const denom of this.denominations) {
            while (remaining >= denom.value && stack.length < 8) {
                stack.push(denom.value);
                remaining -= denom.value;
            }
        }
        // If remaining still > 0 because of max stack limit, we still show the top chips
        return stack;
    },

    // Renders the visual stacked chips inside a betting spot
    renderChipStack(container, amount) {
        container.innerHTML = '';
        if (amount <= 0) {
            container.classList.remove('has-chips');
            return;
        }

        container.classList.add('has-chips');
        const stackWrapper = document.createElement('div');
        stackWrapper.className = 'chip-stack-wrapper';

        const chips = this.breakdownAmount(amount);
        // Render chips from bottom to top
        chips.forEach((val, idx) => {
            const chipEl = document.createElement('div');
            chipEl.className = 'stacked-chip';
            chipEl.style.transform = `translateY(-${idx * 4}px)`;
            chipEl.style.zIndex = idx + 1;
            chipEl.innerHTML = this.getChipSVG(val, 48);
            stackWrapper.appendChild(chipEl);
        });

        // Amount badge floating above the stack
        const badge = document.createElement('div');
        badge.className = 'chip-amount-badge';
        badge.textContent = `$${amount.toLocaleString()}`;
        badge.style.transform = `translateY(-${chips.length * 4 + 8}px)`;
        stackWrapper.appendChild(badge);

        container.appendChild(stackWrapper);
    },

    // Animate a chip flying from a source button to the target betting spot
    animateChipToss(sourceElement, targetContainer, value) {
        if (!sourceElement || !targetContainer) return;

        const srcRect = sourceElement.getBoundingClientRect();
        const tgtRect = targetContainer.getBoundingClientRect();

        const flyingChip = document.createElement('div');
        flyingChip.className = 'flying-chip-anim';
        flyingChip.innerHTML = this.getChipSVG(value, 52);
        document.body.appendChild(flyingChip);

        const startX = srcRect.left + srcRect.width / 2 - 26;
        const startY = srcRect.top + srcRect.height / 2 - 26;
        const endX = tgtRect.left + tgtRect.width / 2 - 26;
        const endY = tgtRect.top + tgtRect.height / 2 - 26;

        flyingChip.style.left = `${startX}px`;
        flyingChip.style.top = `${startY}px`;

        if (window.soundEngine) {
            window.soundEngine.playChipSound();
        }

        requestAnimationFrame(() => {
            flyingChip.style.transition = 'all 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)';
            flyingChip.style.left = `${endX}px`;
            flyingChip.style.top = `${endY}px`;
            flyingChip.style.transform = 'scale(0.85) rotate(180deg)';
            flyingChip.style.opacity = '0.9';

            setTimeout(() => {
                if (flyingChip.parentNode) {
                    flyingChip.parentNode.removeChild(flyingChip);
                }
            }, 360);
        });
    }
};

window.ChipRenderer = ChipRenderer;
