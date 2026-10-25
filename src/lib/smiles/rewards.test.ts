import { describe, expect, it } from "vitest";

import { anonName, berlinDay, cappedAward, hasStreak, shareBonusBase, smileLevel, weekStart } from "./rewards";

describe("smile rewards", () => {
  it("levels", () => {
    expect(smileLevel(0).name).toBe("Cruiser");
    expect(smileLevel(499).next).toBe("Smiler");
    expect(smileLevel(500).name).toBe("Smiler");
    expect(smileLevel(2000).name).toBe("Grinner");
    expect(smileLevel(5000).name).toBe("Joyrider");
    expect(smileLevel(20000)).toMatchObject({ name: "Legend", progress: 1 });
    expect(smileLevel(1250).progress).toBeCloseTo(0.5);
  });
  it("cap and founder multiplier", () => {
    expect(cappedAward(80, 0, false)).toBe(80);
    expect(cappedAward(80, 0, true)).toBe(120);
    expect(cappedAward(80, 100, false)).toBe(50);
    expect(cappedAward(80, 150, true)).toBe(0);
    expect(shareBonusBase(80)).toBe(20);
  });
  it("streak + week", () => {
    const days = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"];
    expect(hasStreak(days, "2026-10-25")).toBe(true);
    expect(hasStreak(days.slice(1), "2026-10-25")).toBe(false);
    expect(weekStart(Date.parse("2026-10-25T15:00:00Z"))).toBe("2026-10-19");
    expect(weekStart(Date.parse("2026-10-26T00:30:00+01:00"))).toBe("2026-10-26");
    expect(berlinDay(Date.parse("2026-10-25T23:30:00Z"))).toBe("2026-10-26");
    expect(anonName("abc")).toMatch(/^\w+ \w+ \d{3}$/);
  });
});
