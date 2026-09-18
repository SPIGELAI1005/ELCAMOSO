import { describe, expect, it } from "vitest";
import { machinePresenceScale, musicSpaceScale, perceptualFusionGains } from "./mixer";
import { parseKeyRootHz } from "./harmonic-resonance";
import { getFusionPreset, isFusionProfileId, listFusionPresets } from "./presets";

describe("Fusion mixer", () => {
  it("uses perceptual curves - default mix favors music without silencing machine", () => {
    const g = perceptualFusionGains(0.6);
    expect(g.music).toBeGreaterThan(g.machine);
    expect(g.machine).toBeGreaterThan(0.2);
    expect(g.music).toBeLessThan(0.85);
  });

  it("full machine / full music extremes stay bounded", () => {
    const machine = perceptualFusionGains(0);
    const music = perceptualFusionGains(1);
    expect(machine.machine).toBeGreaterThan(0.5);
    expect(machine.music).toBeLessThan(0.02);
    expect(music.music).toBeGreaterThan(0.5);
    expect(music.machine).toBeLessThan(0.02);
  });

  it("raises machine presence on demand without dance pumping by default", () => {
    const calm = machinePresenceScale({
      driverDemand: 0.2,
      tension: 0.1,
      movementState: "cruise",
      softPump: false,
    });
    const push = machinePresenceScale({
      driverDemand: 0.9,
      tension: 0.6,
      movementState: "building",
      softPump: false,
    });
    expect(push).toBeGreaterThan(calm);
    const peak = machinePresenceScale({
      driverDemand: 0.5,
      tension: 0.4,
      movementState: "peak",
      softPump: false,
    });
    const peakPump = machinePresenceScale({
      driverDemand: 0.5,
      tension: 0.4,
      movementState: "peak",
      softPump: true,
    });
    expect(peakPump).toBeLessThan(peak);
  });

  it("leaves slight music space on strong tip-in", () => {
    expect(musicSpaceScale({ movementState: "cruise", driverDemand: 0.9 })).toBeLessThan(1);
  });
});

describe("Fusion presets", () => {
  it("ships four named blends without OEM labels", () => {
    const presets = listFusionPresets();
    expect(presets.length).toBeGreaterThanOrEqual(4);
    expect(presets.map((p) => p.id)).toContain("fusion-road-anthem");
    expect(presets.map((p) => p.id)).toContain("fusion-future-pulse");
    for (const p of presets) {
      expect(p.name).not.toMatch(/Tesla|BMW|Porsche/i);
      expect(isFusionProfileId(p.id)).toBe(true);
      expect(getFusionPreset(p.id)?.symphonyProfileId.startsWith("symphony-")).toBe(true);
    }
  });

  it("parses musical key roots for harmonic resonance", () => {
    expect(parseKeyRootHz("D minor")).toBeCloseTo(146.83, 0);
    expect(parseKeyRootHz("A minor")).toBeCloseTo(220, 0);
  });
});
