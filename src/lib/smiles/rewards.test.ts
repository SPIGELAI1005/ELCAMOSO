import { describe, expect, it } from "vitest";

import {
  anonName,
  berlinDay,
  cappedAward,
  challengeEligibleAt,
  hasStreak,
  higherSmileLevel,
  leaderboardBadgeFor,
  mergeOwnedItems,
  shareBonusBase,
  smileLevel,
  smileLevelWithFloor,
  themesUnlockedByLevel,
  weekStart,
} from "./rewards";

describe("smile rewards", () => {
  it("levels", () => {
    expect(smileLevel(0).name).toBe("Cruiser");
    expect(smileLevel(399).next).toBe("Smiler");
    expect(smileLevel(400).name).toBe("Smiler");
    expect(smileLevel(1200).name).toBe("Grinner");
    expect(smileLevel(3000).name).toBe("Joyrider");
    expect(smileLevel(8000)).toMatchObject({ name: "Legend", progress: 1 });
    expect(smileLevel(800).progress).toBeCloseTo(0.5);
  });

  it("never drops below a stored peak when thresholds change", () => {
    expect(smileLevelWithFloor(0, "Smiler").name).toBe("Smiler");
    expect(smileLevelWithFloor(399, "Joyrider").name).toBe("Joyrider");
    expect(smileLevelWithFloor(1226, "Smiler").name).toBe("Grinner");
    expect(smileLevelWithFloor(1226, null).name).toBe("Grinner");
    expect(higherSmileLevel("Smiler", "Grinner")).toBe("Grinner");
    expect(higherSmileLevel("Legend", "Cruiser")).toBe("Legend");
    const held = smileLevelWithFloor(100, "Joyrider");
    expect(held).toMatchObject({ name: "Joyrider", next: "Legend", nextAt: 8000 });
  });

  it("unlocks themes and board marks by level without a purchase", () => {
    expect(themesUnlockedByLevel("Cruiser")).toEqual([]);
    expect(themesUnlockedByLevel("Smiler")).toEqual(["theme-midnight"]);
    expect(themesUnlockedByLevel("Grinner")).toEqual(["theme-midnight", "theme-ember"]);
    expect(themesUnlockedByLevel("Joyrider")).toContain("theme-chrome");
    expect(themesUnlockedByLevel("Legend")).toEqual([
      "theme-midnight",
      "theme-ember",
      "theme-chrome",
      "theme-legend",
    ]);
    expect(challengeEligibleAt("Smiler")).toBe(false);
    expect(challengeEligibleAt("Grinner")).toBe(true);
    expect(leaderboardBadgeFor("Cruiser")).toBeNull();
    expect(leaderboardBadgeFor("Smiler")).toBe("mark");
    expect(leaderboardBadgeFor("Legend")).toBe("crown");
    expect(mergeOwnedItems(["theme-midnight"], "Joyrider")).toEqual([
      "theme-midnight",
      "theme-ember",
      "theme-chrome",
    ]);
  });

  it("cap and founder multiplier", () => {
    expect(cappedAward(80, 0, false)).toBe(80);
    expect(cappedAward(80, 0, true)).toBe(120);
    expect(cappedAward(80, 100, false)).toBe(50);
    expect(cappedAward(80, 150, true)).toBe(0);
    expect(cappedAward(51, 0, true)).toBe(77);
    expect(shareBonusBase(80)).toBe(20);
  });
  it("streak + week", () => {
    const days = [
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ];
    expect(hasStreak(days, "2026-10-25")).toBe(true);
    expect(hasStreak(days.slice(1), "2026-10-25")).toBe(false);
    expect(weekStart(Date.parse("2026-10-25T15:00:00Z"))).toBe("2026-10-19");
    expect(weekStart(Date.parse("2026-10-26T00:30:00+01:00"))).toBe("2026-10-26");
    expect(berlinDay(Date.parse("2026-10-25T23:30:00Z"))).toBe("2026-10-26");
    expect(anonName("abc")).toMatch(/^\w+ \w+ \d{3}$/);
  });
});
