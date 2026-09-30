// Procedural Web Audio synthesizer for LifeOS micro-interactions
// Requires no external audio files or dependencies.

class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    try {
      const stored = localStorage.getItem('lifeos_sound_enabled');
      this.enabled = stored !== null ? stored === 'true' : true;
    } catch {
      this.enabled = true;
    }
  }

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enable: boolean) {
    this.enabled = enable;
    try {
      localStorage.setItem('lifeos_sound_enabled', String(enable));
    } catch {
      // ignore
    }
  }

  // Soft tactile tick for buttons and steppers
  public playClick() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // Ignore audio errors gracefully
    }
  }

  // Harmonic chord chime when completing an individual goal
  public playComplete() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      // Pleasant major chord (C5, E5, G5, C6)
      const freqs = [523.25, 659.25, 783.99, 1046.5];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + idx * 0.045;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.08, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.36);
      });
    } catch {
      // Ignore
    }
  }

  // Grand celebratory arpeggio when concluding the entire Day Review
  public playCelebration() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const notes = [
        { f: 523.25, d: 0.1 },  // C5
        { f: 659.25, d: 0.1 },  // E5
        { f: 783.99, d: 0.1 },  // G5
        { f: 1046.5, d: 0.15 }, // C6
        { f: 1318.5, d: 0.4 },  // E6
      ];

      notes.forEach((note, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + idx * 0.08;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.f, start);

        gain.gain.setValueAtTime(0.1, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + note.d + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + note.d + 0.25);
      });
    } catch {
      // Ignore
    }
  }

  // Warm, calming singing bowl gong when completing evening reflection
  public playEveningBell() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      // Warm fundamental and harmonic overtones of a singing bowl
      const harmonics = [
        { f: 261.63, g: 0.12, d: 2.2 }, // C4
        { f: 523.25, g: 0.08, d: 1.8 }, // C5
        { f: 784.88, g: 0.04, d: 1.2 }, // G5
        { f: 1046.5, g: 0.02, d: 0.9 }, // C6
      ];

      harmonics.forEach(({ f, g, d }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, start);

        gain.gain.setValueAtTime(g, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + d);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + d + 0.05);
      });
    } catch {
      // Ignore
    }
  }

  // Uplifting, pleasant two-tone chime when a scheduled goal reminder triggers
  public playReminderChime() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const tones = [
        { f: 659.25, offset: 0, dur: 0.6 },    // E5
        { f: 987.77, offset: 0.14, dur: 0.9 }, // B5
      ];

      tones.forEach(({ f, offset, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + offset;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, start);

        gain.gain.setValueAtTime(0.09, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + dur + 0.05);
      });
    } catch {
      // Ignore
    }
  }

  // Protective crystalline shimmer chord when activating a Grace Day Shield
  public playShieldActivate() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      // Shimmering chord: G4, C5, E5, G5, B5
      const notes = [
        { f: 392.0, offset: 0, dur: 0.8, gain: 0.08 },
        { f: 523.25, offset: 0.06, dur: 0.9, gain: 0.09 },
        { f: 659.25, offset: 0.12, dur: 1.1, gain: 0.08 },
        { f: 783.99, offset: 0.18, dur: 1.3, gain: 0.07 },
        { f: 987.77, offset: 0.24, dur: 1.6, gain: 0.06 },
      ];

      notes.forEach(({ f, offset, dur, gain: g }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + offset;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, start);

        gain.gain.setValueAtTime(g, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + dur + 0.05);
      });
    } catch {
      // Ignore
    }
  }
}

export const sound = new SoundEngine();
