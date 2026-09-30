// Procedural Web Audio Ambient Soundscapes Generator
// Generates Gentle Rain, White/Brown Noise, Cafe Hum, and Binaural Alpha Drone directly in the browser.
// Zero external audio files or downloads.

export type SoundscapeType = 'none' | 'rain' | 'noise' | 'cafe' | 'binaural';

class SoundscapeEngine {
  private ctx: AudioContext | null = null;
  private currentType: SoundscapeType = 'none';
  private gainNode: GainNode | null = null;
  private activeNodes: (AudioNode | { stop: () => void; disconnect: () => void })[] = [];
  private volume: number = 0.35; // default 35%

  private getContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public getCurrentType(): SoundscapeType {
    return this.currentType;
  }

  public stop() {
    this.activeNodes.forEach((node) => {
      try {
        if ('stop' in node && typeof node.stop === 'function') {
          node.stop();
        }
        if ('disconnect' in node && typeof node.disconnect === 'function') {
          node.disconnect();
        }
      } catch {
        // ignore
      }
    });
    this.activeNodes = [];
    this.currentType = 'none';
  }

  public play(type: SoundscapeType) {
    this.stop();
    if (type === 'none') return;

    const ctx = this.getContext();
    if (!ctx) return;

    this.currentType = type;
    this.gainNode = ctx.createGain();
    this.gainNode.gain.setValueAtTime(this.volume, ctx.currentTime);
    this.gainNode.connect(ctx.destination);

    if (type === 'rain') {
      this.generateRain(ctx, this.gainNode);
    } else if (type === 'noise') {
      this.generateBrownNoise(ctx, this.gainNode);
    } else if (type === 'cafe') {
      this.generateCafeHum(ctx, this.gainNode);
    } else if (type === 'binaural') {
      this.generateBinauralDrone(ctx, this.gainNode);
    }
  }

  // 1. Gentle Rain: Modulated pink noise with dual low-pass filters
  private generateRain(ctx: AudioContext, destination: GainNode) {
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Filter for soft rainfall sound
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, ctx.currentTime);

    // Subtle LFO modulation for raindrop intensity variation
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.3, ctx.currentTime);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(250, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    whiteNoise.connect(filter);
    filter.connect(destination);

    whiteNoise.start();
    lfo.start();

    this.activeNodes.push(whiteNoise, filter, lfo, lfoGain);
  }

  // 2. Brown Noise: Deep warm static for masking background chatter
  private generateBrownNoise(ctx: AudioContext, destination: GainNode) {
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5;
    }

    const brownSource = ctx.createBufferSource();
    brownSource.buffer = noiseBuffer;
    brownSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, ctx.currentTime);

    brownSource.connect(filter);
    filter.connect(destination);

    brownSource.start();
    this.activeNodes.push(brownSource, filter);
  }

  // 3. Cafe Hum: Warm acoustic drone with layered subtle harmonic overtones
  private generateCafeHum(ctx: AudioContext, destination: GainNode) {
    // Fundamental drone
    const baseDrone = ctx.createOscillator();
    baseDrone.type = 'triangle';
    baseDrone.frequency.setValueAtTime(110, ctx.currentTime); // A2

    const subDrone = ctx.createOscillator();
    subDrone.type = 'sine';
    subDrone.frequency.setValueAtTime(55, ctx.currentTime); // A1

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, ctx.currentTime);

    const humGain = ctx.createGain();
    humGain.gain.setValueAtTime(0.2, ctx.currentTime);

    baseDrone.connect(filter);
    subDrone.connect(filter);
    filter.connect(humGain);
    humGain.connect(destination);

    baseDrone.start();
    subDrone.start();

    this.activeNodes.push(baseDrone, subDrone, filter, humGain);
  }

  // 4. Binaural Alpha Calm: 216Hz & 226Hz sine waves creating a 10Hz Alpha beat
  private generateBinauralDrone(ctx: AudioContext, destination: GainNode) {
    const oscLeft = ctx.createOscillator();
    const oscRight = ctx.createOscillator();

    oscLeft.type = 'sine';
    oscLeft.frequency.setValueAtTime(216, ctx.currentTime);

    oscRight.type = 'sine';
    oscRight.frequency.setValueAtTime(226, ctx.currentTime); // 10Hz alpha difference

    const pannerLeft = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const pannerRight = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    if (pannerLeft && pannerRight) {
      pannerLeft.pan.setValueAtTime(-0.8, ctx.currentTime);
      pannerRight.pan.setValueAtTime(0.8, ctx.currentTime);

      oscLeft.connect(pannerLeft);
      oscRight.connect(pannerRight);
      pannerLeft.connect(destination);
      pannerRight.connect(destination);
      this.activeNodes.push(oscLeft, oscRight, pannerLeft, pannerRight);
    } else {
      oscLeft.connect(destination);
      oscRight.connect(destination);
      this.activeNodes.push(oscLeft, oscRight);
    }

    oscLeft.start();
    oscRight.start();
  }
}

export const soundscapes = new SoundscapeEngine();
