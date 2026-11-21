export class SoundEngine {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  ensureContext() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setEnabled(val) {
    this.enabled = Boolean(val);
    if (this.enabled) this.ensureContext();
  }

  playTone({ freqStart, freqEnd, duration, type = "sine", gainPeak = 0.12, delay = 0 }) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (typeof freqEnd === "number") {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  fireProbe() {
    this.playTone({ freqStart: 780, freqEnd: 290, duration: 0.13, type: "triangle", gainPeak: 0.14 });
    this.playTone({ freqStart: 1240, freqEnd: 620, duration: 0.08, type: "sine", gainPeak: 0.07 });
  }

  probeHit(revealed = false) {
    if (revealed) {
      this.playTone({ freqStart: 440, freqEnd: 880, duration: 0.19, type: "sine", gainPeak: 0.15 });
      this.playTone({ freqStart: 660, freqEnd: 1320, duration: 0.15, type: "triangle", gainPeak: 0.09, delay: 0.04 });
    } else {
      this.playTone({ freqStart: 320, freqEnd: 180, duration: 0.11, type: "square", gainPeak: 0.08 });
    }
  }

  focusPulse() {
    this.playTone({ freqStart: 190, freqEnd: 540, duration: 0.34, type: "sawtooth", gainPeak: 0.09 });
  }

  collectShard() {
    this.playTone({ freqStart: 587.33, freqEnd: 987.77, duration: 0.14, type: "sine", gainPeak: 0.13 });
  }

  damageHit() {
    this.playTone({ freqStart: 165, freqEnd: 62, duration: 0.24, type: "sawtooth", gainPeak: 0.16 });
  }

  chamberUnlock() {
    this.playTone({ freqStart: 523.25, freqEnd: 523.25, duration: 0.11, type: "triangle", gainPeak: 0.12, delay: 0 });
    this.playTone({ freqStart: 659.25, freqEnd: 659.25, duration: 0.11, type: "triangle", gainPeak: 0.12, delay: 0.1 });
    this.playTone({ freqStart: 783.99, freqEnd: 1046.5, duration: 0.24, type: "sine", gainPeak: 0.14, delay: 0.2 });
  }
}
