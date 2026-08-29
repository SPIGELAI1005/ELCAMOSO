/** First-order low-pass toward a target (exponential smoothing). */
export function lowPassToward(
  current: number,
  target: number,
  dt: number,
  tauSeconds: number,
): number {
  const tau = Math.max(0.01, tauSeconds);
  const alpha = 1 - Math.exp(-Math.max(0.001, dt) / tau);
  return current + (target - current) * alpha;
}

/** Reject a single-sample spike against a smoothed baseline. */
export function rejectSpike(
  candidate: number,
  baseline: number,
  maxDelta: number,
): { value: number; rejected: boolean } {
  const delta = Math.abs(candidate - baseline);
  if (!Number.isFinite(candidate)) return { value: baseline, rejected: true };
  if (delta > maxDelta) return { value: baseline, rejected: true };
  return { value: candidate, rejected: false };
}

/** Linear interpolation between two timestamped scalar samples. */
export function interpolateScalar(
  a: { t: number; v: number },
  b: { t: number; v: number },
  at: number,
): number | null {
  if (!Number.isFinite(a.v) || !Number.isFinite(b.v)) return null;
  if (a.t === b.t) return a.v;
  if (at <= a.t) return a.v;
  if (at >= b.t) return b.v;
  const u = (at - a.t) / (b.t - a.t);
  return a.v + (b.v - a.v) * u;
}
