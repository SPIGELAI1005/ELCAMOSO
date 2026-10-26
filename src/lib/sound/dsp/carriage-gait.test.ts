import { describe, expect, it } from "vitest";
import { smoothGaitPhase } from "@/lib/sound/dsp/layers";

describe("carriage smooth gait", () => {
  it("caps gallop stride rate at high speed", () => {
    for (const kmh of [40, 60, 90, 140]) expect(smoothGaitPhase(kmh, 2.9).rate).toBeLessThanOrEqual(2.9);
  });
  it("has no jumps between gaits (rate and footfalls are continuous)", () => {
    let prev = smoothGaitPhase(0, 2.9);
    for (let kmh = 0.1; kmh <= 80; kmh += 0.1) {
      const g = smoothGaitPhase(kmh, 2.9);
      expect(Math.abs(g.rate - prev.rate)).toBeLessThan(0.03);
      g.pattern.forEach((o, i) => expect(Math.abs(o - prev.pattern[i]!)).toBeLessThan(0.02));
      expect(g.rate).toBeGreaterThanOrEqual(prev.rate - 1e-9);
      prev = g;
    }
  });
});
