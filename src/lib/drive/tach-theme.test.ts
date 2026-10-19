import { describe, expect, it } from "vitest";
import { introNeedle, resolveTachThemeId, tachScaleLabels, TACH_THEMES } from "./tach-theme";

const car = (modeId: string) =>
  resolveTachThemeId({
    profileId: "racing-v10",
    category: "Motorsport",
    modeBinding: "shift-map",
    modeId,
  });
const mood = (profileId: string, category: string, modeId = "cruise", speedUnit?: string) =>
  resolveTachThemeId({ profileId, category, modeBinding: "mood", modeId, speedUnit });

describe("resolveTachThemeId", () => {
  it("maps gearbox shift presets to distinct designs", () => {
    expect(car("legacy")).toBe("classic");
    expect(car("city")).toBe("city");
    expect(car("touring")).toBe("touring");
    expect(car("sport")).toBe("sport");
    expect(car("race")).toBe("race");
  });
  it("themes non-car categories", () => {
    expect(mood("rocket-car", "Future", "ludicrous")).toBe("rocket");
    expect(mood("space-ship", "Future")).toBe("warp");
    expect(mood("world-space-drive", "Future", "x", "c")).toBe("warp");
    expect(mood("speed-boat", "Nautical")).toBe("nautical");
    expect(mood("private-jet", "Aviation")).toBe("aviation");
    expect(mood("storm-glider", "Nature")).toBe("aviation");
    expect(mood("steam-train", "Heritage")).toBe("rail");
    expect(mood("kazoo-kart", "Playful", "intense")).toBe("race");
    expect(mood("kazoo-kart", "Playful", "chill")).toBe("stage");
  });
});

describe("introNeedle", () => {
  it("sweeps to redline then settles on target", () => {
    expect(introNeedle(0, 0.3)).toBe(0);
    expect(introNeedle(0.5, 0.3)).toBe(1);
    expect(introNeedle(1, 0.3)).toBeCloseTo(0.3);
    for (let t = 0; t <= 1; t += 0.05) {
      const v = introNeedle(t, 0.2);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("tachScaleLabels", () => {
  it("labels rpm in thousands up to the redline", () => {
    expect(tachScaleLabels(TACH_THEMES.sport, 8500)).toEqual([
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
    ]);
    expect(tachScaleLabels(TACH_THEMES.nautical, null)).toEqual(["N", "E", "S", "W"]);
  });
});
