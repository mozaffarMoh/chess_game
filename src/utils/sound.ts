export type SoundName =
  | 'move'
  | 'capture'
  | 'castle'
  | 'check'
  | 'promote'
  | 'win'
  | 'draw'
  | 'illegal';

const STORAGE_KEY = 'chess:muted';

/**
 * Sounds are synthesised with the Web Audio API rather than loaded as files:
 * no assets to ship, no network request, and nothing to fail at runtime.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  constructor() {
    try {
      this.muted = window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      window.localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    } catch {
      /* preference simply is not persisted */
    }
  }

  /** Browsers only allow audio to start inside a user gesture. */
  private context(): AudioContext | null {
    if (this.muted) return null;
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctor) return null;
        this.ctx = new Ctor();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  /** One shaped sine/triangle blip. */
  private tone(
    ctx: AudioContext,
    freq: number,
    start: number,
    duration: number,
    gain: number,
    type: OscillatorType = 'sine',
    endFreq?: number,
  ): void {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration);

    // A short attack and exponential decay reads as a "click" rather than a beep.
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(env).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  /** Filtered noise burst — the "knock" of a piece landing on the board. */
  private noise(ctx: AudioContext, start: number, duration: number, gain: number): void {
    const frames = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2600;

    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter).connect(env).connect(ctx.destination);
    source.start(start);
  }

  play(name: SoundName): void {
    const ctx = this.context();
    if (!ctx) return;

    const t = ctx.currentTime;

    switch (name) {
      case 'move':
        this.noise(ctx, t, 0.055, 0.16);
        this.tone(ctx, 220, t, 0.06, 0.05, 'sine');
        break;

      case 'capture':
        // Louder, grittier: a knock plus a low thud.
        this.noise(ctx, t, 0.09, 0.3);
        this.tone(ctx, 150, t, 0.11, 0.11, 'triangle', 90);
        break;

      case 'castle':
        // Two knocks — king, then rook.
        this.noise(ctx, t, 0.05, 0.16);
        this.noise(ctx, t + 0.1, 0.05, 0.16);
        break;

      case 'check':
        this.tone(ctx, 880, t, 0.13, 0.11, 'triangle');
        this.tone(ctx, 1170, t + 0.1, 0.16, 0.09, 'triangle');
        break;

      case 'promote':
        // Rising arpeggio.
        [523, 659, 784, 1047].forEach((f, i) =>
          this.tone(ctx, f, t + i * 0.075, 0.2, 0.09, 'triangle'),
        );
        break;

      case 'win':
        // Major fanfare.
        [523, 659, 784, 1047].forEach((f, i) =>
          this.tone(ctx, f, t + i * 0.11, 0.42, 0.12, 'triangle'),
        );
        this.tone(ctx, 1319, t + 0.44, 0.6, 0.1, 'sine');
        break;

      case 'draw':
        // Two flat, neutral tones.
        this.tone(ctx, 392, t, 0.3, 0.09, 'sine');
        this.tone(ctx, 349, t + 0.22, 0.42, 0.09, 'sine');
        break;

      case 'illegal':
        this.tone(ctx, 180, t, 0.13, 0.1, 'square', 120);
        break;
    }
  }
}

export const sound = new SoundEngine();
