import { describe, expect, it } from "vitest";
import { sirenModeFor } from "@/lib/sound/dsp/siren-overlay";
import { advancePolicePhase, policeLightPair, POLICE_ROOF_BAR, POLICE_HERO_SIZE } from "@/lib/drive/police-lights";
import { getProfile } from "@/lib/sound/profiles";

describe("police patrol costume", () => {
  it("uses wail when cruising and yelp in pursuit", () => {
    expect(sirenModeFor({ speed: 40 / 3.6, throttle: 0.3, acceleration: 0 })).toBe("wail");
    expect(sirenModeFor({ speed: 120 / 3.6, throttle: 0.5, acceleration: 0 })).toBe("yelp");
    expect(sirenModeFor({ speed: 30 / 3.6, throttle: 0.9, acceleration: 3 })).toBe("yelp");
  });
  it("is a V8 profile", () => {
    const p = getProfile("police-patrol") as unknown as { traits?: string[] };
    expect(p.traits).toContain("V8");
  });
  it("roof bar sits inside the hero image and phase is shared per frame", () => {
    for (const b of [POLICE_ROOF_BAR.red, POLICE_ROOF_BAR.blue]) {
      expect(b.cx).toBeLessThan(POLICE_HERO_SIZE.w);
      expect(b.cy).toBeLessThan(POLICE_HERO_SIZE.h * 0.3);
    }
    advancePolicePhase(1000, 50);
    const a = advancePolicePhase(1500, 50);
    expect(advancePolicePhase(1500, 120)).toBe(a);
    const { red, blue } = policeLightPair(a);
    expect(red + blue).toBeCloseTo(1);
  });
});
