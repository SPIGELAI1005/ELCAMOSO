import { describe, expect, it } from "vitest";
import {
  RECORDED_BED_CREDITS,
  RECORDED_BEDS,
  bedLoopWeights,
  bedRate,
  getRecordedBed,
  piecewise,
} from "./recorded-beds";

describe("recorded beds", () => {
  it("piecewise interpolates and clamps", () => {
    const p: [number, number][] = [
      [0, 0],
      [10, 1],
    ];
    expect(piecewise(p, -5)).toBe(0);
    expect(piecewise(p, 5)).toBeCloseTo(0.5);
    expect(piecewise(p, 50)).toBe(1);
  });

  it("loop weights are equal-power between the two nearest refs", () => {
    const loops = [
      { start: 0, end: 1, ref: 280 },
      { start: 1, end: 2, ref: 650 },
    ];
    expect(bedLoopWeights(loops, 200)).toEqual([1, 0]);
    expect(bedLoopWeights(loops, 900)).toEqual([0, 1]);
    const [a, b] = bedLoopWeights(loops, 430);
    expect(a! * a! + b! * b!).toBeCloseTo(1);
  });

  it("rates stay inside the configured range", () => {
    for (const cfg of Object.values(RECORDED_BEDS)) {
      for (const loop of cfg.loops) {
        for (const v of [0, 1, 50, 300, 5000]) {
          const r = bedRate(cfg, loop, v);
          expect(r).toBeGreaterThanOrEqual(cfg.minRate);
          expect(r).toBeLessThanOrEqual(cfg.maxRate);
        }
        expect(loop.end).toBeGreaterThan(loop.start);
        expect(loop.end).toBeLessThanOrEqual(cfg.sourceSamples / 48000);
      }
    }
  });

  it("only the approved profiles get beds, every bed is credited", () => {
    const ids = Object.keys(RECORDED_BEDS).sort();
    for (const id of [
      "american-muscle-v8",
      "gt-v8",
      "racing-v10",
      "motorcycle-superbike",
      "big-twin",
      "kazoo-kart",
    ]) {
      expect(getRecordedBed(id)).toBeNull();
    }
    expect(ids.length).toBeGreaterThan(0);
    expect(RECORDED_BED_CREDITS.length).toBeGreaterThanOrEqual(ids.length);
    for (const c of RECORDED_BED_CREDITS) expect(c.licence).not.toMatch(/NC/);
  });
});
