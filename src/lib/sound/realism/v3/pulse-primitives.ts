/**
 * Reusable raw-mechanical combustion primitives (Prompt 04).
 * Pure functions — no AudioContext. Units documented; Nyquist-safe helpers.
 */

export type RawMechanicalQualityTier = "high" | "low-cost";

/** Four-stroke average firing frequency (Hz). Not a claim every engine sounds alike. */
export function firingHzFourStroke(rpm: number, cylinders: number): number {
  const r = Math.max(0, rpm);
  const c = Math.max(1, cylinders);
  return (r * c) / 120;
}

/** Two-stroke average firing frequency (Hz). */
export function firingHzTwoStroke(rpm: number, cylinders: number): number {
  const r = Math.max(0, rpm);
  const c = Math.max(1, cylinders);
  return (r / 60) * c;
}

/** Crankshaft frequency (Hz) = RPM / 60. */
export function crankHzFromRpm(rpm: number): number {
  return Math.max(0, rpm) / 60;
}

/** Clamp a frequency below Nyquist with a safety margin. */
export function belowNyquist(hz: number, sampleRate: number, margin = 0.92): number {
  if (!Number.isFinite(hz) || !Number.isFinite(sampleRate) || sampleRate <= 0) return 20;
  const nyquist = sampleRate * 0.5 * margin;
  return Math.min(Math.max(20, hz), nyquist);
}

/**
 * Finite-width pulse envelope in seconds for band-limited combustion pressure.
 * Wider at low sharpness / higher load; never a discontinuous impulse.
 */
export function pulseWidthSeconds(opts: {
  sharpness: number;
  load: number;
  quality: RawMechanicalQualityTier;
}): number {
  const sharpness = Math.min(1, Math.max(0, opts.sharpness));
  const load = Math.min(1, Math.max(0, opts.load));
  const base = opts.quality === "high" ? 0.0038 : 0.0055;
  return base + (1 - sharpness) * 0.0042 + load * 0.0012;
}

/**
 * Bounded seeded LCG — deterministic cycle-to-cycle texture.
 * Returns [0, 1). Not for cryptographic use.
 */
export function seededUnit(seed: number): { next: () => number; state: () => number } {
  let s = seed >>> 0 || 1;
  return {
    next: () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return (s & 0xffff) / 0x10000;
    },
    state: () => s,
  };
}

/** Bounded amplitude / timing deltas for one combustion event (phase-coherent). */
export function cycleVariation(opts: {
  seedState: number;
  irregularity: number;
  load: number;
}): { ampScale: number; intervalScale: number; nextSeed: number } {
  const rng = seededUnit(opts.seedState);
  const irregularity = Math.min(1, Math.max(0, opts.irregularity));
  const load = Math.min(1, Math.max(0, opts.load));
  const ampSpread = 0.05 + (1 - load) * 0.09 + irregularity * 0.4;
  const timeSpread = 0.01 + irregularity * 0.11;
  const ampScale = 1 + (rng.next() - 0.5) * ampSpread;
  const intervalScale = 1 + (rng.next() - 0.5) * timeSpread;
  return {
    ampScale: Math.min(1.45, Math.max(0.55, ampScale)),
    intervalScale: Math.min(1.18, Math.max(0.85, intervalScale)),
    nextSeed: rng.state(),
  };
}

/**
 * Soft saturating curve for WaveShaper (mild, anti-harsh).
 * drive 0..1; output stays in (-1, 1). Not global fuzz.
 * Returns a concrete ArrayBuffer-backed curve for WaveShaperNode.curve typing.
 */
export function mildSaturationCurve(drive: number, length = 256): Float32Array<ArrayBuffer> {
  const d = 1.2 + Math.min(1, Math.max(0, drive)) * 1.6;
  const curve = new Float32Array(new ArrayBuffer(length * 4));
  for (let i = 0; i < length; i += 1) {
    const x = i / (length / 2) - 1;
    curve[i] = Math.tanh(x * d) / Math.tanh(d);
  }
  return curve;
}

/**
 * Measured low-cost quality tier for constrained browsers.
 * Offline / lab renders stay on "high". Never changes catalog identity.
 */
export function resolveRawMechanicalQualityTier(
  ctx?: Pick<BaseAudioContext, "sampleRate"> | null,
): RawMechanicalQualityTier {
  if (
    typeof OfflineAudioContext !== "undefined" &&
    ctx != null &&
    ctx instanceof OfflineAudioContext
  ) {
    return "high";
  }
  if (typeof navigator === "undefined") return "high";
  try {
    const cores = navigator.hardwareConcurrency ?? 4;
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    if (cores <= 2 || (typeof mem === "number" && mem > 0 && mem <= 2)) return "low-cost";
    if (ctx?.sampleRate && ctx.sampleRate > 0 && ctx.sampleRate < 44_100) return "low-cost";
  } catch {
    /* ignore */
  }
  return "high";
}

/**
 * Assess whether 2× oversampling is warranted for nonlinear stages.
 * Returns a recommendation only — callers may ignore on low-cost tier.
 */
export function shouldPreferOversampling(opts: {
  quality: RawMechanicalQualityTier;
  saturationDrive: number;
  sampleRate: number;
}): { prefer: boolean; reason: string } {
  if (opts.quality === "low-cost") {
    return { prefer: false, reason: "low-cost tier uses post-LP shaping instead of oversampling" };
  }
  if (opts.sampleRate >= 88_200) {
    return { prefer: false, reason: "native rate already provides headroom above 20 kHz" };
  }
  if (opts.saturationDrive < 0.35) {
    return { prefer: false, reason: "mild drive; post-shaping LP is sufficient" };
  }
  return {
    prefer: true,
    reason: "nonlinear drive at 44.1/48 kHz benefits from 2× OS when CPU allows (not yet required)",
  };
}

/** Diagnostic band centers (tuning hypotheses, not universal EQ). */
export const RAW_DIAGNOSTIC_BANDS_HZ = {
  body: { lo: 60, hi: 180 },
  mechanical: { lo: 150, hi: 600 },
  harshness: { lo: 2000, hi: 5000 },
} as const;
