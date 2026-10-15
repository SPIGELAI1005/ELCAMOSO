import { describe, expect, it } from "vitest";
import {
  RECORDED_LOOP_BANKS,
  RECORDED_LOOP_CREDITS,
  recordedCruiseBlend,
  recordedPlaybackRate,
  recordedSampleWeight,
} from "./recorded-loops";

describe("recorded loops hybrid", () => {
  it("recordings carry idle/cruise and hand over to synth above ~2,300 rpm or at high load", () => {
    expect(recordedSampleWeight(800, 0.1)).toBe(1);
    expect(recordedSampleWeight(1600, 0.2)).toBe(1);
    expect(recordedSampleWeight(2300, 0.2)).toBe(0);
    expect(recordedSampleWeight(1500, 0.8)).toBe(0);
    const mid = recordedSampleWeight(2050, 0.2);
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
  });
  it("blends idle to cruise loops and keeps pitch natural", () => {
    expect(recordedCruiseBlend(800)).toBe(0);
    expect(recordedCruiseBlend(1700)).toBe(1);
    const loop = RECORDED_LOOP_BANKS["american-v8"]!.loops[0]!;
    expect(recordedPlaybackRate(loop, 100)).toBe(0.8);
    expect(recordedPlaybackRate(loop, 9000)).toBe(1.4);
  });
  it("only same-origin versioned assets, all credited", () => {
    for (const bank of Object.values(RECORDED_LOOP_BANKS)) {
      for (const loop of bank.loops) {
        expect(loop.url).toMatch(/^\/sample-packs\/recorded\/v\d+\/.+\.m4a$/);
        expect(loop.loopEnd).toBeGreaterThan(loop.loopStart);
      }
    }
    expect(RECORDED_LOOP_CREDITS.some((c) => c.licence === "CC BY 4.0")).toBe(true);
  });
});
