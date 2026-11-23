/**
 * Pure control model for the American Muscle V8 "Coyote v2" loop bank (no Web Audio here).
 * RPM / gear / load come from the drive model (speed + acceleration -> virtual powertrain);
 * this file only turns them into loop weights, playback rates and one-shot decisions.
 */
import bankData from "./coyote-v2-bank.json";

export type CoyoteLoad = "light" | "on" | "over";

export interface CoyoteLoadWeights {
  light: number;
  on: number;
  over: number;
}

export interface CoyoteLoopDef {
  id: string;
  load: CoyoteLoad;
  /** Exact RPM the loop was rendered at (whole engine cycles per loop). */
  rpm: number;
  rpmNominal: number;
  /** Whole engine cycles in the loop (crank angle 0 at loopStart). */
  cycles: number;
  /** Loop window inside the bank file, seconds. */
  start: number;
  end: number;
}

export interface CoyoteOneShotDef {
  id: string;
  /** RPM the one-shot was rendered around (0 = not RPM dependent). */
  rpm: number;
  start: number;
  duration: number;
  /** Level restore (dB): one-shots are stored no hotter than the loudest loop. */
  gainDb: number;
}

export const COYOTE_BANK_URL = "/sample-packs/recorded/coyote-v2/coyote_v2_3_bank.m4a";
export const COYOTE_BANK_VERSION: string = bankData.version;
export const COYOTE_LOOPS: readonly CoyoteLoopDef[] = bankData.loops.map((l) => ({
  id: l.id,
  load: l.load as CoyoteLoad,
  rpm: l.rpm,
  rpmNominal: l.rpmNominal,
  cycles: l.cycles,
  start: l.start,
  end: l.end,
}));
export const COYOTE_ONESHOTS: readonly CoyoteOneShotDef[] = bankData.oneshots.map((o) => ({
  id: o.id,
  rpm: o.rpm,
  start: o.start,
  duration: o.duration,
  gainDb: o.gainDb ?? 0,
}));

/** Sorted, de-duplicated RPM grid points of the bank. */
export const COYOTE_RPM_POINTS: readonly number[] = [
  ...new Set(COYOTE_LOOPS.map((l) => l.rpmNominal)),
].sort((a, b) => a - b);

export const COYOTE_IDLE_RPM = COYOTE_RPM_POINTS[0] ?? 700;
/**
 * Points from this rpm up share one cycle-to-cycle variation sequence and hold whole
 * multiples of it, so the runtime can start them crank-aligned: two neighbours then play
 * the same engine cycle at the same crank angle and their crossfade is a coherent timbre
 * morph. (Below it, the idle points keep their own lope and an unaligned equal-power blend,
 * exactly as before.)
 */
export const COYOTE_ALIGNED_FROM_RPM: number =
  (bankData as { alignedFromRpm?: number }).alignedFromRpm ?? Number.POSITIVE_INFINITY;

const GAP_CORRELATION: Record<string, Record<string, number>> = (
  bankData as { gapCorrelation?: Record<string, Record<string, number>> }
).gapCorrelation ?? {};

/**
 * Correlation of two crank-aligned neighbours (gap starting at point index i) for a load
 * mix. Aligned loops are strongly but not perfectly coherent (pipe resonances are fixed in
 * Hz, so pitching two loops to one rpm moves them apart a little).
 */
export function coyoteGapCorrelation(
  index: number,
  loads: CoyoteLoadWeights = { light: 1, on: 0, over: 0 },
): number {
  const rpm = COYOTE_RPM_POINTS[index];
  const g = rpm === undefined ? undefined : GAP_CORRELATION[String(rpm)];
  if (!g) return 1;
  const sum = loads.light + loads.on + loads.over || 1;
  const rho =
    ((g["light"] ?? 1) * loads.light + (g["on"] ?? 1) * loads.on + (g["over"] ?? 1) * loads.over) /
    sum;
  return clamp(rho, 0, 1);
}

/** True when a point is crank-aligned at runtime. */
export function coyotePointAligned(pointIndex: number): boolean {
  const rpm = COYOTE_RPM_POINTS[pointIndex];
  return rpm !== undefined && rpm >= COYOTE_ALIGNED_FROM_RPM;
}

/**
 * Loop offset (seconds from loopStart) for a shared crank clock in engine cycles:
 * every aligned loop then sits on the same cycle and crank angle.
 */
export function coyoteAlignedOffset(loop: CoyoteLoopDef, crankCycles: number): number {
  const cyc = Math.max(1, loop.cycles);
  const within = ((crankCycles % cyc) + cyc) % cyc;
  return (within / cyc) * (loop.end - loop.start);
}
export const COYOTE_MAX_RPM = COYOTE_RPM_POINTS[COYOTE_RPM_POINTS.length - 1] ?? 7000;

/** Loop for an RPM point and load; the idle point has no overrun loop, so light stands in. */
export function coyoteLoopFor(pointIndex: number, load: CoyoteLoad): CoyoteLoopDef | null {
  const rpm = COYOTE_RPM_POINTS[pointIndex];
  if (rpm === undefined) return null;
  const exact = COYOTE_LOOPS.find((l) => l.rpmNominal === rpm && l.load === load);
  if (exact) return exact;
  return COYOTE_LOOPS.find((l) => l.rpmNominal === rpm && l.load === "light") ?? null;
}

export function coyoteOneShot(id: string): CoyoteOneShotDef | null {
  return COYOTE_ONESHOTS.find((o) => o.id === id) ?? null;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smoothstep = (v: number) => {
  const x = clamp(v);
  return x * x * (3 - 2 * x);
};

export interface CoyotePointWeight {
  index: number;
  /**
   * Amplitude weight. Between two crank-aligned points: a raised-cosine morph normalised to
   * the pair's measured correlation rho (w1^2 + w2^2 + 2 rho w1 w2 = 1, constant level);
   * in the idle range, where loops are not aligned, equal-power (squares sum to 1).
   */
  weight: number;
}

/**
 * The two neighbouring RPM points around rpm on a log-RPM axis. Each loop then only needs a
 * small playback-rate correction (grid ratio <= 1.36). The crossfade spans the whole gap
 * between two points, with zero slope at both ends (no corner at a grid point).
 */
export function coyoteRpmWeights(rpm: number, loads?: CoyoteLoadWeights): CoyotePointWeight[] {
  const pts = COYOTE_RPM_POINTS;
  const r = clamp(rpm, pts[0]!, pts[pts.length - 1]!);
  for (let i = 0; i < pts.length - 1; i += 1) {
    const lo = pts[i]!;
    const hi = pts[i + 1]!;
    if (r <= hi) {
      const x = Math.log(r / lo) / Math.log(hi / lo);
      if (x <= 0.0005) return [{ index: i, weight: 1 }];
      if (x >= 0.9995) return [{ index: i + 1, weight: 1 }];
      if (coyotePointAligned(i) && coyotePointAligned(i + 1)) {
        const b = Math.sin((x * Math.PI) / 2) ** 2;
        const a = 1 - b;
        const rho = coyoteGapCorrelation(i, loads);
        const norm = Math.sqrt(a * a + b * b + 2 * rho * a * b);
        return [
          { index: i, weight: a / norm },
          { index: i + 1, weight: b / norm },
        ];
      }
      return [
        { index: i, weight: Math.cos((x * Math.PI) / 2) },
        { index: i + 1, weight: Math.sin((x * Math.PI) / 2) },
      ];
    }
  }
  return [{ index: pts.length - 1, weight: 1 }];
}

export interface CoyoteLoadInput {
  rpm: number;
  throttle: number;
  load: number;
  speedMs: number;
  regen: number;
}

/**
 * Engine load split. Load variants of one RPM point are rendered phase-aligned, so these
 * weights are linear (coherent morph) and always sum to 1.
 * - on: open throttle (pull / bark) from driver demand or virtual engine load
 * - over: closed throttle while rolling above idle (fuel cut / engine braking)
 * - light: everything else (idle, steady cruise)
 */
export function coyoteLoadTargets(input: CoyoteLoadInput): CoyoteLoadWeights {
  const demand = clamp(Math.max(input.throttle, input.load * 0.92));
  // A wide ramp (0.24 -> 0.84): part throttle stays a blend of cruise and pull, so opening
  // the throttle morphs the note instead of switching to a different-sounding loop.
  const on = smoothstep((demand - 0.24) / 0.6);
  const rolling = smoothstep((input.speedMs - 1.2) / 2);
  const aboveIdle = smoothstep((input.rpm - 1050) / 500);
  const closed = smoothstep((0.14 - input.throttle) / 0.1);
  const braking = smoothstep(input.regen / 0.35);
  const over = clamp(rolling * aboveIdle * Math.max(closed, braking * 0.8) * (1 - on));
  return { light: (1 - over) * (1 - on), on: (1 - over) * on, over };
}

/** Race-mode heel-and-toe downshift: throttle blip timing (seconds). */
export const COYOTE_HEEL_TOE = {
  /** Gear lever out (clutch in) right at the shift request. */
  gearOutDelayS: 0.0,
  /** Blip starts just after the lever leaves the gear. */
  blipDelayS: 0.015,
  blipRiseS: 0.05,
  blipFallTauS: 0.15,
  /** Lever into the lower gear near the top of the blip; the clutch takes up drive. */
  gearInDelayS: 0.115,
  /** Sound-side extra rpm flare on top of the powertrain rev-match (fraction). */
  rpmFlare: 0.05,
} as const;

/** Throttle-blip envelope 0..1, ts seconds after the blip starts (0 before / long after). */
export function coyoteHeelToeEnvelope(ts: number): number {
  const h = COYOTE_HEEL_TOE;
  if (ts <= 0 || ts > 1.2) return 0;
  if (ts < h.blipRiseS) return smoothstep(ts / h.blipRiseS);
  return Math.exp(-(ts - h.blipRiseS) / h.blipFallTauS);
}

/** Playback rate for a loop rendered at loopRpm, clamped to keep pitch correction small. */
export function coyoteLoopRate(rpm: number, loopRpm: number): number {
  return clamp(rpm / loopRpm, 0.5, 2);
}

/** Pops after a lift-off: 0-3, sparse (factory active exhaust, Sport mode). */
export function coyotePopCount(random: number): number {
  if (random < 0.35) return 0;
  if (random < 0.7) return 1;
  if (random < 0.9) return 2;
  return 3;
}

/** Seam blend length after decoding (seconds). */
export const COYOTE_SEAM_BLEND_S = 0.012;

/**
 * Make every loop seam sample-continuous in the *decoded* audio. The bank stores each loop
 * with a copy of its own tail in front of loopStart, so the samples just before loopStart
 * are the same audio as the samples just before loopEnd. Lossy coding makes the two copies
 * differ slightly; blending the end of each loop into that copy means the wrap from
 * loopEnd back to loopStart continues exactly where the audio before loopStart would.
 * Runs once per decode, on the main thread, ~1k samples per loop.
 */
export function blendCoyoteLoopSeams(
  data: Float32Array,
  sampleRate: number,
  loops: readonly CoyoteLoopDef[] = COYOTE_LOOPS,
) {
  const f = Math.max(8, Math.round(COYOTE_SEAM_BLEND_S * sampleRate));
  for (const loop of loops) {
    const s = Math.round(loop.start * sampleRate);
    const e = Math.round(loop.end * sampleRate);
    if (s - f < 0 || e > data.length || e - s < 4 * f) continue;
    for (let k = 0; k < f; k += 1) {
      const w = (k + 1) / f; // 0 -> 1 towards loopEnd
      const a = data[e - f + k]!;
      const b = data[s - f + k]!;
      data[e - f + k] = a + (b - a) * w;
    }
  }
}
