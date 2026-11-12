/**
 * Royal Casino Blackjack - Procedural Web Audio Synthesizer
 * High-fidelity casino sound effects without any external audio files.
 */

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.7;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    setVolume(val) {
        this.volume = Math.max(0, Math.min(1, val));
    }

    // Helper: Create a master gain node
    getMasterGain() {
        if (!this.ctx || !this.enabled) return null;
        const gain = this.ctx.createGain();
        gain.gain.value = this.volume;
        gain.connect(this.ctx.destination);
        return gain;
    }

    // 1. Ceramic Casino Chip Click / Drop
    playChipSound() {
        this.init();
        const master = this.getMasterGain();
        if (!master) return;

        const now = this.ctx.currentTime;
        const count = Math.floor(Math.random() * 2) + 1;

        for (let i = 0; i < count; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            const freq = 2100 + (Math.random() * 600 - 300) + (i * 200);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + i * 0.04);

            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(freq, now + i * 0.04);
            filter.Q.value = 12;

            gain.gain.setValueAtTime(0.001, now + i * 0.04);
            gain.gain.exponentialRampToValueAtTime(0.4, now + i * 0.04 + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.04 + 0.08);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(master);

            osc.start(now + i * 0.04);
            osc.stop(now + i * 0.04 + 0.09);
        }
    }

    // 2. Chip Stack / Collect Cascade
    playChipsCollect() {
        this.init();
        const master = this.getMasterGain();
        if (!master) return;

        const now = this.ctx.currentTime;
        for (let i = 0; i < 6; i++) {
            setTimeout(() => this.playChipSound(), i * 45 + Math.random() * 15);
        }
    }

    // 3. Card Sliding from Shoe
    playCardSlide() {
        this.init();
        const master = this.getMasterGain();
        if (!master) return;

        const now = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 0.18;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1400, now);
        filter.frequency.exponentialRampToValueAtTime(600, now + 0.16);
        filter.Q.value = 3.5;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(master);

        noise.start(now);
    }

    // 4. Card Flip Snap
    playCardFlip() {
        this.init();
        const master = this.getMasterGain();
        if (!master) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.07);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(master);

        osc.start(now);
        osc.stop(now + 0.09);
        this.playCardSlide();
    }

    // 5. Normal Win Fanfare (Pleasant Casino Chime)
    playWinFanfare() {
        this.init();
        const master = this.getMasterGain();
        if (!master) return;

        const now = this.ctx.currentTime;
        // C5, E5, G5, C6 arpeggio
        const notes = [523.25, 659.25, 783.99, 1046.50];

        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const start = now + idx * 0.09;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);

            gain.gain.setValueAtTime(0.001, start);
            gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);

            osc.connect(gain);
            gain.connect(master);

            osc.start(start);
            osc.stop(start + 0.48);
        });

        setTimeout(() => this.playChipsCollect(), 350);
    }

    // 6. Natural Blackjack Fanfare (Grand Casino Celebration)
    playBlackjackSound() {
        this.init();
        const master = this.getMasterGain();
        if (!master) return;

        const now = this.ctx.currentTime;
        const chords = [
            [523.25, 659.25, 783.99],       // C Maj
            [587.33, 739.99, 880.00],       // D Maj
            [659.25, 830.61, 987.77],       // E Maj
            [1046.50, 1318.51, 1567.98]     // High C Maj
        ];

        chords.forEach((chord, step) => {
            const start = now + step * 0.12;
            chord.forEach((freq) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, start);

                gain.gain.setValueAtTime(0.001, start);
                gain.gain.exponentialRampToValueAtTime(0.25, start + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.0001, start + (step === 3 ? 0.8 : 0.28));

                osc.connect(gain);
                gain.connect(master);

                osc.start(start);
                osc.stop(start + (step === 3 ? 0.85 : 0.3));
            });
        });

        setTimeout(() => this.playChipsCollect(), 500);
    }

    // 7. Bust Sound (Dramatic low drop)
    playBustSound() {
        this.init();
        const master = this.getMasterGain();
        if (!master) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.35);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(350, now);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(master);

        osc.start(now);
        osc.stop(now + 0.4);
    }

    // 8. Countdown Warning Tick
    playTick() {
        this.init();
        const master = this.getMasterGain();
        if (!master) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(900, now);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(master);

        osc.start(now);
        osc.stop(now + 0.05);
    }

    // 9. Standard UI Click / Confirm
    playClick() {
        this.init();
        const master = this.getMasterGain();
        if (!master) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(master);

        osc.start(now);
        osc.stop(now + 0.05);
    }

    playEvent(eventName) {
        if (!this.enabled) return;
        switch (eventName) {
            case 'card_slide':
                this.playCardSlide();
                break;
            case 'card_flip':
                this.playCardFlip();
                break;
            case 'chip_click':
            case 'confirm':
            case 'chip_double':
                this.playChipSound();
                break;
            case 'chips_ready':
            case 'chips_collect':
            case 'rebuy':
                this.playChipsCollect();
                break;
            case 'win_fanfare':
                this.playWinFanfare();
                break;
            case 'blackjack':
            case 'dealer_blackjack':
                this.playBlackjackSound();
                break;
            case 'bust':
                this.playBustSound();
                break;
            case 'stand':
                this.playClick();
                break;
            case 'split':
                this.playCardFlip();
                this.playChipSound();
                break;
            case 'tick':
                this.playTick();
                break;
            default:
                break;
        }
    }
}

window.soundEngine = new SoundEngine();
