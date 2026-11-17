import { describe, expect, it } from "vitest";
import { CadenceDetector } from "./cadence";

function strideSamples(spm: number, seconds: number, hz = 100, peak = 4): Array<{
  tMs: number;
  ax: number;
  ay: number;
  az: number;
  linear: boolean;
}> {
  const interval = 60 / spm;
  const out: Array<{ tMs: number; ax: number; ay: number; az: number; linear: boolean }> = [];
  const n = Math.floor(seconds * hz);
  for (let i = 0; i < n; i++) {
    const t = i / hz;
    const phase = (t % interval) / interval;
    // Narrow raised-cosine peak at the start of each stride.
    const bump = phase < 0.18 ? peak * 0.5 * (1 + Math.cos((phase / 0.18) * Math.PI * 2 - Math.PI)) : 0.05;
    out.push({ tMs: Math.round(t * 1000), ax: 0.05, ay: 0.02, az: bump, linear: true });
  }
  return out;
}

describe("CadenceDetector", () => {
  it("estimates ~160 spm from a regular 160 spm peak train", () => {
    const det = new CadenceDetector();
    let reading = { rawSpm: 0, smoothedSpm: 0, stepCount: 0, peaked: false };
    for (const s of strideSamples(160, 12)) reading = det.push(s);
    expect(reading.stepCount).toBeGreaterThan(20);
    expect(reading.rawSpm).toBeGreaterThan(140);
    expect(reading.rawSpm).toBeLessThan(180);
    expect(reading.smoothedSpm).toBeGreaterThan(130);
    expect(reading.smoothedSpm).toBeLessThan(180);
  });

  it("estimates a walking ~110 spm cadence", () => {
    const det = new CadenceDetector();
    let reading = { rawSpm: 0, smoothedSpm: 0, stepCount: 0, peaked: false };
    for (const s of strideSamples(110, 14, 100, 3)) reading = det.push(s);
    expect(reading.rawSpm).toBeGreaterThan(95);
    expect(reading.rawSpm).toBeLessThan(125);
  });

  it("does not count steps on a quiet gravity-only signal", () => {
    const det = new CadenceDetector();
    let peaked = 0;
    for (let i = 0; i < 200; i++) {
      const r = det.push({
        tMs: i * 10,
        ax: 0.02 * Math.sin(i),
        ay: 0.01,
        az: 9.81,
        linear: false,
      });
      if (r.peaked) peaked += 1;
    }
    expect(peaked).toBe(0);
    expect(det.push({ tMs: 2010, ax: 0, ay: 0, az: 9.81, linear: false }).stepCount).toBe(0);
  });

  it("ignores a double peak inside the refractory window", () => {
    const det = new CadenceDetector();
    // Prime the filter with a first step.
    for (let i = 0; i < 10; i++) {
      det.push({ tMs: i * 10, ax: 0, ay: 0, az: i === 5 ? 6 : 0.1, linear: true });
    }
    const first = det.push({ tMs: 200, ax: 0, ay: 0, az: 6, linear: true });
    // A second spike 100 ms later must not count (min interval is 280 ms).
    let midCount = first.stepCount;
    for (let i = 1; i <= 8; i++) {
      const r = det.push({ tMs: 200 + i * 12, ax: 0, ay: 0, az: i === 4 ? 7 : 0.1, linear: true });
      midCount = r.stepCount;
    }
    expect(midCount).toBe(first.stepCount);
  });

  it("reset() clears counts and cadence", () => {
    const det = new CadenceDetector();
    for (const s of strideSamples(160, 6)) det.push(s);
    det.reset();
    const r = det.push({ tMs: 0, ax: 0, ay: 0, az: 0.1, linear: true });
    expect(r.stepCount).toBe(0);
    expect(r.smoothedSpm).toBe(0);
  });
});
