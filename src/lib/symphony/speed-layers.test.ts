import { describe, expect, it } from "vitest";
import { VIRAL_MIX_PACK } from "./packs/viral-mix";
import { gainsFromSpeedGates, smoothstep } from "./speed-layers";

describe("Viral Epic Party speed layering", () => {
  it("starts with a distinctive stadium beat at a standstill", () => {
    const g = gainsFromSpeedGates(VIRAL_MIX_PACK, 0, "stopped", 0);
    expect(g.drumsLow).toBeGreaterThan(0.8);
    expect(g.rhythm).toBeGreaterThan(0.8);
    expect(g.piano ?? 0).toBe(0);
    expect(g.cello ?? 0).toBe(0);
    expect(g.lead ?? 0).toBe(0);
    expect(g.brass ?? 0).toBe(0);
  });

  it("adds the accordion hook on the roll, then the ElCA/MOSO chant by 40 km/h", () => {
    const roll = gainsFromSpeedGates(VIRAL_MIX_PACK, 20, "calm", 0.15);
    expect(roll.drumsLow).toBeGreaterThan(0.8);
    expect(roll.piano).toBeGreaterThan(0.8);
    expect(roll.cello ?? 0).toBeGreaterThan(0.1);
    expect(roll.strings ?? 0).toBe(0);

    const mid = gainsFromSpeedGates(VIRAL_MIX_PACK, 45, "cruise", 0.28);
    expect(mid.piano).toBeGreaterThan(0.9);
    expect(mid.cello).toBeGreaterThan(0.4);
    expect(mid.atmosphere).toBeGreaterThan(0.4);
    expect(mid.strings).toBeGreaterThan(0.4);
    expect(mid.bass ?? 0).toBe(0);
    expect(mid.lead ?? 0).toBe(0);
  });

  it("adds bass and hats at 60–80, then brass stabs around 80–100", () => {
    const mid = gainsFromSpeedGates(VIRAL_MIX_PACK, 70, "building", 0.4);
    expect(mid.bass).toBeGreaterThan(0.5);
    expect(mid.drumsHigh).toBeGreaterThan(0.4);
    expect(mid.brass ?? 0).toBe(0);
    expect(mid.lead ?? 0).toBe(0);

    const cruise = gainsFromSpeedGates(VIRAL_MIX_PACK, 90, "cruise", 0.36);
    expect(cruise.brass).toBeGreaterThan(0.4);
    expect(cruise.lead ?? 0).toBe(0);
    expect(cruise.cello).toBeGreaterThan(0.4);
  });

  it("adds the supersaw and Hey shouts on the highway, and opens fully at peak", () => {
    const highway = gainsFromSpeedGates(VIRAL_MIX_PACK, 160, "energetic", 0.64);
    expect(highway.lead).toBeGreaterThan(0.9);
    expect(highway.fx).toBeGreaterThan(0.5);
    expect(highway.brass).toBeGreaterThan(0.9);
    expect(highway.cello).toBeGreaterThan(0.4);

    const peak = gainsFromSpeedGates(VIRAL_MIX_PACK, 140, "peak", 0.9);
    expect(peak.drumsLow).toBe(1);
    expect(peak.lead).toBe(1);
    expect(peak.brass).toBe(1);
    expect(peak.piano).toBe(1);
    expect(peak.cello).toBeCloseTo(0.5, 5);
  });

  it("strips upper layers first when decelerating, but keeps beat, accordion and chant", () => {
    const hot = gainsFromSpeedGates(VIRAL_MIX_PACK, 160, "energetic", 0.6);
    const decel = gainsFromSpeedGates(VIRAL_MIX_PACK, 160, "decelerating", 0.6);
    expect(decel.lead ?? 0).toBeLessThan((hot.lead ?? 0) * 0.4);
    expect(decel.brass ?? 0).toBeLessThan((hot.brass ?? 0) * 0.4);
    expect(decel.drumsLow).toBeGreaterThan(0.8);
    expect(decel.piano).toBeGreaterThan(0.8);
    expect(decel.cello).toBeGreaterThan(0.3);
  });

  it("adds the festival kit with speed, not at idle or low roll", () => {
    const idle = gainsFromSpeedGates(VIRAL_MIX_PACK, 0, "stopped", 0);
    const roll = gainsFromSpeedGates(VIRAL_MIX_PACK, 20, "calm", 0.15);
    const mid = gainsFromSpeedGates(VIRAL_MIX_PACK, 70, "building", 0.4);
    const cruise = gainsFromSpeedGates(VIRAL_MIX_PACK, 90, "cruise", 0.36);
    expect(idle.kit ?? 0).toBe(0);
    expect(roll.kit ?? 0).toBe(0);
    expect(mid.kit ?? 0).toBeGreaterThan(0.3);
    expect(cruise.kit ?? 0).toBeGreaterThan(0.9);
    expect(VIRAL_MIX_PACK.edmArrangement).toBe(true);
  });

  it("smoothstep is 0 below, 1 above, and 0.5 at the midpoint", () => {
    expect(smoothstep(10, 20, 5)).toBe(0);
    expect(smoothstep(10, 20, 20)).toBe(1);
    expect(smoothstep(10, 20, 15)).toBeCloseTo(0.5, 5);
  });

  it("is an original production with no full-mix or extracted-stem shortcut", () => {
    expect(VIRAL_MIX_PACK.licensing.source).toBe("original");
    expect(VIRAL_MIX_PACK.stems.every((s) => s.manifest.source === "original")).toBe(true);
    expect(VIRAL_MIX_PACK.stems.some((s) => s.assetPath?.includes("loop-mix"))).toBe(false);
    expect(VIRAL_MIX_PACK.stems.find((s) => s.id === "piano")?.label.toLowerCase()).toContain(
      "accordion",
    );
    expect(VIRAL_MIX_PACK.stems.find((s) => s.id === "cello")?.label.toLowerCase()).toContain(
      "elca",
    );
    expect(VIRAL_MIX_PACK.bpm).toBe(120);
    expect(VIRAL_MIX_PACK.electronicLayers).toBe(false);
    expect(VIRAL_MIX_PACK.speedGates).toBeDefined();
    expect(VIRAL_MIX_PACK.oneShots?.length).toBeGreaterThan(0);
  });
});
