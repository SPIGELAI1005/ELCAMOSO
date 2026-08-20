import type { DriveState } from "@/lib/drive/model";
import type { SoundProfile } from "@/lib/sound/profiles";

/**
 * Motion-to-sound synthesis. Every profile consumes the same DriveState but maps
 * it through its own strategy (virtual transmission vs. continuous).
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private body: GainNode | null = null;
  private accents: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private voices: { osc: OscillatorNode; gain: GainNode; ratio: number }[] = [];
  private noise: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private lfo: { osc: OscillatorNode; gain: GainNode } | null = null;
  private profile: SoundProfile | null = null;
  private volume = 0.7;
  private nextRhythmTime = 0;
  private rhythmStep = 0;
  private noiseBuffer: AudioBuffer | null = null;
  private swapTimer: ReturnType<typeof setTimeout> | null = null;
  /** hard ceiling applied before the limiter so no profile can spike */
  static readonly MAX_GAIN = 0.85;

  get running() {
    return this.ctx !== null;
  }

  private safeVolume(value: number) {
    return Math.min(SoundEngine.MAX_GAIN, Math.max(0.0001, value));
  }

  async start(profile: SoundProfile, options?: { signature?: boolean }) {
    if (this.ctx) {
      this.setProfile(profile);
      return;
    }
    const ctx = new AudioContext();
    await ctx.resume();
    this.ctx = ctx;

    // Output chain: everything → master → limiter → speakers.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 6;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(limiter);

    const body = ctx.createGain();
    body.gain.value = 1;
    body.connect(master);

    const accents = ctx.createGain();
    accents.gain.value = 1;
    accents.connect(master);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 300;
    filter.Q.value = 1.2;
    filter.connect(body);

    this.limiter = limiter;
    this.master = master;
    this.body = body;
    this.accents = accents;
    this.filter = filter;

    // Startup: a soft ELCAMOSO signature, then the profile breathes in to idle.
    const signatureEnd = this.playSignature();
    this.setProfile(profile);
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.setTargetAtTime(this.safeVolume(this.volume * 0.55), signatureEnd - 0.35, 0.55);
  }


  /**
   * Short, original ELCAMOSO sonic signature — two soft rising sines that open
   * outward like the O))) mark. Deliberately not a starter-motor imitation.
   * Returns the time the signature finishes.
   */
  private playSignature() {
    const ctx = this.ctx;
    if (!ctx) return 0;
    const now = ctx.currentTime + 0.05;
    const bus = ctx.createGain();
    bus.gain.value = 0.5;
    bus.connect(this.limiter ?? ctx.destination);
    [392, 587.33].forEach((freq, i) => {
      const at = now + i * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * 0.75, at);
      osc.frequency.exponentialRampToValueAtTime(freq, at + 0.5);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.11, at + 0.16);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.0);
      osc.connect(gain);
      gain.connect(bus);
      osc.start(at);
      osc.stop(at + 1.1);
    });
    return now + 1.3;
  }

  private getNoiseBuffer(ctx: AudioContext) {
    if (!this.noiseBuffer) {
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }

  /**
   * Switching profiles never jumps in loudness: the current body is faded out,
   * the new voices are built silently, then faded back in.
   */
  setProfile(profile: SoundProfile) {
    const ctx = this.ctx;
    const body = this.body;
    if (!ctx || !this.filter) {
      this.profile = profile;
      return;
    }
    if (this.profile?.id === profile.id && this.voices.length) return;
    if (!this.voices.length || !body) {
      this.buildProfile(profile);
      return;
    }
    if (this.swapTimer) clearTimeout(this.swapTimer);
    const fade = 0.18;
    body.gain.cancelScheduledValues(ctx.currentTime);
    body.gain.setValueAtTime(body.gain.value, ctx.currentTime);
    body.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fade);
    this.swapTimer = setTimeout(() => {
      const c = this.ctx;
      if (!c || !this.body) return;
      this.buildProfile(profile);
      this.body.gain.setValueAtTime(0.0001, c.currentTime);
      this.body.gain.linearRampToValueAtTime(1, c.currentTime + 0.35);
    }, fade * 1000 + 30);
  }

  private buildProfile(profile: SoundProfile) {
    const ctx = this.ctx;
    const filter = this.filter;
    if (!ctx || !filter) {
      this.profile = profile;
      return;
    }
    this.teardownVoices();
    this.profile = profile;
    this.nextRhythmTime = ctx.currentTime + 0.2;
    this.rhythmStep = 0;

    profile.voice.harmonics.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? profile.voice.wave : "sawtooth";
      osc.detune.value = (i % 2 === 0 ? 1 : -1) * profile.voice.detune * (i + 1);
      osc.frequency.value = profile.voice.baseFrequency * ratio;
      gain.gain.value = 0.34 / (i + 1.4);
      osc.connect(gain);
      gain.connect(filter);
      osc.start();
      this.voices.push({ osc, gain, ratio });
    });

    if (profile.voice.noise > 0) {
      const src = ctx.createBufferSource();
      src.buffer = this.getNoiseBuffer(ctx);
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain);
      gain.connect(filter);
      src.start();
      this.noise = { src, gain };
    }

    const { lfoRate, lfoDepth, lfoTarget } = profile.voice;
    if (lfoRate && lfoDepth && lfoTarget) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = lfoRate;
      gain.gain.value = lfoDepth;
      osc.connect(gain);
      if (lfoTarget === "pitch") {
        this.voices.forEach(({ osc: v }) => gain.connect(v.detune));
      } else if (lfoTarget === "filter") {
        gain.connect(filter.frequency);
      } else if (this.body) {
        gain.gain.value = Math.min(0.5, lfoDepth / 100);
        gain.connect(this.body.gain);
      }
      osc.start();
      this.lfo = { osc, gain };
    }
  }

  setVolume(value: number) {
    this.volume = value;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(this.safeVolume(value), this.ctx.currentTime, 0.2);
    }
  }

  update(state: DriveState) {
    const ctx = this.ctx;
    const profile = this.profile;
    if (!ctx || !profile || !this.filter) return;
    const t = ctx.currentTime;
    const v = profile.voice;

    let fundamental: number;
    if (profile.drivetrainMode === "virtual-transmission") {
      fundamental = (state.rpm / 60) * (v.baseFrequency / 26);
    } else {
      fundamental = v.baseFrequency * (1 + state.load * 2.6 + state.throttle * 0.5);
    }
    fundamental = Math.max(18, Math.min(1600, fundamental));

    this.voices.forEach(({ osc, gain, ratio }, i) => {
      osc.frequency.setTargetAtTime(fundamental * ratio, t, 0.05);
      const brightness = 0.2 + state.load * 0.8;
      gain.gain.setTargetAtTime((0.3 / (i + 1.4)) * (i === 0 ? 1 : brightness), t, 0.12);
    });

    const cutoff = v.filterBase + v.filterRange * Math.pow(state.load, 0.8);
    this.filter.frequency.setTargetAtTime(cutoff, t, 0.08);
    this.filter.Q.setTargetAtTime(profile.drivetrainMode === "continuous" ? 4 : 1.2, t, 0.3);

    if (this.lfo && v.lfoRate) {
      this.lfo.osc.frequency.setTargetAtTime(v.lfoRate * (0.7 + state.load * 1.2), t, 0.2);
    }

    if (this.noise) {
      const level = v.noise * (0.25 + state.load * 0.9) + state.regen * v.noise * 0.6;
      this.noise.gain.gain.setTargetAtTime(level * 0.35, t, 0.15);
    }

    if (this.master) {
      const duck = 1 - state.regen * 0.35;
      const target = this.safeVolume(this.volume * (0.55 + state.load * 0.45) * duck);
      this.master.gain.setTargetAtTime(target, t, 0.12);
    }

    if (v.rhythm) this.scheduleRhythm(state);
  }

  /** Rhythmic accents (hooves, bells, chuffs, blats) that follow speed. */
  private scheduleRhythm(state: DriveState) {
    const ctx = this.ctx;
    const spec = this.profile?.voice.rhythm;
    if (!ctx || !spec || !this.accents) return;
    const horizon = ctx.currentTime + 0.25;
    if (this.nextRhythmTime < ctx.currentTime) this.nextRhythmTime = ctx.currentTime + 0.02;
    const rate = Math.max(0.4, spec.baseRate + spec.rateScale * state.load);
    const interval = 1 / rate;
    const level = spec.level * (0.35 + state.load * 0.85);

    while (this.nextRhythmTime < horizon) {
      this.fireAccent(spec.kind, this.nextRhythmTime, spec.tone, level, this.rhythmStep);
      this.rhythmStep += 1;
      // gallop / chuff feel: alternate slightly uneven spacing
      const swing = spec.kind === "clack" || spec.kind === "chug" ? (this.rhythmStep % 2 ? 0.72 : 1.28) : 1;
      this.nextRhythmTime += interval * swing;
    }
  }

  private fireAccent(
    kind: string,
    at: number,
    tone: number,
    level: number,
    step: number,
  ) {
    const ctx = this.ctx;
    const out = this.accents;
    if (!ctx || !out) return;
    const gain = ctx.createGain();
    gain.connect(out);
    gain.gain.setValueAtTime(0.0001, at);

    if (kind === "bell") {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(tone * (step % 3 === 0 ? 1.26 : 1), at);
      gain.gain.exponentialRampToValueAtTime(level, at + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
      osc.connect(gain);
      osc.start(at);
      osc.stop(at + 0.3);
      return;
    }

    if (kind === "blat") {
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 700;
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(tone * 1.4, at);
      osc.frequency.exponentialRampToValueAtTime(tone * 0.55, at + 0.34);
      gain.gain.linearRampToValueAtTime(level, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.4);
      osc.connect(lp);
      lp.connect(gain);
      osc.start(at);
      osc.stop(at + 0.45);
      return;
    }

    // clack (hooves / wood) and chug (steam, outboard) are filtered noise bursts
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = kind === "clack" ? "bandpass" : "lowpass";
    bp.frequency.setValueAtTime(tone * (step % 2 ? 0.85 : 1.15), at);
    bp.Q.value = kind === "clack" ? 7 : 1;
    const decay = kind === "clack" ? 0.07 : 0.16;
    gain.gain.exponentialRampToValueAtTime(level, at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    src.connect(bp);
    bp.connect(gain);
    src.start(at);
    src.stop(at + decay + 0.05);
  }

  private teardownVoices() {
    this.voices.forEach(({ osc }) => {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
    });
    this.voices = [];
    if (this.noise) {
      try {
        this.noise.src.stop();
      } catch {
        /* already stopped */
      }
      this.noise = null;
    }
    if (this.lfo) {
      try {
        this.lfo.osc.stop();
      } catch {
        /* already stopped */
      }
      this.lfo = null;
    }
  }

  async stop() {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.swapTimer) clearTimeout(this.swapTimer);
    this.swapTimer = null;
    if (this.master) this.master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
    await new Promise((r) => setTimeout(r, 380));
    this.teardownVoices();
    await ctx.close();
    this.ctx = null;
    this.master = null;
    this.limiter = null;
    this.body = null;
    this.accents = null;
    this.filter = null;
    this.profile = null;
  }
}
