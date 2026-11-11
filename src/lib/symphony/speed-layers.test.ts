import { describe, expect, it } from "vitest";
import { VIRAL_MIX_PACK } from "./packs/viral-mix";
import { gainsFromSpeedGates, smoothstep } from "./speed-layers";

describe("Viral Mix speed layering", () => {
  it("is pad-only at a standstill", () => {
    const g = gainsFromSpeedGates(VIRAL_MIX_PACK, 0, "stopped", 0);
    expect(g.atmosphere).toBeGreaterThan(0.8);
    expect(g.bass ?? 0).toBe(0);
    expect(g.drumsLow ?? 0).toBe(0);
    expect(g.lead ?? 0).toBe(0);
    expect(g.brass ?? 0).toBe(0);
  });

  it("adds bass when rolling, then kick and hats around 30–50 km/h", () => {
    const roll = gainsFromSpeedGates(VIRAL_MIX_PACK, 15, "calm", 0.15);
    expect(roll.bass).toBeGreaterThan(0.6);
    expect(roll.drumsLow ?? 0).toBeLessThan(0.15);

    const mid = gainsFromSpeedGates(VIRAL_MIX_PACK, 40, "cruise", 0.25);
    expect(mid.bass).toBeGreaterThan(0.9);
    expect(mid.drumsLow).toBeGreaterThan(0.8);
    expect(mid.drumsHigh).toBeGreaterThan(0.5);
    expect(mid.rhythm ?? 0).toBeLessThan(0.15);
    expect(mid.lead ?? 0).toBe(0);
  });

  it("adds snare and keys at 60–80, then the hook at cruise", () => {
    const building = gainsFromSpeedGates(VIRAL_MIX_PACK, 70, "building", 0.4);
    expect(building.rhythm).toBeGreaterThan(0.7);
    expect(building.piano).toBeGreaterThan(0.5);
    expect(building.lead ?? 0).toBeLessThan(0.2);
    expect(building.brass ?? 0).toBe(0);

    const cruise = gainsFromSpeedGates(VIRAL_MIX_PACK, 90, "cruise", 0.36);
    expect(cruise.lead).toBeGreaterThan(0.7);
    expect(cruise.brass ?? 0).toBe(0);
  });

  it("adds vocals and percussion only at high speed, and opens fully at peak", () => {
    const pace = gainsFromSpeedGates(VIRAL_MIX_PACK, 180, "energetic", 0.64);
    expect(pace.lead).toBeGreaterThan(0.9);
    expect(pace.brass).toBeGreaterThan(0.9);
    expect(pace.cello).toBeGreaterThan(0.8);

    const peak = gainsFromSpeedGates(VIRAL_MIX_PACK, 140, "peak", 0.9);
    expect(peak.drumsLow).toBeGreaterThanOrEqual(1);
    expect(peak.lead).toBeGreaterThanOrEqual(1);
    expect(peak.brass).toBeGreaterThanOrEqual(1);
    expect(peak.cello).toBe(1);
    expect((peak.piano ?? 0) <= 0.15).toBe(true);
  });

  it("strips high layers first when decelerating", () => {
    const hot = gainsFromSpeedGates(VIRAL_MIX_PACK, 160, "energetic", 0.6);
    const decel = gainsFromSpeedGates(VIRAL_MIX_PACK, 160, "decelerating", 0.6);
    expect(decel.brass ?? 0).toBeLessThan((hot.brass ?? 0) * 0.4);
    expect(decel.lead ?? 0).toBeLessThan((hot.lead ?? 0) * 0.4);
    expect(decel.atmosphere).toBeGreaterThan(0.5);
    expect(decel.bass).toBeGreaterThan(0.5);
  });

  it("adds bass and kick weight from cruise upward, not at low speed", () => {
    const low = gainsFromSpeedGates(VIRAL_MIX_PACK, 40, "cruise", 0.25);
    const cruise = gainsFromSpeedGates(VIRAL_MIX_PACK, 90, "cruise", 0.36);
    const highway = gainsFromSpeedGates(VIRAL_MIX_PACK, 180, "energetic", 0.64);
    expect(low.bass ?? 0).toBeLessThanOrEqual(1.01);
    expect(cruise.bass ?? 0).toBeGreaterThan(low.bass ?? 0);
    expect(cruise.drumsLow ?? 0).toBeGreaterThan(low.drumsLow ?? 0);
    expect(highway.bass ?? 0).toBeGreaterThanOrEqual(cruise.bass ?? 0);
    expect(VIRAL_MIX_PACK.electronicLayers).toBe(true);
  });

  it("smoothstep is 0 below, 1 above, and 0.5 at the midpoint", () => {
    expect(smoothstep(10, 20, 5)).toBe(0);
    expect(smoothstep(10, 20, 20)).toBe(1);
    expect(smoothstep(10, 20, 15)).toBeCloseTo(0.5, 5);
  });

  it("does not use a full-mix lead shortcut", () => {
    expect(VIRAL_MIX_PACK.stems.some((s) => s.assetPath?.includes("loop-mix"))).toBe(false);
    expect(VIRAL_MIX_PACK.stems.find((s) => s.id === "lead")?.label.toLowerCase()).toContain(
      "hook",
    );
    expect(VIRAL_MIX_PACK.speedGates).toBeDefined();
    expect(VIRAL_MIX_PACK.oneShots?.length).toBeGreaterThan(0);
  });
});
