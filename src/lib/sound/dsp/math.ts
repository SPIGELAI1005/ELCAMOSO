/** Nonlinear response helpers for motion → sound mapping. */

export function clamp(v: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, v));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function easeInOut(t: number) {
  const x = clamp(t);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

/** Perceptual pitch growth that flattens at high load. */
export function logMap(t: number, min: number, max: number) {
  const x = clamp(t);
  const g = Math.log1p(x * 9) / Math.log(10);
  return lerp(min, max, g);
}

export function powCurve(t: number, exp: number) {
  return Math.pow(clamp(t), exp);
}

/** Soft knee for gains so nothing jumps from silence to full. */
export function softGate(amount: number, threshold = 0.02, floor = 0.0001) {
  if (amount <= threshold) return floor;
  return amount;
}
