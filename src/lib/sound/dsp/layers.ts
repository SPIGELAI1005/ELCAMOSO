/**
 * Reusable motion-sound layer primitives.
 * Each factory returns a LayerHandle with independent gain, pitch, filter,
 * stereo width, drive and an update(MotionFrame) hook.
 */

import { clamp, lerp, softGate, smoothstep } from "@/lib/sound/dsp/math";
import { createLoopingNoise, getNoiseBuffer, type NoiseColor } from "@/lib/sound/dsp/noise";
import { targetParam } from "@/lib/sound/dsp/smoother";
import { createDriveShaper } from "@/lib/sound/dsp/waveshaper";
import { audioRandom } from "@/lib/sound/rng";
import type { MotionFrame } from "@/lib/sound/realism/types";

export interface LayerHandle {
  id: string;
  input: GainNode;
  output: GainNode;
  update: (m: MotionFrame, t: number) => void;
  dispose: () => void;
  setMuted: (muted: boolean) => void;
  setSoloed: (soloed: boolean | null) => void;
  /** Optional manual accent (e.g. sonar ping). */
  trigger?: () => void;
}

interface LayerBaseOpts {
  id: string;
  destination: AudioNode;
  level?: number;
  pan?: number;
}

function attachChain(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts,
  sourceOut: AudioNode,
): {
  gain: GainNode;
  panner: StereoPannerNode;
  handle: Omit<LayerHandle, "update" | "dispose"> & {
    gain: GainNode;
    panner: StereoPannerNode;
    muted: boolean;
    soloed: boolean | null;
    applyGate: () => void;
  };
} {
  const gain = ctx.createGain();
  gain.gain.value = opts.level ?? 0.0001;
  const panner = ctx.createStereoPanner();
  panner.pan.value = opts.pan ?? 0;
  const output = ctx.createGain();
  output.gain.value = 1;
  sourceOut.connect(gain);
  gain.connect(panner);
  panner.connect(output);
  output.connect(opts.destination);

  const state = {
    muted: false,
    soloed: null as boolean | null,
    applyGate() {
      const silence = state.muted || (state.soloed === false);
      output.gain.value = silence ? 0.0001 : 1;
    },
  };

  return {
    gain,
    panner,
    handle: {
      id: opts.id,
      input: gain,
      output,
      gain,
      panner,
      muted: false,
      soloed: null,
      applyGate: state.applyGate,
      setMuted(muted: boolean) {
        state.muted = muted;
        state.applyGate();
      },
      setSoloed(soloed: boolean | null) {
        state.soloed = soloed;
        state.applyGate();
      },
    },
  };
}

function stopSafe(node: { stop: (when?: number) => void }) {
  try {
    node.stop();
  } catch {
    /* already stopped */
  }
}

/* ------------------------------------------------------------------ harmonic */

export interface HarmonicEngineOpts extends LayerBaseOpts {
  ratios: number[];
  weights?: number[];
  wave?: OscillatorType;
  detuneCents?: number;
  drive?: number;
  filterBase?: number;
  filterQ?: number;
  /** Soft ceiling so bright profiles stay comfortable on phones. */
  filterCeiling?: number;
}

export function createHarmonicEngineLayer(
  ctx: BaseAudioContext,
  opts: HarmonicEngineOpts,
): LayerHandle {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = opts.filterBase ?? 400;
  filter.Q.value = opts.filterQ ?? 1.1;
  const drive = createDriveShaper(ctx, opts.drive ?? 0.25);
  filter.connect(drive);
  const { gain, panner, handle } = attachChain(ctx, opts, drive);

  const voices = opts.ratios.map((ratio, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const weight = opts.weights?.[i] ?? 1 / (i + 1.35);
    osc.type = opts.wave ?? (i === 0 ? "sawtooth" : "sawtooth");
    osc.detune.value = (i % 2 === 0 ? 1 : -1) * (opts.detuneCents ?? 4) * (i + 1);
    osc.frequency.value = 40 * ratio;
    g.gain.value = weight;
    osc.connect(g);
    g.connect(filter);
    osc.start();
    return { osc, g, ratio, weight };
  });

  let disposed = false;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const fund = Math.max(18, m.engineFundamentalHz);
      const bright = 0.18 + m.throttleFast * 0.55 + m.rpmNorm * 0.45;
      voices.forEach(({ osc, g, ratio, weight }, i) => {
        targetParam(osc.frequency, fund * ratio, t, m.pitchTau);
        const upper = i < 2 ? 1 : bright;
        targetParam(g.gain, weight * upper * (1 - m.shiftDip * 0.7), t, 0.08);
      });
      const cut =
        (opts.filterBase ?? 400) +
        m.rpmNorm * 2800 +
        m.throttleFast * 1800 -
        m.regen * 400;
      const ceiling = opts.filterCeiling ?? 9000;
      targetParam(filter.frequency, clamp(cut, 80, ceiling), t, 0.07);
      targetParam(gain.gain, softGate((opts.level ?? 0.4) * m.bodyLevel * (1 - m.shiftDip * 0.5)), t, 0.1);
      targetParam(panner.pan, Math.sin(t * 0.11) * 0.08 * m.stereoWidth, t, 0.4);
    },
    dispose() {
      disposed = true;
      voices.forEach(({ osc }) => stopSafe(osc));
    },
  };
}

/* ----------------------------------------------------------- combustion pulse */

export interface CombustionPulseOpts extends LayerBaseOpts {
  cylinders?: number;
  tone?: number;
  /** Scale virtual RPM for firing rate (historic slow engines). */
  rpmScale?: number;
  maxFireHz?: number;
  /** 0..1 uneven stroke amplitude/timing (muscle idle lump). */
  lumpiness?: number;
  /** Extra body at low rpmNorm so idle stays present. */
  idlePresence?: number;
}

export function createCombustionPulseLayer(
  ctx: BaseAudioContext,
  opts: CombustionPulseOpts,
): LayerHandle {
  const bus = ctx.createGain();
  bus.gain.value = 1;
  const { gain, panner, handle } = attachChain(ctx, opts, bus);
  const cylinders = opts.cylinders ?? 8;
  const tone = opts.tone ?? 90;
  const lump = clamp(opts.lumpiness ?? 0);
  const idlePresence = opts.idlePresence ?? 0;
  let next = 0;
  let stroke = 0;
  let disposed = false;

  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const rpm = Math.max(200, m.virtualRpm * (opts.rpmScale ?? 1));
      // four-stroke: firing rate = rpm * cylinders / 120
      const fireHz = Math.min(
        opts.maxFireHz ?? 40,
        (rpm * cylinders) / 120,
      );
      const interval = 1 / Math.max(1, fireHz);
      if (next < t) next = t;
      const horizon = t + 0.12;
      const idleFactor = 1 - m.rpmNorm;
      const liveLump = lump * (0.45 + idleFactor * 0.85);
      while (next < horizon) {
        const at = next;
        const micro = 1 + (audioRandom() - 0.5) * (0.02 + liveLump * 0.1);
        const alternate = stroke % 2 === 0 ? 1 : 0.92 - liveLump * 0.38;
        // Occasional missed/soft stroke at idle for lumpy character.
        const drop = liveLump > 0.3 && idleFactor > 0.55 && audioRandom() < liveLump * 0.12 ? 0.35 : 1;
        const strength =
          (0.55 + audioRandom() * (0.2 + liveLump * 0.15)) *
          alternate *
          drop *
          (0.45 + m.throttleFast * 0.7 + idlePresence * idleFactor * 0.35) *
          (1 - m.shiftDip);

        const osc = ctx.createOscillator();
        const og = ctx.createGain();
        const lp = ctx.createBiquadFilter();
        osc.type = "sine";
        const f0 = tone * micro * (0.9 + m.rpmNorm * 0.35);
        osc.frequency.setValueAtTime(f0, at);
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, f0 * 0.55), at + 0.05);
        lp.type = "lowpass";
        lp.frequency.value = 220 + m.throttleFast * 400;
        og.gain.setValueAtTime(0.0001, at);
        og.gain.exponentialRampToValueAtTime(Math.max(0.0002, strength * 0.55), at + 0.004);
        og.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
        osc.connect(lp);
        lp.connect(og);
        og.connect(bus);
        osc.start(at);
        osc.stop(at + 0.09);

        // exhaust pressure puff
        const puff = createLoopingNoise(ctx, "brown", 1);
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 140 + m.rpmNorm * 120;
        bp.Q.value = 1.2;
        const pg = ctx.createGain();
        pg.gain.setValueAtTime(0.0001, at);
        pg.gain.exponentialRampToValueAtTime(Math.max(0.0002, strength * 0.35), at + 0.006);
        pg.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
        puff.connect(bp);
        bp.connect(pg);
        pg.connect(bus);
        puff.start(at);
        puff.stop(at + 0.1);

        stroke += 1;
        // Stretch gaps more at idle when lumpy.
        next += interval * micro * (1 + liveLump * idleFactor * (audioRandom() * 0.35));
      }
      const body =
        (opts.level ?? 0.35) *
        (0.28 + m.rpmNorm * 0.75 + idlePresence * idleFactor * 0.4);
      targetParam(gain.gain, softGate(body), t, 0.12);
      targetParam(panner.pan, (audioRandom() - 0.5) * 0.05, t, 0.5);
    },
    dispose() {
      disposed = true;
    },
  };
}

/* -------------------------------------------------------------- mechanical */

export function createMechanicalLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts & { tone?: number },
): LayerHandle {
  const src = createLoopingNoise(ctx, "white", 1.4);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = opts.tone ?? 1400;
  bp.Q.value = 2.4;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 600;
  src.connect(hp);
  hp.connect(bp);
  const { gain, panner, handle } = attachChain(ctx, opts, bp);
  src.start();
  let disposed = false;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const level =
        (opts.level ?? 0.08) *
        (0.15 + m.rpmNorm * 0.7 + m.throttleFast * 0.25) *
        (1 - m.shiftDip * 0.4);
      targetParam(gain.gain, softGate(level), t, 0.15);
      targetParam(bp.frequency, (opts.tone ?? 1400) * (0.85 + m.rpmNorm * 0.4), t, 0.2);
      targetParam(panner.pan, Math.sin(t * 0.37) * 0.25 * m.stereoWidth, t, 0.3);
    },
    dispose() {
      disposed = true;
      stopSafe(src);
    },
  };
}

/* ---------------------------------------------------------- filtered noise */

export function createFilteredNoiseLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts & {
    color?: NoiseColor;
    filterType?: BiquadFilterType;
    tone?: number;
    q?: number;
    rate?: number;
    /** Extra weight for throttle (nasal rasp under load). */
    throttleWeight?: number;
    speedWeight?: number;
  },
): LayerHandle {
  const src = createLoopingNoise(ctx, opts.color ?? "pink", opts.rate ?? 1);
  const filter = ctx.createBiquadFilter();
  filter.type = opts.filterType ?? "bandpass";
  filter.frequency.value = opts.tone ?? 1000;
  filter.Q.value = opts.q ?? 0.8;
  src.connect(filter);
  const { gain, panner, handle } = attachChain(ctx, opts, filter);
  src.start();
  let disposed = false;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const motion = m.speedSlow;
      const sw = opts.speedWeight ?? 0.95;
      const tw = opts.throttleWeight ?? 0.2;
      const level =
        (opts.level ?? 0.2) *
        (0.1 + motion * sw + m.throttleFast * tw + m.accelFast * tw * 0.35);
      targetParam(gain.gain, softGate(level), t, 0.25);
      targetParam(filter.frequency, (opts.tone ?? 1000) * (0.75 + motion * 0.7), t, 0.35);
      src.playbackRate.setTargetAtTime(0.85 + motion * 0.6, t, 0.4);
      targetParam(panner.pan, Math.sin(t * 0.19 + (opts.pan ?? 0)) * 0.55 * m.stereoWidth, t, 0.45);
    },
    dispose() {
      disposed = true;
      stopSafe(src);
    },
  };
}

/* -------------------------------------------------------------------- wind */

export function createWindLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts & { bands?: { tone: number; level: number; q?: number }[] },
): LayerHandle {
  const bus = ctx.createGain();
  const bands = opts.bands ?? [
    { tone: 280, level: 0.35, q: 0.7 },
    { tone: 1200, level: 0.55, q: 0.8 },
    { tone: 3400, level: 0.28, q: 0.9 },
  ];
  const nodes = bands.map((band, i) => {
    const src = createLoopingNoise(ctx, i === 2 ? "white" : "pink", 0.9 + i * 0.1);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = band.tone;
    bp.Q.value = band.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.value = band.level;
    src.connect(bp);
    bp.connect(g);
    g.connect(bus);
    src.start();
    return { src, bp, g, band };
  });
  const { gain, panner, handle } = attachChain(ctx, opts, bus);
  let disposed = false;
  let gustPhase = audioRandom() * 10;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      gustPhase += 0.016 * (0.15 + audioRandom() * 0.05);
      const gust = 0.75 + 0.25 * Math.sin(gustPhase) * Math.sin(gustPhase * 0.37 + 1.7);
      const speedGate = softGate(Math.pow(Math.max(0, (m.speedKmh - 8) / 100), 0.7), 0.01);
      const bright = m.accelFast * 0.25;
      const level = (opts.level ?? 0.45) * speedGate * gust * (1 + bright);
      targetParam(gain.gain, softGate(level), t, 0.4);
      nodes.forEach(({ bp, g, band }, i) => {
        targetParam(bp.frequency, band.tone * (0.85 + m.speedSlow * 0.5 + bright * 0.2), t, 0.5);
      targetParam(g.gain, band.level * (i === 2 ? 0.28 + m.speedSlow * 0.45 : 1), t, 0.45);
      });
      targetParam(panner.pan, Math.sin(t * 0.09) * 0.7 * m.stereoWidth, t, 0.6);
    },
    dispose() {
      disposed = true;
      nodes.forEach(({ src }) => stopSafe(src));
    },
  };
}

/* ----------------------------------------------------------------- turbine */

/**
 * Turbofan acoustic stack inspired by NASA component descriptions:
 * low-frequency jet/combustion broadband, fan broadband, blade-passing tone
 * + harmonics, high-frequency compressor/turbine content, discrete tones.
 * Cabin mode attenuates the top end for a private-jet interior perspective.
 */
export function createTurbineLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts & {
    fanBase?: number;
    roarLevel?: number;
    cabin?: boolean;
  },
): LayerHandle {
  const bus = ctx.createGain();
  const cabin = Boolean(opts.cabin);
  const fanBase = opts.fanBase ?? 420;

  // 1) Low-frequency jet / combustion broadband
  const jet = createLoopingNoise(ctx, "brown", 0.85);
  const jetLp = ctx.createBiquadFilter();
  jetLp.type = "lowpass";
  jetLp.frequency.value = 280;
  jetLp.Q.value = 0.7;
  const jetG = ctx.createGain();
  jetG.gain.value = 0.0001;
  jet.connect(jetLp);
  jetLp.connect(jetG);
  jetG.connect(bus);
  jet.start();

  // 2) Fan broadband
  const fanNoise = createLoopingNoise(ctx, "pink", 1);
  const fanBp = ctx.createBiquadFilter();
  fanBp.type = "bandpass";
  fanBp.frequency.value = cabin ? 900 : 1400;
  fanBp.Q.value = 0.55;
  const fanNoiseG = ctx.createGain();
  fanNoiseG.gain.value = 0.0001;
  fanNoise.connect(fanBp);
  fanBp.connect(fanNoiseG);
  fanNoiseG.connect(bus);
  fanNoise.start();

  // 3) Blade-passing tone + harmonics
  const bpf = ctx.createOscillator();
  bpf.type = "sine";
  bpf.frequency.value = fanBase;
  const bpfG = ctx.createGain();
  bpfG.gain.value = 0.0001;
  bpf.connect(bpfG);
  bpfG.connect(bus);
  bpf.start();

  const bpf2 = ctx.createOscillator();
  bpf2.type = "sine";
  bpf2.frequency.value = fanBase * 2;
  const bpf2G = ctx.createGain();
  bpf2G.gain.value = 0.0001;
  bpf2.connect(bpf2G);
  bpf2G.connect(bus);
  bpf2.start();

  const bpf3 = ctx.createOscillator();
  bpf3.type = "triangle";
  bpf3.frequency.value = fanBase * 3;
  const bpf3G = ctx.createGain();
  bpf3G.gain.value = 0.0001;
  bpf3.connect(bpf3G);
  bpf3G.connect(bus);
  bpf3.start();

  // 4) High-frequency compressor / turbine content
  const compressor = createLoopingNoise(ctx, "white", 1.15);
  const compHp = ctx.createBiquadFilter();
  compHp.type = "highpass";
  compHp.frequency.value = cabin ? 3200 : 4500;
  const compBp = ctx.createBiquadFilter();
  compBp.type = "bandpass";
  compBp.frequency.value = cabin ? 4000 : 6200;
  compBp.Q.value = 1.1;
  const compG = ctx.createGain();
  compG.gain.value = 0.0001;
  compressor.connect(compHp);
  compHp.connect(compBp);
  compBp.connect(compG);
  compG.connect(bus);
  compressor.start();

  // 5) Discrete turbine tone (embedded, never louder than roar)
  const discrete = ctx.createOscillator();
  discrete.type = "sine";
  discrete.frequency.value = fanBase * 4.7;
  const discG = ctx.createGain();
  discG.gain.value = 0.0001;
  discrete.connect(discG);
  discG.connect(bus);
  discrete.start();

  // Cabin shelving: private-jet interior perspective
  const cabinShelf = ctx.createBiquadFilter();
  cabinShelf.type = "highshelf";
  cabinShelf.frequency.value = 2500;
  cabinShelf.gain.value = cabin ? -10 : -1.5;

  const { gain, panner, handle } = attachChain(ctx, opts, cabinShelf);
  bus.connect(cabinShelf);

  let spool = 0.08;
  let disposed = false;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const cmd = clamp(m.throttleFast * 0.7 + m.accelFast * 0.55 + m.speedSlow * 0.4);
      // Thrust command is fast; spool has inertia
      const spoolTau = cabin ? 1.5 : 0.9;
      spool += (cmd - spool) * (m.dt / spoolTau);
      const lift = m.regen > 0.25 || m.accelMps2 < -1;
      const spoolDown = lift ? Math.min(spool, spool * 0.985) : spool;
      if (lift) spool = smoothTowardSpool(spool, spool * 0.92, m.dt, 0.55);

      const roarAmt =
        (opts.roarLevel ?? 0.55) *
        (0.1 + Math.pow(spool, 1.15) * 1.05 + m.speedSlow * 0.22);
      // Broadband jet dominates at high thrust; tones stay embedded
      targetParam(jetG.gain, softGate(roarAmt * (cabin ? 0.45 : 0.85)), t, 0.22);
      targetParam(fanNoiseG.gain, softGate(roarAmt * (cabin ? 0.55 : 0.7)), t, 0.2);
      jetLp.frequency.setTargetAtTime(180 + spool * 520, t, 0.25);
      fanBp.frequency.setTargetAtTime((cabin ? 700 : 1100) + spool * 1600, t, 0.22);

      const fanHz = fanBase * (0.5 + Math.pow(spool, 0.72) * 1.65);
      targetParam(bpf.frequency, fanHz, t, 0.16);
      targetParam(bpf2.frequency, fanHz * 2, t, 0.18);
      targetParam(bpf3.frequency, fanHz * 3.05, t, 0.2);
      // Tone falls first/clearer on lift-off; roar decays slower (handled by spool tau)
      const toneLevel = (0.05 + spool * 0.14) * (lift ? 0.7 : 1);
      targetParam(bpfG.gain, softGate(toneLevel * (cabin ? 0.75 : 1)), t, lift ? 0.1 : 0.16);
      targetParam(bpf2G.gain, softGate(toneLevel * 0.45), t, lift ? 0.1 : 0.18);
      targetParam(bpf3G.gain, softGate(toneLevel * 0.22), t, 0.2);

      targetParam(compG.gain, softGate(spool * (cabin ? 0.04 : 0.12)), t, 0.2);
      compBp.frequency.setTargetAtTime((cabin ? 3500 : 5200) + spool * 1800, t, 0.25);
      targetParam(discrete.frequency, fanHz * 4.6, t, 0.2);
      targetParam(discG.gain, softGate(spool * (cabin ? 0.025 : 0.055)), t, 0.18);

      // Never let whistle overpower roar at high thrust
      const master = (opts.level ?? 0.5) * (0.22 + roarAmt * 0.95);
      targetParam(gain.gain, softGate(master), t, 0.2);
      targetParam(panner.pan, Math.sin(t * 0.07) * 0.12 * m.stereoWidth, t, 0.5);
      void spoolDown;
    },
    dispose() {
      disposed = true;
      stopSafe(jet);
      stopSafe(fanNoise);
      stopSafe(bpf);
      stopSafe(bpf2);
      stopSafe(bpf3);
      stopSafe(compressor);
      stopSafe(discrete);
    },
  };
}

function smoothTowardSpool(current: number, target: number, dt: number, tau: number) {
  const a = 1 - Math.exp(-Math.max(0.0001, dt) / Math.max(0.001, tau));
  return current + (target - current) * a;
}

/* ------------------------------------------------------------------- rotor */

export function createRotorLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts & { blades?: number; tone?: number },
): LayerHandle {
  const bus = ctx.createGain();
  const { gain, panner, handle } = attachChain(ctx, opts, bus);
  const blades = opts.blades ?? 4;
  let next = 0;
  let step = 0;
  let disposed = false;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      // Rotor RPM changes only moderately with speed; load affects slap strength.
      const rotorHz = 3.6 + m.speedSlow * 1.8 + m.throttleFast * 0.8;
      const interval = 1 / (rotorHz * blades);
      if (next < t) next = t;
      const horizon = t + 0.15;
      while (next < horizon) {
        const at = next;
        const variation = 0.94 + audioRandom() * 0.12;
        const slap = (opts.level ?? 0.55) * (0.55 + m.throttleFast * 0.7 + m.accelFast * 0.3) * variation;
        const pan = ctx.createStereoPanner();
        pan.pan.setValueAtTime(step % 2 === 0 ? -0.5 : 0.5, at);
        pan.pan.linearRampToValueAtTime(step % 2 === 0 ? 0.15 : -0.15, at + 0.1);
        pan.connect(bus);

        const boom = ctx.createOscillator();
        const bg = ctx.createGain();
        boom.type = "sine";
        const f0 = (opts.tone ?? 42) * variation;
        boom.frequency.setValueAtTime(f0, at);
        boom.frequency.exponentialRampToValueAtTime(Math.max(18, f0 * 0.55), at + 0.12);
        bg.gain.setValueAtTime(0.0001, at);
        bg.gain.exponentialRampToValueAtTime(Math.max(0.0002, slap * 0.9), at + 0.008);
        bg.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
        boom.connect(bg);
        bg.connect(pan);
        boom.start(at);
        boom.stop(at + 0.2);

        const whoosh = createLoopingNoise(ctx, "pink", 1);
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.Q.value = 1.1;
        const whooshHz = 380 + m.throttleFast * 700;
        bp.frequency.setValueAtTime(whooshHz, at);
        bp.frequency.exponentialRampToValueAtTime(whooshHz * 0.35, at + 0.12);
        const wg = ctx.createGain();
        wg.gain.setValueAtTime(0.0001, at);
        wg.gain.exponentialRampToValueAtTime(Math.max(0.0002, slap * 0.65), at + 0.01);
        wg.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
        whoosh.connect(bp);
        bp.connect(wg);
        wg.connect(pan);
        whoosh.start(at);
        whoosh.stop(at + 0.18);

        step += 1;
        next += interval * (0.97 + audioRandom() * 0.06);
      }
      targetParam(gain.gain, softGate(0.7 + m.throttleFast * 0.3), t, 0.15);
      targetParam(panner.pan, 0, t, 0.3);
    },
    dispose() {
      disposed = true;
    },
  };
}

/* ------------------------------------------------------------------- water */

/**
 * Hull / water interaction with physical regime transitions.
 * Small-outboard research: cavitation can begin at relatively low boat speeds
 * and produces a marked broadband (especially HF) increase; regimes change
 * spectral shape, not just loudness.
 */
export function createWaterLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts & { planing?: boolean; outboard?: boolean },
): LayerHandle {
  const bus = ctx.createGain();
  const outboard = Boolean(opts.outboard ?? opts.planing);

  // Displacement / hull rumble
  const deep = createLoopingNoise(ctx, "brown", 0.8);
  const deepLp = ctx.createBiquadFilter();
  deepLp.type = "lowpass";
  deepLp.frequency.value = 220;
  const deepG = ctx.createGain();
  deep.connect(deepLp);
  deepLp.connect(deepG);
  deepG.connect(bus);
  deep.start();

  // Mid water wash / turbulence
  const wash = createLoopingNoise(ctx, "pink", 1);
  const washBp = ctx.createBiquadFilter();
  washBp.type = "bandpass";
  washBp.frequency.value = 900;
  washBp.Q.value = 0.55;
  const washG = ctx.createGain();
  wash.connect(washBp);
  washBp.connect(washG);
  washG.connect(bus);
  wash.start();

  // Cavitation broadband (regime-dependent HF)
  const cav = createLoopingNoise(ctx, "white", 1.25);
  const cavHp = ctx.createBiquadFilter();
  cavHp.type = "highpass";
  cavHp.frequency.value = 1800;
  const cavBp = ctx.createBiquadFilter();
  cavBp.type = "bandpass";
  cavBp.frequency.value = 3200;
  cavBp.Q.value = 0.7;
  const cavG = ctx.createGain();
  cav.connect(cavHp);
  cavHp.connect(cavBp);
  cavBp.connect(cavG);
  cavG.connect(bus);
  cav.start();

  // Planing spray
  const spray = createLoopingNoise(ctx, "white", 1.35);
  const sprayHp = ctx.createBiquadFilter();
  sprayHp.type = "highpass";
  sprayHp.frequency.value = 4000;
  const sprayG = ctx.createGain();
  spray.connect(sprayHp);
  sprayHp.connect(sprayG);
  sprayG.connect(bus);
  spray.start();

  const { gain, panner, handle } = attachChain(ctx, opts, bus);
  let disposed = false;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const regimes = waterRegimes(m.speedKmh, m.throttleFast, m.accelFast, outboard);
      const turb = 0.88 + 0.12 * Math.sin(t * 0.23) * Math.sin(t * 0.07 + 2);

      // Low speed: motor/hull displacement dominant
      targetParam(
        deepG.gain,
        softGate(regimes.displacement * 0.55 * (0.35 + m.speedSlow) * turb),
        t,
        0.4,
      );
      deepLp.frequency.setTargetAtTime(160 + regimes.displacement * 120, t, 0.4);

      // Mid wash grows with speed, brightens when planing
      targetParam(washG.gain, softGate(regimes.wash * 0.7 * turb), t, 0.32);
      washBp.frequency.setTargetAtTime(650 + regimes.plane * 1600 + regimes.cavitation * 400, t, 0.35);

      // Cavitation: marked broadband jump once regime opens, HF rises with developed cavitation
      targetParam(cavG.gain, softGate(regimes.cavitation * (0.2 + regimes.developed * 0.55)), t, 0.2);
      cavHp.frequency.setTargetAtTime(1400 + regimes.developed * 1600, t, 0.25);
      cavBp.frequency.setTargetAtTime(2400 + regimes.developed * 2800 + m.throttleFast * 600, t, 0.22);

      // Spray expands on plane
      targetParam(sprayG.gain, softGate(regimes.plane * 0.4 * (0.45 + m.accelFast * 0.4)), t, 0.28);
      sprayHp.frequency.setTargetAtTime(3200 + regimes.plane * 2000, t, 0.3);

      const level =
        (opts.level ?? 0.45) *
        (0.12 + regimes.wash * 0.55 + regimes.cavitation * 0.35 + regimes.plane * 0.2);
      targetParam(gain.gain, softGate(level), t, 0.28);
      targetParam(panner.pan, Math.sin(t * 0.14) * 0.65 * m.stereoWidth, t, 0.5);
    },
    dispose() {
      disposed = true;
      stopSafe(wash);
      stopSafe(deep);
      stopSafe(cav);
      stopSafe(spray);
    },
  };
}

/** Soft regime weights from boat speed + load (not a single louder-with-speed curve). */
function waterRegimes(kmh: number, throttle: number, accel: number, outboard: boolean) {
  if (!outboard) {
    const wash = clamp(kmh / 90);
    return {
      displacement: clamp(1 - wash * 0.5),
      wash,
      cavitation: 0,
      developed: 0,
      plane: 0,
    };
  }
  // Incipient cavitation can begin at relatively low boat speeds under load
  const load = clamp(throttle * 0.7 + Math.max(0, accel) * 0.45);
  const displacement = 1 - smoothstep(8, 32, kmh);
  const wash = smoothstep(4, 55, kmh);
  const cavitation = smoothstep(10, 28, kmh) * (0.35 + load * 0.65);
  const developed = smoothstep(22, 48, kmh) * (0.4 + load * 0.6);
  const plane = smoothstep(28, 58, kmh);
  return { displacement, wash, cavitation, developed, plane };
}

/* ----------------------------------------------------------- hot-bulb tractor */

/**
 * Lanz-style single-cylinder two-stroke hot-bulb character:
 * absurdly slow RPM, individual enormous combustion events, flywheel inertia.
 * Throttle raises pulse strength before cadence climbs.
 */
export function createHotBulbTractorLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts & { idleRpm?: number; peakRpm?: number },
): LayerHandle {
  const bus = ctx.createGain();
  const { gain, panner, handle } = attachChain(ctx, opts, bus);
  const idleRpm = opts.idleRpm ?? 280;
  const peakRpm = opts.peakRpm ?? 630;
  let next = 0;
  let stroke = 0;
  let flywheelRpm = idleRpm;
  let disposed = false;

  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      // Huge flywheel: RPM crawls. Throttle mainly loads the stroke first.
      const targetRpm = idleRpm + Math.pow(m.throttleFast * 0.55 + m.speedSlow * 0.7, 1.2) * (peakRpm - idleRpm);
      const inertiaTau = 1.8 + (1 - m.throttleFast) * 1.2;
      flywheelRpm += (targetRpm - flywheelRpm) * (m.dt / inertiaTau);
      flywheelRpm = clamp(flywheelRpm, idleRpm * 0.85, peakRpm * 1.05);

      // Two-stroke single: one fire per revolution
      const fireHz = flywheelRpm / 60;
      const interval = 1 / Math.max(0.8, fireHz);
      if (next < t) next = t;
      const horizon = t + 0.25;
      const pulseStrength =
        (opts.level ?? 0.55) *
        (0.55 + Math.pow(m.throttleFast, 1.35) * 0.7 + m.speedSlow * 0.15) *
        (0.85 + audioRandom() * 0.2);

      while (next < horizon) {
        const at = next;
        const micro = 1 + (audioRandom() - 0.5) * 0.03;
        const uneven = stroke % 5 === 0 ? 0.82 : stroke % 3 === 0 ? 1.08 : 1;

        // Enormous pressure event (low-mid, not sub-only)
        const osc = ctx.createOscillator();
        const lp = ctx.createBiquadFilter();
        const og = ctx.createGain();
        osc.type = "sine";
        const f0 = 70 * micro * (0.92 + m.throttleFast * 0.12);
        osc.frequency.setValueAtTime(f0, at);
        osc.frequency.exponentialRampToValueAtTime(Math.max(28, f0 * 0.45), at + 0.12);
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(380 + pulseStrength * 220, at);
        lp.frequency.exponentialRampToValueAtTime(140, at + 0.16);
        og.gain.setValueAtTime(0.0001, at);
        og.gain.exponentialRampToValueAtTime(
          Math.max(0.0002, pulseStrength * 0.95 * uneven),
          at + 0.008,
        );
        og.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
        osc.connect(lp);
        lp.connect(og);
        og.connect(bus);
        osc.start(at);
        osc.stop(at + 0.26);

        // Exhaust stack puff
        const puff = createLoopingNoise(ctx, "brown", 1);
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 160 + audioRandom() * 80;
        bp.Q.value = 1.1;
        const pg = ctx.createGain();
        pg.gain.setValueAtTime(0.0001, at);
        pg.gain.exponentialRampToValueAtTime(Math.max(0.0002, pulseStrength * 0.55 * uneven), at + 0.01);
        pg.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
        puff.connect(bp);
        bp.connect(pg);
        pg.connect(bus);
        puff.start(at);
        puff.stop(at + 0.22);

        // Mechanical knock / recovery after the fire
        const knock = createLoopingNoise(ctx, "white", 1);
        const kbp = ctx.createBiquadFilter();
        kbp.type = "bandpass";
        kbp.frequency.value = 700 + audioRandom() * 400;
        kbp.Q.value = 4;
        const kg = ctx.createGain();
        const kAt = at + 0.04;
        kg.gain.setValueAtTime(0.0001, kAt);
        kg.gain.exponentialRampToValueAtTime(pulseStrength * 0.22, kAt + 0.004);
        kg.gain.exponentialRampToValueAtTime(0.0001, kAt + 0.07);
        knock.connect(kbp);
        kbp.connect(kg);
        kg.connect(bus);
        knock.start(kAt);
        knock.stop(kAt + 0.1);

        stroke += 1;
        next += interval * micro;
      }

      // Body shake between strokes (flywheel feel)
      targetParam(gain.gain, softGate(0.75 + m.throttleFast * 0.2), t, 0.2);
      targetParam(panner.pan, Math.sin(t * (flywheelRpm / 120)) * 0.08, t, 0.4);
    },
    dispose() {
      disposed = true;
    },
  };
}

/* ------------------------------------------------------------------ impact */

export function createImpactLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts & {
    kind?: "gravel" | "cobble" | "stone";
    /** Extra slap density from motion jerk (jet ski hull). */
    jerkWeight?: number;
    /** Multiplier on event rate (rail joints, snow thumps). */
    densityScale?: number;
    /** Softer/lower tones for packed snow. */
    softThump?: boolean;
  },
): LayerHandle {
  const bus = ctx.createGain();
  const { gain, panner, handle } = attachChain(ctx, opts, bus);
  let next = 0;
  let disposed = false;
  const kind = opts.kind ?? "gravel";
  const jerkWeight = opts.jerkWeight ?? (kind === "stone" ? 12 : 4);
  const densityScale = opts.densityScale ?? 1;
  const softThump = !!opts.softThump;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const jerk = Math.abs(m.jerk);
      const baseRate =
        kind === "cobble"
          ? 2 + m.speedSlow * 14
          : kind === "stone"
            ? 0.55 + m.speedSlow * 10 + jerk * jerkWeight + Math.abs(m.accelFast) * 3.5
            : softThump
              ? 1.4 + m.speedSlow * 16 + jerk * jerkWeight * 0.5
              : 1.2 + m.speedSlow * 18 + jerk * jerkWeight;
      const rate = baseRate * densityScale;
      const interval = 1 / Math.max(0.4, rate);
      if (next < t) next = t + audioRandom() * interval;
      const horizon = t + 0.2;
      while (next < horizon) {
        const at = next;
        const amp =
          (opts.level ?? 0.3) *
          (0.3 + m.speedSlow * 0.65 + Math.abs(m.accelFast) * 0.3 + jerk * (softThump ? 0.25 : 0.55)) *
          (0.6 + audioRandom() * 0.5);
        const pan = ctx.createStereoPanner();
        pan.pan.value = (audioRandom() - 0.5) * 1.6;
        pan.connect(bus);

        const src = createLoopingNoise(ctx, softThump ? "brown" : kind === "cobble" ? "white" : "pink", 1);
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        const tone = softThump
          ? 280 + audioRandom() * 420
          : kind === "cobble"
            ? 700 + audioRandom() * 900
            : kind === "stone"
              ? 900 + audioRandom() * 1400
              : 1600 + audioRandom() * 1800;
        bp.frequency.value = tone;
        bp.Q.value = softThump ? 2.2 : kind === "cobble" ? 8 : 4;
        const g = ctx.createGain();
        const dur = softThump ? 0.07 + audioRandom() * 0.05 : kind === "cobble" ? 0.05 : 0.04 + audioRandom() * 0.04;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp * (softThump ? 0.85 : 1)), at + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        src.connect(bp);
        bp.connect(g);
        g.connect(pan);
        src.start(at);
        src.stop(at + dur + 0.03);

        if (!softThump && (kind === "cobble" || audioRandom() > 0.7)) {
          const osc = ctx.createOscillator();
          const og = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.value = tone * (kind === "cobble" ? 1.8 : 0.4);
          og.gain.setValueAtTime(0.0001, at);
          og.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp * 0.45), at + 0.002);
          og.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
          osc.connect(og);
          og.connect(pan);
          osc.start(at);
          osc.stop(at + 0.12);
        } else if (softThump && audioRandom() > 0.55) {
          const osc = ctx.createOscillator();
          const og = ctx.createGain();
          const lp = ctx.createBiquadFilter();
          osc.type = "sine";
          osc.frequency.setValueAtTime(90 + audioRandom() * 40, at);
          osc.frequency.exponentialRampToValueAtTime(55, at + 0.1);
          lp.type = "lowpass";
          lp.frequency.value = 220;
          og.gain.setValueAtTime(0.0001, at);
          og.gain.exponentialRampToValueAtTime(amp * 0.4, at + 0.006);
          og.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
          osc.connect(lp);
          lp.connect(og);
          og.connect(pan);
          osc.start(at);
          osc.stop(at + 0.16);
        }
        next += interval * (0.7 + audioRandom() * 0.7);
      }
      targetParam(gain.gain, softGate(0.8), t, 0.2);
    },
    dispose() {
      disposed = true;
    },
  };
}

/* ------------------------------------------------------------------- creak */

export function createCreakLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts & { tone?: number; metal?: boolean },
): LayerHandle {
  const bus = ctx.createGain();
  const { gain, panner, handle } = attachChain(ctx, opts, bus);
  let next = 0;
  let step = 0;
  let disposed = false;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const rate = 0.25 + m.speedSlow * 1.4 + Math.abs(m.accelFast) * 0.6;
      const interval = 1 / Math.max(0.15, rate);
      if (next < t) next = t + 0.4;
      if (t + 0.05 < next) {
        targetParam(gain.gain, softGate((opts.level ?? 0.12) * (0.2 + m.speedSlow)), t, 0.3);
        return;
      }
      const at = Math.max(t, next);
      const dur = 0.4 + audioRandom() * 0.35;
      const osc = ctx.createOscillator();
      const bp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      const wobble = ctx.createOscillator();
      const wGain = ctx.createGain();
      osc.type = opts.metal ? "square" : "sawtooth";
      const tone = (opts.tone ?? 160) * (0.85 + audioRandom() * 0.3);
      const up = step % 2 === 0;
      osc.frequency.setValueAtTime(tone * (up ? 0.85 : 1.1), at);
      osc.frequency.linearRampToValueAtTime(tone * (up ? 1.15 : 0.8), at + dur);
      wobble.type = "sine";
      wobble.frequency.value = 5 + audioRandom() * 4;
      wGain.gain.value = opts.metal ? 35 : 18;
      wobble.connect(wGain);
      wGain.connect(osc.detune);
      bp.type = "bandpass";
      bp.frequency.value = tone * (opts.metal ? 4.5 : 3);
      bp.Q.value = opts.metal ? 8 : 5;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime((opts.level ?? 0.12) * (0.4 + m.speedSlow), at + 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(bp);
      bp.connect(g);
      g.connect(bus);
      osc.start(at);
      wobble.start(at);
      osc.stop(at + dur + 0.05);
      wobble.stop(at + dur + 0.05);
      step += 1;
      next = at + interval * (0.8 + audioRandom() * 0.5);
      targetParam(panner.pan, (audioRandom() - 0.5) * 0.4, t, 0.4);
    },
    dispose() {
      disposed = true;
    },
  };
}

/* -------------------------------------------------------------------- hoof */

/**
 * Horse gait synthesis (transverse gallop research):
 * - Walk: even four-beat
 * - Trot: two-beat diagonal pairs
 * - Canter: three-beat + suspension
 * - Gallop: four distinct beats with a longer gathered flight after the lead
 * Hoof impact = short body thud + brief brown grit (not white hiss).
 */
export function createHoofLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts & { horses?: 1 | 2 | 4; tone?: number },
): LayerHandle {
  const bus = ctx.createGain();
  const { gain, panner, handle } = attachChain(ctx, opts, bus);
  let next = 0;
  let disposed = false;
  const horses = opts.horses ?? 1;

  function fireHoof(at: number, tone: number, level: number, hard: boolean, limb: number) {
    // Dirt / turf grit: brown, not white, and very short.
    const src = createLoopingNoise(ctx, "brown", 1);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    const gritTone = tone * (hard ? 1.05 : 0.82) * (limb < 2 ? 0.88 : 1.08);
    bp.frequency.setValueAtTime(gritTone, at);
    bp.frequency.exponentialRampToValueAtTime(gritTone * 0.45, at + 0.04);
    bp.Q.value = 3.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * (hard ? 0.55 : 0.35)), at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
    const pan = ctx.createStereoPanner();
    // Hind leftish, fore rightish for a readable stride stereo image.
    pan.pan.value = limb < 2 ? -0.28 + limb * 0.12 : 0.18 + (limb - 2) * 0.1;
    src.connect(bp);
    bp.connect(g);
    g.connect(pan);
    pan.connect(bus);
    src.start(at);
    src.stop(at + 0.08);

    // Mass of the hoof: low triangle thud.
    const body = ctx.createOscillator();
    const bg = ctx.createGain();
    body.type = "triangle";
    const thud = tone * (limb < 2 ? 0.38 : 0.48) * (hard ? 1.08 : 1);
    body.frequency.setValueAtTime(thud, at);
    body.frequency.exponentialRampToValueAtTime(thud * 0.55, at + 0.07);
    bg.gain.setValueAtTime(0.0001, at);
    bg.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * (hard ? 0.85 : 0.55)), at + 0.004);
    bg.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
    body.connect(bg);
    bg.connect(pan);
    body.start(at);
    body.stop(at + 0.12);
  }

  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const gait = gaitPhase(m.speedKmh);
      const cadence = gait.rate * (horses === 1 ? 1 : horses === 2 ? 1.05 : 1.12);
      const interval = 1 / Math.max(0.35, cadence);
      if (next < t) next = t;
      const horizon = t + 0.28;
      while (next < horizon) {
        const pattern = gait.pattern;
        // One full stride of footfalls, then wait for the next stride.
        const strideGain = (opts.level ?? 0.35) * (0.35 + m.speedSlow * 0.9);
        for (let i = 0; i < pattern.length; i += 1) {
          const offset = pattern[i]!;
          const hard = i === pattern.length - 1;
          const tone = (opts.tone ?? 340) * (0.94 + audioRandom() * 0.1);
          fireHoof(
            next + offset * interval,
            tone,
            strideGain * (0.88 + audioRandom() * 0.14),
            hard,
            i,
          );
        }
        // Gathered flight: extra silence after the lead (esp. gallop).
        next += interval * (gait.flight + audioRandom() * 0.04);
      }
      targetParam(gain.gain, softGate(0.9), t, 0.2);
      targetParam(panner.pan, Math.sin(t * 0.11) * 0.12 * m.stereoWidth, t, 0.4);
    },
    dispose() {
      disposed = true;
    },
  };
}

/** Relative footfall times within one stride + flight multiplier on the interval. */
function gaitPhase(kmh: number): { rate: number; pattern: number[]; flight: number } {
  if (kmh < 7) {
    // Walk: even four-beat.
    return { rate: 0.95 + kmh * 0.06, pattern: [0, 0.25, 0.5, 0.75], flight: 1 };
  }
  if (kmh < 16) {
    // Trot: diagonal two-beat (each pair nearly together).
    return { rate: 1.7 + (kmh - 7) * 0.1, pattern: [0, 0.06, 0.5, 0.56], flight: 1.02 };
  }
  if (kmh < 28) {
    // Canter: three-beat feel (hind, diagonal pair, lead) + short suspension.
    return { rate: 2.2 + (kmh - 16) * 0.08, pattern: [0, 0.22, 0.28, 0.52], flight: 1.18 };
  }
  // Gallop: four distinct beats; longer gathered flight after the lead fore.
  // Timing approximates transverse gallop: RH, LH, RF, LF then airborne.
  return { rate: 2.85 + (kmh - 28) * 0.055, pattern: [0, 0.16, 0.3, 0.46], flight: 1.32 };
}

/* ---------------------------------------------------------- resonant body */

export function createResonantBodyLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts & { freqs?: number[]; wave?: OscillatorType },
): LayerHandle {
  const bus = ctx.createGain();
  const freqs = opts.freqs ?? [55, 110, 165];
  const voices = freqs.map((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.wave ?? "sine";
    osc.frequency.value = f;
    g.gain.value = 0.12 / (i + 1);
    osc.connect(g);
    g.connect(bus);
    osc.start();
    return { osc, g, f };
  });
  const { gain, panner, handle } = attachChain(ctx, opts, bus);
  let disposed = false;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const shake = 0.7 + 0.3 * Math.sin(t * (1.4 + m.rpmNorm));
      voices.forEach(({ osc, g, f }, i) => {
        targetParam(osc.frequency, f * (0.95 + m.rpmNorm * 0.2 + m.speedSlow * 0.08), t, 0.25);
        targetParam(
          g.gain,
          (0.1 / (i + 1)) * (0.35 + m.bodyLevel * 0.8) * shake * (1 - m.shiftDip * 0.5),
          t,
          0.2,
        );
      });
      targetParam(gain.gain, softGate((opts.level ?? 0.25) * (0.3 + m.bodyLevel * 0.8)), t, 0.25);
      targetParam(panner.pan, Math.sin(t * 0.05) * 0.1, t, 0.5);
    },
    dispose() {
      disposed = true;
      voices.forEach(({ osc }) => stopSafe(osc));
    },
  };
}

/* --------------------------------------------------------------- one-shot */

export interface OneShotSpec {
  kind:
    | "horn"
    | "whistle"
    | "whip"
    | "laugh"
    | "hohoho"
    | "thunder"
    | "roar"
    | "fart"
    | "bell"
    | "beam"
    | "sonar"
    | "antilag"
    | "wastegate";
  everySeconds: number;
  jitter?: number;
  level: number;
  tone: number;
  speedLinked?: boolean;
  onlyOnLift?: boolean;
  onlyOnHardAccel?: boolean;
  /** Skip automatic clock; only fire via layer.trigger(). */
  manualOnly?: boolean;
}

export function createOneShotEventLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts & { events: OneShotSpec[] },
): LayerHandle {
  const bus = ctx.createGain();
  const { gain, panner, handle } = attachChain(ctx, opts, bus);
  const clocks = opts.events.map((spec) => ({
    spec,
    next: ctx.currentTime + 5 + audioRandom() * Math.max(1, spec.everySeconds),
  }));
  let disposed = false;
  let lastThrottle = 0;
  let pendingManual = false;

  return {
    ...handle,
    trigger() {
      pendingManual = true;
    },
    update(m, t) {
      if (disposed) return;
      const lift = lastThrottle > 0.55 && m.throttleFast < 0.25;
      const hardAccel = m.throttleFast > 0.75 && m.accelFast > 0.55;
      lastThrottle = m.throttleFast;

      if (pendingManual) {
        pendingManual = false;
        const primary = opts.events[0];
        if (primary) fireOneShot(ctx, bus, primary, t + 0.02, m);
      }

      clocks.forEach((clock) => {
        const spec = clock.spec;
        if (spec.manualOnly) return;
        if (t < clock.next) return;
        if (spec.onlyOnLift && !lift && !m.isShifting) {
          clock.next = t + 0.4;
          return;
        }
        if (spec.onlyOnHardAccel && !hardAccel) {
          clock.next = t + 0.5;
          return;
        }
        fireOneShot(ctx, bus, spec, t + 0.02, m);
        const pace = spec.speedLinked ? 1 / (0.45 + m.speedSlow * 1.8) : 1;
        const jitter = (audioRandom() - 0.5) * 2 * (spec.jitter ?? 0);
        const minGap = spec.everySeconds < 2 ? 0.08 : 2.5;
        clock.next = t + Math.max(minGap, spec.everySeconds * pace + jitter);
      });
      targetParam(gain.gain, softGate(opts.level ?? 1), t, 0.2);
      targetParam(panner.pan, 0, t, 0.3);
    },
    dispose() {
      disposed = true;
    },
  };
}

function fireOneShot(
  ctx: BaseAudioContext,
  out: AudioNode,
  spec: OneShotSpec,
  at: number,
  m: MotionFrame,
) {
  const { kind, tone, level } = spec;
  if (kind === "horn") {
    [1, 1.5, 2.02].forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i === 0 ? "sawtooth" : "sine";
      osc.frequency.value = tone * ratio;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(level / (i + 1.4), at + 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 3.2);
      osc.connect(g);
      g.connect(out);
      osc.start(at);
      osc.stop(at + 3.4);
    });
    return;
  }
  if (kind === "whistle") {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(tone * 0.94, at);
    osc.frequency.linearRampToValueAtTime(tone * 1.05, at + 0.8);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(level, at + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
    osc.connect(g);
    g.connect(out);
    osc.start(at);
    osc.stop(at + 1.5);
    return;
  }
  if (kind === "whip") {
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer(ctx, "white");
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(tone, at);
    hp.frequency.exponentialRampToValueAtTime(tone * 0.3, at + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
    src.connect(hp);
    hp.connect(g);
    g.connect(out);
    src.start(at);
    src.stop(at + 0.16);
    return;
  }
  if (kind === "roar") {
    // Low formant burst + brown pressure - not a car horn stack.
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer(ctx, "brown");
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(tone * 1.4, at);
    bp.frequency.exponentialRampToValueAtTime(tone * 0.7, at + 0.9);
    bp.Q.value = 1.4;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, at);
    ng.gain.linearRampToValueAtTime(level * 0.85, at + 0.06);
    ng.gain.exponentialRampToValueAtTime(0.0001, at + 1.35);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(out);
    src.start(at);
    src.stop(at + 1.4);
    [1, 1.48].forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(tone * ratio, at);
      osc.frequency.exponentialRampToValueAtTime(tone * ratio * 0.72, at + 1.1);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(level * (0.22 - i * 0.06), at + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.2);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 420;
      osc.connect(lp);
      lp.connect(g);
      g.connect(out);
      osc.start(at);
      osc.stop(at + 1.25);
    });
    return;
  }
  if (kind === "thunder") {
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer(ctx, "brown");
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(180, at);
    lp.frequency.exponentialRampToValueAtTime(60, at + 2.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(level * 0.7, at + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 3.5);
    src.connect(lp);
    lp.connect(g);
    g.connect(out);
    src.start(at);
    src.stop(at + 3.6);
    return;
  }
  if (kind === "antilag" || kind === "wastegate") {
    const bursts = kind === "antilag" ? 2 + Math.floor(audioRandom() * 3) : 1;
    for (let i = 0; i < bursts; i += 1) {
      const t0 = at + i * (0.04 + audioRandom() * 0.05);
      const src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer(ctx, "white");
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = tone * (0.8 + audioRandom() * 0.5);
      bp.Q.value = 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(level * (0.5 + audioRandom() * 0.5), t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
      src.connect(bp);
      bp.connect(g);
      g.connect(out);
      src.start(t0);
      src.stop(t0 + 0.08);
    }
    return;
  }
  if (kind === "fart") {
    const dur = 0.15 + audioRandom() * 0.45;
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const mod = ctx.createOscillator();
    const mg = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(tone * (1.2 + audioRandom() * 0.4), at);
    osc.frequency.exponentialRampToValueAtTime(tone * 0.45, at + dur);
    mod.type = "sine";
    mod.frequency.value = 12 + audioRandom() * 18;
    mg.gain.value = 40 + audioRandom() * 40;
    mod.connect(mg);
    mg.connect(osc.frequency);
    lp.type = "lowpass";
    lp.frequency.value = 400 + audioRandom() * 500;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(level, at + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(lp);
    lp.connect(g);
    g.connect(out);
    osc.start(at);
    mod.start(at);
    osc.stop(at + dur + 0.05);
    mod.stop(at + dur + 0.05);
    return;
  }
  if (kind === "bell") {
    [1, 1.51, 2.13, 2.79].forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i === 0 ? "triangle" : "sine";
      osc.frequency.value = tone * ratio;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(level / (i + 1.6), at + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.3 + i * 0.04);
      osc.connect(g);
      g.connect(out);
      osc.start(at);
      osc.stop(at + 0.45);
    });
    return;
  }
  if (kind === "laugh" || kind === "hohoho") {
    const syllables = kind === "hohoho" ? 3 : 3 + Math.round(m.throttleFast * 3);
    const spacing = kind === "hohoho" ? 0.34 : 0.14;
    for (let i = 0; i < syllables; i += 1) {
      const t0 = at + i * spacing;
      const osc = ctx.createOscillator();
      const f1 = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = "sawtooth";
      const pitch = tone * (1.08 - i * 0.04) * (kind === "laugh" ? 1 + m.speedSlow * 0.2 : 1);
      osc.frequency.setValueAtTime(pitch, t0);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.9, t0 + spacing * 0.8);
      f1.type = "bandpass";
      f1.frequency.value = kind === "hohoho" ? 480 : 730;
      f1.Q.value = 6;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(level * (0.85 - i * 0.08), t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + spacing * 0.85);
      osc.connect(f1);
      f1.connect(g);
      g.connect(out);
      osc.start(t0);
      osc.stop(t0 + spacing);
    }
    return;
  }
  // sonar: classic short ping + soft underwater return
  if (kind === "sonar") {
    const ping = (delay: number, amp: number, pitch: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      osc.type = "sine";
      const t0 = at + delay;
      osc.frequency.setValueAtTime(pitch, t0);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.92, t0 + 0.35);
      lp.type = "lowpass";
      lp.frequency.value = 2200;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(amp, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
      osc.connect(lp);
      lp.connect(g);
      g.connect(out);
      osc.start(t0);
      osc.stop(t0 + 0.6);
    };
    ping(0, level, tone);
    ping(0.55, level * 0.35, tone * 0.94);
    return;
  }
  // beam / default: soft descending tone
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(tone * 1.2, at);
  osc.frequency.exponentialRampToValueAtTime(tone * 0.6, at + 1.2);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(level, at + 0.2);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
  osc.connect(g);
  g.connect(out);
  osc.start(at);
  osc.stop(at + 1.5);
}

/* --------------------------------------------------------------- intake */

export function createIntakeRoarLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts,
): LayerHandle {
  const src = createLoopingNoise(ctx, "pink", 1.1);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 900;
  bp.Q.value = 0.7;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 200;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2500;
  src.connect(hp);
  hp.connect(bp);
  bp.connect(lp);
  const { gain, panner, handle } = attachChain(ctx, opts, lp);
  src.start();
  let disposed = false;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const level =
        (opts.level ?? 0.22) *
        Math.pow(m.throttleFast, 1.45) *
        (0.35 + m.rpmNorm * 0.4) *
        (1 - m.shiftDip) *
        (m.regen > 0.2 ? 0.15 : 1);
      targetParam(gain.gain, softGate(level), t, 0.05);
      targetParam(bp.frequency, 700 + m.throttleFast * 1200 + m.rpmNorm * 400, t, 0.08);
      targetParam(panner.pan, Math.sin(t * 0.2) * 0.2, t, 0.3);
    },
    dispose() {
      disposed = true;
      stopSafe(src);
    },
  };
}

/* --------------------------------------------------------------- turbo */

export function createTurboLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts & { baseHz?: number; lagSeconds?: number },
): LayerHandle {
  const bus = ctx.createGain();
  const whistle = ctx.createOscillator();
  whistle.type = "sine";
  whistle.frequency.value = opts.baseHz ?? 1800;
  const wg = ctx.createGain();
  wg.gain.value = 0.0001;
  whistle.connect(wg);
  wg.connect(bus);
  whistle.start();

  const air = createLoopingNoise(ctx, "white", 1);
  const airBp = ctx.createBiquadFilter();
  airBp.type = "bandpass";
  airBp.frequency.value = 2400;
  airBp.Q.value = 1.4;
  const ag = ctx.createGain();
  ag.gain.value = 0.0001;
  air.connect(airBp);
  airBp.connect(ag);
  ag.connect(bus);
  air.start();

  const { gain, panner, handle } = attachChain(ctx, opts, bus);
  let spool = 0;
  let lastThrottle = 0;
  let blowoffUntil = 0;
  let disposed = false;
  const riseTau = opts.lagSeconds ?? 0.7;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const target = clamp(m.throttleFast * 0.85 + m.accelFast * 0.4);
      const tau = target > spool ? riseTau : 0.28;
      spool += (target - spool) * Math.min(1, m.dt / tau);

      // Blowoff / dump when lifting off a charged spool.
      if (lastThrottle > 0.55 && m.throttleFast < 0.28 && spool > 0.42) {
        blowoffUntil = t + 0.18;
        const src = createLoopingNoise(ctx, "white", 1);
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 1600 + audioRandom() * 900;
        bp.Q.value = 1.6;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12 + spool * 0.1, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        src.connect(bp);
        bp.connect(g);
        g.connect(bus);
        src.start(t);
        src.stop(t + 0.22);
      }
      lastThrottle = m.throttleFast;

      const blow = t < blowoffUntil ? 0.35 : 0;
      const hz = (opts.baseHz ?? 1800) * (0.55 + Math.pow(spool, 0.75) * 1.5);
      targetParam(whistle.frequency, hz, t, 0.14);
      targetParam(wg.gain, softGate(spool * 0.12), t, 0.12);
      targetParam(ag.gain, softGate(spool * 0.24 + blow), t, 0.1);
      targetParam(airBp.frequency, 1600 + spool * 2000, t, 0.16);
      targetParam(gain.gain, softGate((opts.level ?? 0.2) * (0.22 + spool * 1.05)), t, 0.12);
      targetParam(panner.pan, 0.15, t, 0.4);
    },
    dispose() {
      disposed = true;
      stopSafe(whistle);
      stopSafe(air);
    },
  };
}

/* --------------------------------------------------------------- gearbox */

export function createGearboxWhineLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts & { baseHz?: number },
): LayerHandle {
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = opts.baseHz ?? 220;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 900;
  bp.Q.value = 4;
  const drive = createDriveShaper(ctx, 0.2);
  osc.connect(bp);
  bp.connect(drive);
  const { gain, panner, handle } = attachChain(ctx, opts, drive);
  osc.start();
  let disposed = false;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const hz = (opts.baseHz ?? 220) * (0.5 + m.speedSlow * 2.2 + m.gearNorm * 0.3);
      targetParam(osc.frequency, hz, t, 0.1);
      targetParam(bp.frequency, hz * 3.2, t, 0.15);
      const lift = m.regen > 0.2 ? 1.35 : 1;
      const level =
        (opts.level ?? 0.08) *
        (0.15 + m.speedSlow * 0.85) *
        lift *
        (0.6 + m.throttleFast * 0.4);
      targetParam(gain.gain, softGate(level), t, 0.12);
      targetParam(panner.pan, -0.2, t, 0.4);
    },
    dispose() {
      disposed = true;
      stopSafe(osc);
    },
  };
}

/* ----------------------------------------------------------------- kazoo */

export function createKazooLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts & { baseHz?: number },
): LayerHandle {
  const voice = ctx.createOscillator();
  voice.type = "sawtooth";
  voice.frequency.value = opts.baseHz ?? 180;
  const formant = ctx.createBiquadFilter();
  formant.type = "bandpass";
  formant.frequency.value = 900;
  formant.Q.value = 6;
  const nasal = ctx.createBiquadFilter();
  nasal.type = "peaking";
  nasal.frequency.value = 1600;
  nasal.Q.value = 4;
  nasal.gain.value = 8;

  const buzz = createLoopingNoise(ctx, "white", 1);
  const buzzBp = ctx.createBiquadFilter();
  buzzBp.type = "bandpass";
  buzzBp.frequency.value = 1200;
  buzzBp.Q.value = 8;
  const buzzG = ctx.createGain();
  buzzG.gain.value = 0.15;
  const ring = ctx.createGain();
  ring.gain.value = 0.5;

  voice.connect(formant);
  formant.connect(nasal);
  nasal.connect(ring);
  buzz.connect(buzzBp);
  buzzBp.connect(buzzG);
  buzzG.connect(ring.gain);

  const drive = createDriveShaper(ctx, 0.55);
  ring.connect(drive);
  const { gain, panner, handle } = attachChain(ctx, opts, drive);
  voice.start();
  buzz.start();
  let disposed = false;
  let syll = 0;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const motion = Math.max(m.speedSlow, m.rpmNorm);
      const hz = (opts.baseHz ?? 180) * (0.7 + motion * 1.35 + m.throttleFast * 0.35);
      targetParam(voice.frequency, clamp(hz, 90, 520), t, 0.06);
      // syllable articulation under throttle
      syll += m.dt * (4 + m.throttleFast * 8);
      const env = 0.55 + 0.45 * Math.abs(Math.sin(syll));
      const fOpen = m.throttleFast > 0.6 ? 1100 : 780;
      targetParam(formant.frequency, fOpen + Math.sin(syll * 0.5) * 120, t, 0.05);
      targetParam(buzzG.gain, 0.1 + m.throttleFast * 0.2, t, 0.08);
      targetParam(gain.gain, softGate((opts.level ?? 0.4) * env * (0.35 + motion * 0.7)), t, 0.06);
      targetParam(panner.pan, Math.sin(t * 0.3) * 0.15, t, 0.2);
    },
    dispose() {
      disposed = true;
      stopSafe(voice);
      stopSafe(buzz);
    },
  };
}

/* ---------------------------------------------------------- electric pulse */

export function createElectricPulseLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts & {
    baseHz?: number;
    shimmerCeiling?: number;
    /** Extra inverter mesh on accel (hypercar). */
    meshBoost?: number;
  },
): LayerHandle {
  const bus = ctx.createGain();
  const fund = ctx.createOscillator();
  fund.type = "sine";
  fund.frequency.value = opts.baseHz ?? 70;
  const fg = ctx.createGain();
  fund.connect(fg);
  fg.connect(bus);
  fund.start();

  const harm = ctx.createOscillator();
  harm.type = "triangle";
  harm.frequency.value = (opts.baseHz ?? 70) * 2;
  const hg = ctx.createGain();
  harm.connect(hg);
  hg.connect(bus);
  harm.start();

  const mesh = ctx.createOscillator();
  mesh.type = "sawtooth";
  mesh.frequency.value = (opts.baseHz ?? 70) * 3.2;
  const meshLp = ctx.createBiquadFilter();
  meshLp.type = "lowpass";
  meshLp.frequency.value = 3200;
  const meshG = ctx.createGain();
  meshG.gain.value = 0.0001;
  mesh.connect(meshLp);
  meshLp.connect(meshG);
  meshG.connect(bus);
  mesh.start();

  const shimmer = createLoopingNoise(ctx, "pink", 1);
  const shBp = ctx.createBiquadFilter();
  shBp.type = "bandpass";
  shBp.frequency.value = 2400;
  shBp.Q.value = 1.2;
  const sg = ctx.createGain();
  shimmer.connect(shBp);
  shBp.connect(sg);
  sg.connect(bus);
  shimmer.start();

  const regenOsc = ctx.createOscillator();
  regenOsc.type = "sine";
  regenOsc.frequency.value = 140;
  const rg = ctx.createGain();
  const regenFilt = ctx.createBiquadFilter();
  regenFilt.type = "bandpass";
  regenFilt.frequency.value = 400;
  regenFilt.Q.value = 3;
  regenOsc.connect(regenFilt);
  regenFilt.connect(rg);
  rg.connect(bus);
  regenOsc.start();

  const { gain, panner, handle } = attachChain(ctx, opts, bus);
  let disposed = false;
  const meshBoost = opts.meshBoost ?? 0;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const base = logPitch(m.speedSlow, opts.baseHz ?? 70, 220);
      targetParam(fund.frequency, base, t, 0.12);
      targetParam(harm.frequency, base * (1.5 + m.throttleFast * 0.8), t, 0.1);
      targetParam(fg.gain, softGate(0.22 + m.speedSlow * 0.25), t, 0.15);
      targetParam(hg.gain, softGate(0.08 + m.throttleFast * 0.22 + m.accelFast * 0.12), t, 0.08);
      targetParam(mesh.frequency, base * (2.8 + m.throttleFast * 1.2), t, 0.08);
      targetParam(meshLp.frequency, 1800 + m.accelFast * 2200 + m.throttleFast * 800, t, 0.1);
      targetParam(
        meshG.gain,
        softGate(meshBoost * (0.04 + m.accelFast * 0.14 + m.throttleFast * 0.08)),
        t,
        0.07,
      );
      targetParam(sg.gain, softGate(m.accelFast * (0.12 + meshBoost * 0.08)), t, 0.06);
      const shimmerTop = opts.shimmerCeiling ?? 4200;
      targetParam(shBp.frequency, 1400 + m.accelFast * Math.min(1800, shimmerTop - 1400), t, 0.12);
      targetParam(regenOsc.frequency, base * 0.7 * (1 - m.regen * 0.2), t, 0.15);
      targetParam(rg.gain, softGate(m.regen * 0.22), t, 0.12);
      targetParam(regenFilt.frequency, 280 + m.regen * 200, t, 0.15);
      targetParam(gain.gain, softGate((opts.level ?? 0.4) * (0.25 + m.speedSlow * 0.6 + m.accelFast * 0.25)), t, 0.12);
      targetParam(panner.pan, Math.sin(t * 0.17) * 0.35 * m.stereoWidth, t, 0.3);
    },
    dispose() {
      disposed = true;
      stopSafe(fund);
      stopSafe(harm);
      stopSafe(mesh);
      stopSafe(shimmer);
      stopSafe(regenOsc);
    },
  };
}

function logPitch(t: number, min: number, max: number) {
  const x = clamp(t);
  return min * Math.pow(max / min, Math.log1p(x * 8) / Math.log(9));
}

/* ---------------------------------------------------------------- ufo */

export function createUfoLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts & { baseHz?: number },
): LayerHandle {
  const a = ctx.createOscillator();
  const b = ctx.createOscillator();
  a.type = "sine";
  b.type = "sine";
  a.frequency.value = opts.baseHz ?? 220;
  b.frequency.value = (opts.baseHz ?? 220) * 1.01;
  const ag = ctx.createGain();
  const bg = ctx.createGain();
  ag.gain.value = 0.2;
  bg.gain.value = 0.18;
  const formant = ctx.createBiquadFilter();
  formant.type = "bandpass";
  formant.frequency.value = 900;
  formant.Q.value = 2.5;
  const shimmer = createLoopingNoise(ctx, "pink", 1);
  const shG = ctx.createGain();
  shG.gain.value = 0.04;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 2000;
  a.connect(ag);
  b.connect(bg);
  ag.connect(formant);
  bg.connect(formant);
  shimmer.connect(hp);
  hp.connect(shG);
  const bus = ctx.createGain();
  formant.connect(bus);
  shG.connect(bus);
  const { gain, panner, handle } = attachChain(ctx, opts, bus);
  a.start();
  b.start();
  shimmer.start();
  let disposed = false;
  let drift = 0;
  let portamento = opts.baseHz ?? 220;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      drift += m.dt * (0.08 + audioRandom() * 0.04);
      const vib = Math.sin(t * (5 + audioRandom() * 0.3)) * (8 + m.accelFast * 12);
      const micro = (audioRandom() - 0.5) * 3;
      const target = (opts.baseHz ?? 220) * (0.85 + m.speedSlow * 0.45 + m.accelFast * 0.35);
      portamento += (target - portamento) * (m.dt / 0.35);
      targetParam(a.frequency, portamento + vib + micro, t, 0.04);
      targetParam(b.frequency, portamento * 1.008 + vib * 0.7 - micro, t, 0.04);
      targetParam(formant.frequency, 700 + m.speedSlow * 900 + Math.sin(drift) * 120, t, 0.2);
      targetParam(gain.gain, softGate((opts.level ?? 0.35) * (0.45 + m.speedSlow * 0.3 + 0.2)), t, 0.2);
      targetParam(panner.pan, Math.sin(drift * 0.7) * 0.55, t, 0.25);
    },
    dispose() {
      disposed = true;
      stopSafe(a);
      stopSafe(b);
      stopSafe(shimmer);
    },
  };
}

/* ----------------------------------------------------------- steam chuff */

export function createSteamChuffLayer(
  ctx: BaseAudioContext,
  opts: LayerBaseOpts & { tone?: number },
): LayerHandle {
  const bus = ctx.createGain();
  const { gain, panner, handle } = attachChain(ctx, opts, bus);
  let next = 0;
  let step = 0;
  let disposed = false;
  return {
    ...handle,
    update(m, t) {
      if (disposed) return;
      const wheelHz = 0.8 + m.speedSlow * 8;
      const chuffsPerRev = 4;
      const interval = 1 / Math.max(0.5, wheelHz * chuffsPerRev);
      if (next < t) next = t;
      const horizon = t + 0.2;
      while (next < horizon) {
        const at = next;
        const strength = (opts.level ?? 0.35) * (0.45 + m.speedSlow * 0.7) * (0.75 + audioRandom() * 0.35);
        const merge = clamp((m.speedKmh - 40) / 60);
        const src = createLoopingNoise(ctx, "pink", 1);
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = (opts.tone ?? 200) * (0.9 + audioRandom() * 0.3);
        bp.Q.value = 1.2;
        const g = ctx.createGain();
        const dur = lerp(0.14, 0.06, merge);
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, strength * (1 - merge * 0.35)), at + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        src.connect(bp);
        bp.connect(g);
        g.connect(bus);
        src.start(at);
        src.stop(at + dur + 0.04);

        const thump = ctx.createOscillator();
        const tg = ctx.createGain();
        thump.type = "sine";
        thump.frequency.setValueAtTime(90, at);
        thump.frequency.exponentialRampToValueAtTime(45, at + 0.08);
        tg.gain.setValueAtTime(0.0001, at);
        tg.gain.exponentialRampToValueAtTime(Math.max(0.0002, strength * 0.6), at + 0.006);
        tg.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
        thump.connect(tg);
        tg.connect(bus);
        thump.start(at);
        thump.stop(at + 0.14);

        // rod clank offset
        if (step % 2 === 0) {
          const clank = createLoopingNoise(ctx, "white", 1);
          const cbp = ctx.createBiquadFilter();
          cbp.type = "bandpass";
          cbp.frequency.value = 1200 + audioRandom() * 400;
          cbp.Q.value = 6;
          const cg = ctx.createGain();
          cg.gain.setValueAtTime(0.0001, at + 0.03);
          cg.gain.exponentialRampToValueAtTime(strength * 0.25, at + 0.035);
          cg.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
          clank.connect(cbp);
          cbp.connect(cg);
          cg.connect(bus);
          clank.start(at + 0.03);
          clank.stop(at + 0.09);
        }
        step += 1;
        next += interval * (0.94 + audioRandom() * 0.1);
      }
      targetParam(gain.gain, softGate(0.75 + mergeBoost(m.speedKmh) * 0.2), t, 0.2);
    },
    dispose() {
      disposed = true;
    },
  };
}

function mergeBoost(kmh: number) {
  return clamp((kmh - 50) / 70);
}

export { lerp };
