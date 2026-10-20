import { describe, expect, it } from "vitest";
import {
  AccelerationCharacter,
  MAX_GRAIN_RATE,
  MIN_GRAIN_RATE,
  RECORDED_LOOP_BANKS,
  RECORDED_LOOP_CREDITS,
  pickRegion,
  recordedLowShelfHz,
  recordedSampleWeight,
  synthMatchAt,
} from "./recorded-loops";

function drive(profile: (t: number) => number, seconds: number) {
  const c = new AccelerationCharacter();
  const dt = 1 / 60;
  let gps = 0;
  let held = profile(0);
  for (let t = 0; t < seconds; t += dt) {
    if (t >= gps) {
      held = profile(t); // 1 Hz GPS
      gps += 1;
    }
    c.update(held, t, dt);
  }
  return c;
}

describe("recorded loops hybrid (round 2)", () => {
  it("recordings carry idle and relaxed cruise, synth takes over high rpm / aggressive load", () => {
    expect(recordedSampleWeight(800, 0.1)).toBe(1);
    expect(recordedSampleWeight(2200, 0.2)).toBe(1);
    expect(recordedSampleWeight(3400, 0.2)).toBe(0);
    expect(recordedSampleWeight(1500, 0.95)).toBe(0);
    expect(recordedSampleWeight(1800, 0.3, 1)).toBeCloseTo(0.15, 2);
    const mid = recordedSampleWeight(2850, 0.2);
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
  });

  it("acceleration character separates cruise, gentle, hard and lift-off from 1 Hz GPS", () => {
    expect(drive(() => 15, 10).label(15)).toBe("cruise");
    const gentle = drive((t) => Math.min(15, t * 0.5), 12);
    expect(gentle.onLoad).toBeGreaterThan(0.4);
    expect(gentle.aggression).toBeLessThan(0.2);
    const hard = drive((t) => Math.min(28, t * 3.2), 6);
    expect(hard.aggression).toBeGreaterThan(0.6);
    const lift = drive((t) => Math.max(5, 25 - t * 1.5), 6);
    expect(lift.overrun).toBeGreaterThan(0.5);
  });

  it("GT V8 keeps recorded texture under acceleration and interpolates the synth match-EQ", () => {
    const gt = RECORDED_LOOP_BANKS["gt-v8"]!;
    expect(recordedSampleWeight(3500, 0.9, 1, gt.handover)).toBeGreaterThanOrEqual(0.5);
    expect(recordedSampleWeight(5200, 0.9, 1, gt.handover)).toBe(0);
    expect(synthMatchAt(gt.synthMatch, 1000)).toEqual([0, 0, 0, 0, 0]);
    const mid = synthMatchAt(gt.synthMatch, 2000);
    expect(mid.length).toBe(5);
    expect(synthMatchAt(undefined, 3000)).toEqual([0, 0, 0, 0, 0]);
    expect(RECORDED_LOOP_BANKS["american-v8"]!.synthMatch).toBeUndefined();
  });

  it("picks regions within the natural pitch range", () => {
    let seed = 1;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const regions = RECORDED_LOOP_BANKS["american-v8"]!.sources[0]!.regions;
    for (const rpm of [700, 900, 1300, 1800, 2400]) {
      for (let i = 0; i < 20; i += 1) {
        const r = pickRegion(regions, rpm, rand)!;
        const mean = r.rpm.reduce((a, b) => a + b, 0) / r.rpm.length;
        expect(rpm / mean).toBeGreaterThanOrEqual(MIN_GRAIN_RATE);
        expect(rpm / mean).toBeLessThanOrEqual(MAX_GRAIN_RATE);
      }
    }
  });

  it("only same-origin versioned assets, all credited", () => {
    for (const bank of Object.values(RECORDED_LOOP_BANKS)) {
      for (const src of bank.sources) {
        expect(src.url).toMatch(/^\/sample-packs\/recorded\/v\d+\/.+\.m4a$/);
        for (const r of src.regions) expect(r.end).toBeGreaterThan(r.start);
      }
    }
    expect(RECORDED_LOOP_CREDITS.some((c) => c.licence === "CC BY 4.0")).toBe(true);
  });
});

describe("recordedLowShelfHz", () => {
  it("keeps the fixed 120 Hz shelf unless a bank opts into rpm tracking", () => {
    expect(recordedLowShelfHz(RECORDED_LOOP_BANKS["american-v8"]!.eq, 3000)).toBe(120);
  });
  it("GT V8: unchanged up to 2,200 rpm, follows firing frequency above, capped", () => {
    const eq = RECORDED_LOOP_BANKS["gt-v8"]!.eq;
    expect(recordedLowShelfHz(eq, 800)).toBe(120);
    expect(recordedLowShelfHz(eq, 2200)).toBe(120);
    expect(recordedLowShelfHz(eq, 3300)).toBeCloseTo(180, 5);
    expect(recordedLowShelfHz(eq, 9000)).toBe(240);
  });
});

describe("motorcycle recorded banks", () => {
  it("superbike keeps recordings at idle and fades them out before the 14k scream", async () => {
    const { getRecordedLoopBank, recordedSampleWeight } = await import("./recorded-loops");
    const sb = getRecordedLoopBank("motorcycle-inline-4")!;
    expect(sb.sources[0]!.maxRate).toBeGreaterThan(2);
    expect(recordedSampleWeight(1200, 0.1, 0, sb.handover)).toBe(1);
    expect(recordedSampleWeight(9000, 0.9, 1, sb.handover)).toBeGreaterThanOrEqual(0.3);
    expect(recordedSampleWeight(13000, 1, 1, sb.handover)).toBe(0);
  });
  it("big twin recording reaches down to the 900 rpm idle", async () => {
    const { getRecordedLoopBank, pickRegion } = await import("./recorded-loops");
    const bt = getRecordedLoopBank("v-twin-cruiser")!;
    const src = bt.sources[0]!;
    expect(pickRegion(src.regions, 900, () => 0.5, src.minRate, src.maxRate)).not.toBeNull();
  });
  it("V8 hand-over is unchanged", async () => {
    const { getRecordedLoopBank } = await import("./recorded-loops");
    expect(getRecordedLoopBank("gt-v8")!.handover.topRpm).toBeUndefined();
    expect(getRecordedLoopBank("american-v8")!.handover.topRpm).toBeUndefined();
  });
});

describe("F1 pass-by band", () => {
  it("adds texture only at high rpm", async () => {
    const { getRecordedLoopBank, recordedSampleWeight } = await import("./recorded-loops");
    const f1 = getRecordedLoopBank("f1-v10")!;
    expect(recordedSampleWeight(4500, 0.1, 0, f1.handover)).toBe(0);
    expect(recordedSampleWeight(16000, 1, 1, f1.handover)).toBeCloseTo(0.45, 2);
  });
});
