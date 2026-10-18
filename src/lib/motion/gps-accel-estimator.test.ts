import { describe, expect, it } from "vitest";
import { createGpsAccelEstimator, stepGpsAccelEstimator } from "./gps-accel-estimator";

/** Simulate the fused speed: 1 Hz GPS staircase with ±0.6 km/h noise, lightly smoothed. */
function run(profile: (t: number) => number, secs: number) {
  const est = createGpsAccelEstimator();
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
  let gps = 0;
  let fused = 0;
  let next = 0;
  const out: number[] = [];
  const dt = 1 / 60;
  for (let t = 0; t < secs; t += dt) {
    if (t >= next) {
      gps = Math.max(0, profile(t - 0.8) + (rnd() - 0.5) * 1.2) / 3.6;
      next += 0.9 + rnd() * 0.25;
    }
    fused += (gps - fused) * (1 - Math.exp(-dt / 0.35));
    out.push(stepGpsAccelEstimator(est, fused, dt));
  }
  return out;
}

describe("GPS acceleration estimate", () => {
  it("stays at 0 through steady-cruise GPS noise", () => {
    const out = run(() => 80, 60).slice(600);
    const nonZero = out.filter((a) => a !== 0).length / out.length;
    expect(nonZero).toBeLessThan(0.1);
    expect(Math.max(...out.map(Math.abs))).toBeLessThan(0.5);
  });
  it("follows a launch and a lift-off with the right sign and size", () => {
    // 0 -> 100 km/h in 12 s (~2.3 m/s²), hold, then 100 -> 40 in 12 s (~-1.4 m/s²)
    const v = (t: number) => (t < 2 ? 0 : t < 14 ? ((t - 2) / 12) * 100 : t < 22 ? 100 : t < 34 ? 100 - ((t - 22) / 12) * 60 : 40);
    const out = run(v, 40);
    const at = (s: number) => out[Math.round(s * 60)]!;
    expect(at(9)).toBeGreaterThan(1.6);
    expect(at(9)).toBeLessThan(3);
    expect(at(19)).toBe(0);
    expect(at(29)).toBeLessThan(-0.9);
    expect(at(29)).toBeGreaterThan(-2);
  });
});
