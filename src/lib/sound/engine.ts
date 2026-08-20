import type { DriveState } from "@/lib/drive/model";
import type {
  RhythmSpec,
  SignalSpec,
  SoundProfile,
  TextureSpec,
} from "@/lib/sound/profiles";

interface TextureNode {
  spec: TextureSpec;
  gain: GainNode;
  filter: BiquadFilterNode;
  src: AudioBufferSourceNode;
  lfo?: { osc: OscillatorNode; gain: GainNode };
}

interface RhythmClock {
  spec: RhythmSpec;
  next: number;
  step: number;
}

interface SignalClock {
  spec: SignalSpec;
  next: number;
}

/**
 * Motion-to-sound synthesis. Every profile consumes the same DriveState but maps
 * it through its own strategy (virtual transmission vs. continuous), layering a
 * tonal core, atmospheric beds, speed-locked rhythms and occasional signatures.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private meterBuffer: Float32Array<ArrayBuffer> | null = null;
  private body: GainNode | null = null;
  private accents: GainNode | null = null;
  private beds: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private voices: { osc: OscillatorNode; gain: GainNode; ratio: number }[] = [];
  private noise: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private lfo: { osc: OscillatorNode; gain: GainNode } | null = null;
  private textures: TextureNode[] = [];
  private rhythms: RhythmClock[] = [];
  private signals: SignalClock[] = [];
  private profile: SoundProfile | null = null;
  private volume = 0.7;
  /** per-profile balance gain, 0.4..1.6 */
  private profileGain = 1;
  private whiteBuffer: AudioBuffer | null = null;
  private pinkBuffer: AudioBuffer | null = null;
  private swapTimer: ReturnType<typeof setTimeout> | null = null;
  /** hard ceiling applied before the limiter so no profile can spike */
  static readonly MAX_GAIN = 0.85;

  get running() {
    return this.ctx !== null;
  }

  /** Per-profile balance so profiles sit at the same perceived level. */
  setProfileGain(gain: number) {
    this.profileGain = Math.min(1.6, Math.max(0.2, gain));
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(
        this.safeVolume(this.volume * this.profileGain * 0.8),
        this.ctx.currentTime,
        0.25,
      );
    }
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

    // Output chain: everything -> master -> limiter -> speakers.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 6;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(ctx.destination);

    // Metering tap: reads the post-limiter signal so the headroom meter shows
    // what actually reaches the speakers.
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.6;
    limiter.connect(analyser);

    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(limiter);

    const body = ctx.createGain();
    body.gain.value = 1;
    body.connect(master);

    const accents = ctx.createGain();
    accents.gain.value = 1;
    accents.connect(master);

    const beds = ctx.createGain();
    beds.gain.value = 1;
    beds.connect(master);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 300;
    filter.Q.value = 1.2;
    filter.connect(body);

    this.limiter = limiter;
    this.analyser = analyser;
    this.meterBuffer = new Float32Array(analyser.fftSize);
    this.master = master;
    this.body = body;
    this.accents = accents;
    this.beds = beds;
    this.filter = filter;

    // Startup: a soft ELCAMOSO signature, then the profile breathes in to idle.
    const withSignature = options?.signature !== false;
    const signatureEnd = withSignature ? this.playSignature() : ctx.currentTime + 0.4;
    this.setProfile(profile);
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.setTargetAtTime(
      this.safeVolume(this.volume * this.profileGain * 0.55),
      signatureEnd - 0.35,
      0.55,
    );
  }

  /**
   * Short, original ELCAMOSO sonic signature: two soft rising sines that open
   * outward like the O ))) mark. Deliberately not a starter-motor imitation.
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

  /* --------------------------------------------------------------- buffers */

  private getNoise(ctx: AudioContext, colour: "white" | "pink" = "white") {
    if (colour === "white") {
      if (!this.whiteBuffer) {
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
        this.whiteBuffer = buffer;
      }
      return this.whiteBuffer;
    }
    if (!this.pinkBuffer) {
      // Voss-McCartney style pink noise: much closer to water, wind and gravel.
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0;
      for (let i = 0; i < data.length; i += 1) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
      this.pinkBuffer = buffer;
    }
    return this.pinkBuffer;
  }

  /* -------------------------------------------------------- profile switch */

  /**
   * Switching profiles never jumps in loudness: the current body is faded out,
   * the new voices are built silently, then faded back in.
   */
  setProfile(profile: SoundProfile, force = false) {
    const ctx = this.ctx;
    const body = this.body;
    if (!ctx || !this.filter) {
      this.profile = profile;
      return;
    }
    if (!force && this.profile?.id === profile.id && this.voices.length) return;
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
      src.buffer = this.getNoise(ctx, "white");
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

    (profile.voice.textures ?? []).forEach((spec) => this.buildTexture(spec));

    const now = ctx.currentTime;
    this.rhythms = [profile.voice.rhythm, profile.voice.rhythmB]
      .filter((r): r is RhythmSpec => Boolean(r))
      .map((spec) => ({ spec, next: now + 0.2, step: 0 }));
    this.signals = (profile.voice.signals ?? []).map((spec) => ({
      spec,
      // stagger the first event so nothing fires the instant a drive starts
      next: now + 4 + Math.random() * spec.everySeconds,
    }));
  }

  /** Continuous atmospheric bed: water wash, wind, gravel, steam, crowd, rumble. */
  private buildTexture(spec: TextureSpec) {
    const ctx = this.ctx;
    const beds = this.beds;
    if (!ctx || !beds) return;

    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx, spec.kind === "sizzle" ? "white" : "pink");
    src.loop = true;
    src.playbackRate.value = spec.kind === "gravel" ? 1.35 : 1;

    const filter = ctx.createBiquadFilter();
    if (spec.kind === "rumble") {
      filter.type = "lowpass";
      filter.Q.value = 0.8;
    } else if (spec.kind === "water" || spec.kind === "crowd") {
      filter.type = "bandpass";
      filter.Q.value = spec.kind === "water" ? 0.6 : 1.1;
    } else if (spec.kind === "sizzle" || spec.kind === "steam") {
      filter.type = "highpass";
      filter.Q.value = 0.7;
    } else {
      filter.type = "bandpass";
      filter.Q.value = 0.9;
    }
    filter.frequency.value = spec.tone;

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(beds);
    src.start();

    const node: TextureNode = { spec, gain, filter, src };

    // Slow surge so water and wind breathe instead of sitting flat.
    if (spec.surge) {
      const osc = ctx.createOscillator();
      const depth = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = spec.surge;
      depth.gain.value = spec.level * 0.45;
      osc.connect(depth);
      depth.connect(gain.gain);
      osc.start();
      node.lfo = { osc, gain: depth };
    }

    this.textures.push(node);
  }

  setVolume(value: number) {
    this.volume = value;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(
        this.safeVolume(value * this.profileGain),
        this.ctx.currentTime,
        0.2,
      );
    }
  }

  /* ---------------------------------------------------------------- meter */

  /**
   * Live loudness reading. `headroom` is how much room is left before the
   * output ceiling (1 = silent, 0 = at the ceiling) and `reduction` shows how
   * hard the safety limiter is working.
   */
  getMeter(): { peak: number; rms: number; headroom: number; reduction: number } | null {
    const analyser = this.analyser;
    const buf = this.meterBuffer;
    if (!analyser || !buf) return null;
    analyser.getFloatTimeDomainData(buf);
    let peak = 0;
    let sum = 0;
    for (let i = 0; i < buf.length; i += 1) {
      const v = buf[i] ?? 0;
      const a = Math.abs(v);
      if (a > peak) peak = a;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);
    const ceiling = SoundEngine.MAX_GAIN;
    return {
      peak: Math.min(1, peak),
      rms: Math.min(1, rms),
      headroom: Math.max(0, 1 - Math.min(1, peak / ceiling)),
      reduction: this.limiter ? Math.abs(this.limiter.reduction) : 0,
    };
  }

  /* ------------------------------------------------------------- per-frame */

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

    this.updateTextures(state, t);

    if (this.master) {
      const duck = 1 - state.regen * 0.35;
      const target = this.safeVolume(
        this.volume * this.profileGain * (0.55 + state.load * 0.45) * duck,
      );
      this.master.gain.setTargetAtTime(target, t, 0.12);
    }

    this.rhythms.forEach((clock) => this.scheduleRhythm(clock, state));
    this.signals.forEach((clock) => this.scheduleSignal(clock, state));
  }

  private updateTextures(state: DriveState, t: number) {
    const kmh = state.speed * 3.6;
    this.textures.forEach(({ spec, gain, filter, src }) => {
      const follow = spec.speedScale ?? 1;
      const motion = Math.min(1, kmh / 90);
      const amount = spec.level * (1 - follow + follow * (0.12 + motion * 0.95));
      // regen adds hiss to water/wind: the sound of coasting
      const regenLift = spec.kind === "water" || spec.kind === "wind" ? state.regen * 0.2 : 0;
      gain.gain.setTargetAtTime(Math.max(0.0001, amount + regenLift), t, 0.35);
      filter.frequency.setTargetAtTime(spec.tone * (0.8 + motion * 0.6), t, 0.4);
      if (spec.kind === "gravel" || spec.kind === "water") {
        src.playbackRate.setTargetAtTime(0.85 + motion * 0.7, t, 0.5);
      }
    });
  }

  /* -------------------------------------------------------------- rhythms */

  /** Rhythmic events (hooves, wheels, bells, chuffs, splashes) that follow speed. */
  private scheduleRhythm(clock: RhythmClock, state: DriveState) {
    const ctx = this.ctx;
    if (!ctx || !this.accents) return;
    const spec = clock.spec;
    const horizon = ctx.currentTime + 0.3;
    if (clock.next < ctx.currentTime) clock.next = ctx.currentTime + 0.02;
    const rate = Math.max(0.25, spec.baseRate + spec.rateScale * state.load);
    const interval = 1 / rate;
    const level = spec.level * (0.35 + state.load * 0.85);

    while (clock.next < horizon) {
      this.fireAccent(spec.kind, clock.next, spec.tone, level, clock.step, state);
      clock.step += 1;
      const swing =
        spec.kind === "putt"
          ? clock.step % 2
            ? 0.62
            : 1.38
          : spec.kind === "clack" || spec.kind === "chug"
          ? clock.step % 2
            ? 0.74
            : 1.26
          : 1;
      clock.next += interval * swing;
    }
  }

  private fireAccent(
    kind: string,
    at: number,
    tone: number,
    level: number,
    step: number,
    state: DriveState,
  ) {
    switch (kind) {
      case "bell":
        return this.fireBell(at, tone, level, step);
      case "blat":
        return this.fireBlat(at, tone, level);
      case "gallop":
        return this.fireGallop(at, tone, level, state);
      case "splash":
        return this.fireSplash(at, tone, level, state);
      case "creak":
        return this.fireCreak(at, tone, level, step);
      case "laugh":
        return this.fireLaugh(at, tone, level, state);
      case "rotor":
        return this.fireRotor(at, tone, level, step, state);
      case "putt":
        return this.firePutt(at, tone, level, step);
      default:
        return this.fireBurst(kind, at, tone, level, step);
    }
  }

  /**
   * One rotor blade passing overhead: a low thump with the characteristic slap
   * of air, so the helicopter chops rather than hums.
   */
  private fireRotor(at: number, tone: number, level: number, step: number, state: DriveState) {
    const ctx = this.ctx;
    const out = this.bus();
    if (!ctx || !out) return;

    // body thump
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(tone * (step % 2 ? 1.08 : 1), at);
    osc.frequency.exponentialRampToValueAtTime(tone * 0.6, at + 0.09);
    og.gain.setValueAtTime(0.0001, at);
    og.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), at + 0.008);
    og.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
    osc.connect(og);
    og.connect(out);
    osc.start(at);
    osc.stop(at + 0.16);

    // blade slap: a short band of air pushed aside
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx, "white");
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(tone * 9, at);
    bp.frequency.exponentialRampToValueAtTime(tone * 4, at + 0.08);
    const sg = ctx.createGain();
    const slap = level * (0.4 + state.load * 0.6);
    sg.gain.setValueAtTime(0.0001, at);
    sg.gain.exponentialRampToValueAtTime(Math.max(0.0002, slap), at + 0.006);
    sg.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
    src.connect(bp);
    bp.connect(sg);
    sg.connect(out);
    src.start(at);
    src.stop(at + 0.14);
  }

  /** A single-cylinder tractor stroke: putt ... putt ... with a lazy offbeat. */
  private firePutt(at: number, tone: number, level: number, step: number) {
    const ctx = this.ctx;
    const out = this.bus();
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(tone * (step % 2 ? 0.94 : 1.06), at);
    osc.frequency.exponentialRampToValueAtTime(tone * 0.55, at + 0.13);
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(tone * 7, at);
    lp.frequency.exponentialRampToValueAtTime(tone * 2.4, at + 0.14);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(out);
    osc.start(at);
    osc.stop(at + 0.24);

    // exhaust puff through the stack
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx, "pink");
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.1;
    bp.frequency.value = tone * 5;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, at);
    sg.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 0.45), at + 0.012);
    sg.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    src.connect(bp);
    bp.connect(sg);
    sg.connect(out);
    src.start(at);
    src.stop(at + 0.2);
  }

  private bus() {
    return this.accents;
  }

  private fireBell(at: number, tone: number, level: number, step: number) {
    const ctx = this.ctx;
    const out = this.bus();
    if (!ctx || !out) return;
    // A sleigh bell is a small cluster of inharmonic partials, not one tone.
    const cluster = [1, 1.51, 2.13, 2.79];
    cluster.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(tone * ratio * (step % 3 === 0 ? 1.06 : 1), at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level / (i + 1.6)), at + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.26 + i * 0.05);
      osc.connect(gain);
      gain.connect(out);
      osc.start(at);
      osc.stop(at + 0.45);
    });
  }

  private fireBlat(at: number, tone: number, level: number) {
    const ctx = this.ctx;
    const out = this.bus();
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(tone * 1.4, at);
    osc.frequency.exponentialRampToValueAtTime(tone * 0.55, at + 0.34);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.4);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(out);
    osc.start(at);
    osc.stop(at + 0.45);
  }

  /** One hoof: a wooden knock with a short body resonance and a dust tail. */
  private hoof(at: number, tone: number, level: number, hard: boolean) {
    const ctx = this.ctx;
    const out = this.bus();
    if (!ctx || !out) return;

    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx, "white");
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(tone * (hard ? 1.25 : 0.9), at);
    bp.frequency.exponentialRampToValueAtTime(tone * 0.55, at + 0.06);
    bp.Q.value = 5;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * (hard ? 1 : 0.7)), at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.075);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(out);
    src.start(at);
    src.stop(at + 0.14);

    // wooden thump body
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(tone * 0.45, at);
    osc.frequency.exponentialRampToValueAtTime(tone * 0.28, at + 0.07);
    og.gain.setValueAtTime(0.0001, at);
    og.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 0.55), at + 0.006);
    og.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
    osc.connect(og);
    og.connect(out);
    osc.start(at);
    osc.stop(at + 0.14);
  }

  /** Four-beat gallop, the classic da-da-da-dum of a horse at pace. */
  private fireGallop(at: number, tone: number, level: number, state: DriveState) {
    const stride = 0.52 - Math.min(0.24, state.load * 0.3);
    const pattern = [0, 0.16, 0.34, 0.47];
    pattern.forEach((offset, i) => {
      this.hoof(at + offset * stride * 2, tone * (i % 2 ? 0.94 : 1.06), level, i === 3);
    });
  }

  /** Water displaced by a hull: a broadband wash with a low slap underneath. */
  private fireSplash(at: number, tone: number, level: number, state: DriveState) {
    const ctx = this.ctx;
    const out = this.bus();
    if (!ctx || !out) return;
    const dur = 0.32 + state.load * 0.2;

    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx, "pink");
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.5;
    bp.frequency.setValueAtTime(tone * 0.6, at);
    bp.frequency.exponentialRampToValueAtTime(tone * 2.4, at + dur * 0.7);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(out);
    src.start(at);
    src.stop(at + dur + 0.05);

    const thump = ctx.createOscillator();
    const tg = ctx.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(90, at);
    thump.frequency.exponentialRampToValueAtTime(48, at + 0.16);
    tg.gain.setValueAtTime(0.0001, at);
    tg.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 0.8), at + 0.01);
    tg.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    thump.connect(tg);
    tg.connect(out);
    thump.start(at);
    thump.stop(at + 0.26);
  }

  /** Timber under load: a slow, pitch-bending groan from a wooden cart. */
  private fireCreak(at: number, tone: number, level: number, step: number) {
    const ctx = this.ctx;
    const out = this.bus();
    if (!ctx || !out) return;
    const dur = 0.55;
    const osc = ctx.createOscillator();
    const bp = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const wobble = ctx.createOscillator();
    const wobbleDepth = ctx.createGain();

    osc.type = "sawtooth";
    const up = step % 2 === 0;
    osc.frequency.setValueAtTime(tone * (up ? 0.85 : 1.15), at);
    osc.frequency.linearRampToValueAtTime(tone * (up ? 1.2 : 0.8), at + dur);

    wobble.type = "sine";
    wobble.frequency.value = 7 + (step % 3);
    wobbleDepth.gain.value = 22;
    wobble.connect(wobbleDepth);
    wobbleDepth.connect(osc.detune);

    bp.type = "bandpass";
    bp.frequency.value = tone * 3.2;
    bp.Q.value = 6;

    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.14);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    osc.connect(bp);
    bp.connect(gain);
    gain.connect(out);
    osc.start(at);
    wobble.start(at);
    osc.stop(at + dur + 0.05);
    wobble.stop(at + dur + 0.05);
  }

  /**
   * A laugh: a run of vowel-shaped "ha" syllables on a falling pitch, built from
   * a buzzing source through two formant filters.
   */
  private fireLaugh(at: number, tone: number, level: number, state: DriveState) {
    const ctx = this.ctx;
    const out = this.bus();
    if (!ctx || !out) return;
    const syllables = 3 + Math.round(state.load * 4);
    const spacing = 0.155 - state.load * 0.03;

    for (let i = 0; i < syllables; i += 1) {
      const t0 = at + i * spacing;
      const pitch = tone * (1.12 - i * 0.045) * (1 + state.load * 0.35);
      const osc = ctx.createOscillator();
      const f1 = ctx.createBiquadFilter();
      const f2 = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(pitch * 1.06, t0);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.92, t0 + spacing * 0.8);

      f1.type = "bandpass";
      f1.frequency.value = 730; // "ah" formant
      f1.Q.value = 7;
      f2.type = "bandpass";
      f2.frequency.value = 1180;
      f2.Q.value = 9;

      const amp = level * (i === 0 ? 1 : 0.86 - i * 0.07);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), t0 + 0.022);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + spacing * 0.85);

      osc.connect(f1);
      f1.connect(f2);
      f2.connect(gain);
      gain.connect(out);
      osc.start(t0);
      osc.stop(t0 + spacing);

      // breath on each syllable
      const br = ctx.createBufferSource();
      br.buffer = this.getNoise(ctx, "pink");
      br.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 1600;
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.0001, t0);
      bg.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp * 0.3), t0 + 0.02);
      bg.gain.exponentialRampToValueAtTime(0.0001, t0 + spacing * 0.7);
      br.connect(hp);
      hp.connect(bg);
      bg.connect(out);
      br.start(t0);
      br.stop(t0 + spacing);
    }
  }

  /** Generic filtered-noise burst for clack (wheel on stone) and chug (steam). */
  private fireBurst(kind: string, at: number, tone: number, level: number, step: number) {
    const ctx = this.ctx;
    const out = this.bus();
    if (!ctx || !out) return;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx, kind === "clack" ? "white" : "pink");
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = kind === "clack" ? "bandpass" : "lowpass";
    bp.frequency.setValueAtTime(tone * (step % 2 ? 0.85 : 1.15), at);
    bp.Q.value = kind === "clack" ? 9 : 1;
    const decay = kind === "clack" ? 0.06 : 0.18;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(out);
    src.start(at);
    src.stop(at + decay + 0.05);

    if (kind === "clack") {
      // stone ring underneath an iron-rimmed wheel
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(tone * 1.9, at);
      og.gain.setValueAtTime(0.0001, at);
      og.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 0.4), at + 0.004);
      og.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
      osc.connect(og);
      og.connect(out);
      osc.start(at);
      osc.stop(at + 0.16);
    }
  }

  /* --------------------------------------------------------------- signals */

  private scheduleSignal(clock: SignalClock, state: DriveState) {
    const ctx = this.ctx;
    if (!ctx || !this.accents) return;
    if (ctx.currentTime < clock.next) return;
    const spec = clock.spec;
    const at = ctx.currentTime + 0.05;
    this.fireSignal(spec, at, state);
    const pace = spec.speedLinked ? 1 / (0.5 + state.load * 1.4) : 1;
    const jitter = (Math.random() - 0.5) * 2 * (spec.jitter ?? 0);
    clock.next = ctx.currentTime + Math.max(4, spec.everySeconds * pace + jitter);
  }

  private fireSignal(spec: SignalSpec, at: number, state: DriveState) {
    const ctx = this.ctx;
    const out = this.bus();
    if (!ctx || !out) return;
    const { kind, tone, level } = spec;

    if (kind === "laugh") {
      this.fireLaugh(at, tone, level, state);
      return;
    }

    if (kind === "hohoho") {
      // deep, warm and slow: three descending "ho" syllables
      for (let i = 0; i < 3; i += 1) {
        const t0 = at + i * 0.34;
        const osc = ctx.createOscillator();
        const f1 = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(tone * (1 - i * 0.06), t0);
        osc.frequency.linearRampToValueAtTime(tone * (0.88 - i * 0.06), t0 + 0.3);
        f1.type = "bandpass";
        f1.frequency.value = 480; // "oh" formant
        f1.Q.value = 5;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(level, t0 + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
        osc.connect(f1);
        f1.connect(gain);
        gain.connect(out);
        osc.start(t0);
        osc.stop(t0 + 0.34);
      }
      return;
    }

    if (kind === "horn") {
      // ship's horn: stacked low partials with a slow swell and long tail
      const dur = 3.4;
      [1, 1.5, 2.02, 3.01].forEach((ratio, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i === 0 ? "sawtooth" : "sine";
        osc.frequency.setValueAtTime(tone * ratio * 0.98, at);
        osc.frequency.linearRampToValueAtTime(tone * ratio, at + 0.6);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.linearRampToValueAtTime(level / (i + 1.3), at + 0.55);
        gain.gain.setValueAtTime(level / (i + 1.3), at + dur - 1.2);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(at);
        osc.stop(at + dur + 0.1);
      });
      return;
    }

    if (kind === "whistle") {
      const dur = 1.5;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const air = ctx.createBufferSource();
      const hp = ctx.createBiquadFilter();
      const ag = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(tone * 0.94, at);
      osc.frequency.linearRampToValueAtTime(tone, at + 0.3);
      osc.frequency.linearRampToValueAtTime(tone * 0.9, at + dur);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(level, at + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(gain);
      gain.connect(out);
      air.buffer = this.getNoise(ctx, "white");
      air.loop = true;
      hp.type = "highpass";
      hp.frequency.value = tone * 1.5;
      ag.gain.setValueAtTime(0.0001, at);
      ag.gain.exponentialRampToValueAtTime(level * 0.5, at + 0.16);
      ag.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      air.connect(hp);
      hp.connect(ag);
      ag.connect(out);
      osc.start(at);
      air.start(at);
      osc.stop(at + dur + 0.1);
      air.stop(at + dur + 0.1);
      return;
    }

    if (kind === "seagull") {
      for (let i = 0; i < 3; i += 1) {
        const t0 = at + i * 0.26;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(tone * 0.8, t0);
        osc.frequency.exponentialRampToValueAtTime(tone * 1.6, t0 + 0.07);
        osc.frequency.exponentialRampToValueAtTime(tone * 0.7, t0 + 0.2);
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = tone * 1.4;
        bp.Q.value = 4;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(level, t0 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
        osc.connect(bp);
        bp.connect(gain);
        gain.connect(out);
        osc.start(t0);
        osc.stop(t0 + 0.26);
      }
      return;
    }

    if (kind === "whip") {
      const src = ctx.createBufferSource();
      src.buffer = this.getNoise(ctx, "white");
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 2.5;
      bp.frequency.setValueAtTime(tone * 0.5, at);
      bp.frequency.exponentialRampToValueAtTime(tone * 2.2, at + 0.05);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(level, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
      src.connect(bp);
      bp.connect(gain);
      gain.connect(out);
      src.start(at);
      src.stop(at + 0.26);
      return;
    }

    if (kind === "neigh") {
      // a whinny: a bright vibrato tone that falls away into breath
      const dur = 0.9;
      const osc = ctx.createOscillator();
      const vib = ctx.createOscillator();
      const vibDepth = ctx.createGain();
      const bp = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(tone * 1.3, at);
      osc.frequency.exponentialRampToValueAtTime(tone * 0.72, at + dur);
      vib.type = "sine";
      vib.frequency.value = 18;
      vibDepth.gain.value = 90;
      vib.connect(vibDepth);
      vibDepth.connect(osc.detune);
      bp.type = "bandpass";
      bp.frequency.value = tone * 3;
      bp.Q.value = 3;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(level, at + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(bp);
      bp.connect(gain);
      gain.connect(out);
      osc.start(at);
      vib.start(at);
      osc.stop(at + dur + 0.05);
      vib.stop(at + dur + 0.05);
      return;
    }

    // beam: a soft sci-fi sweep
    const dur = 1.1;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    osc.type = "sine";
    osc.frequency.setValueAtTime(tone * 0.5, at);
    osc.frequency.exponentialRampToValueAtTime(tone * 2, at + dur * 0.8);
    lp.type = "lowpass";
    lp.frequency.value = tone * 4;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(out);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  /** Fires a profile's signature one-shot on demand (used by the Studio). */
  demoSignal(spec: SignalSpec, state: DriveState) {
    const ctx = this.ctx;
    if (!ctx) return;
    this.fireSignal(spec, ctx.currentTime + 0.05, state);
  }

  /* -------------------------------------------------------------- teardown */

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
    this.textures.forEach(({ src, lfo }) => {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      try {
        lfo?.osc.stop();
      } catch {
        /* already stopped */
      }
    });
    this.textures = [];
    this.rhythms = [];
    this.signals = [];
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
    this.analyser = null;
    this.meterBuffer = null;
    this.body = null;
    this.accents = null;
    this.beds = null;
    this.filter = null;
    this.profile = null;
  }
}
