import { describe, expect, it } from "vitest";
import { createWhistleGovernor } from "./whistle-governor";

describe("whistle governor", () => {
  it("swells briefly on a trigger, then sits at the floor", () => {
    const g = createWhistleGovernor({ floor: 0.2, duck: 0 });
    expect(g.factor(0, 0)).toBeCloseTo(0.2, 5);
    g.trigger(1);
    expect(g.factor(1.4, 0)).toBeGreaterThan(0.95);
    expect(g.factor(3, 0)).toBeLessThan(0.3);
    expect(g.factor(10, 0)).toBeCloseTo(0.2, 3);
  });
  it("respects the cooldown, ducks under thrust and is neutral at standstill", () => {
    const g = createWhistleGovernor({ floor: 0.2, duck: 0.5, cooldownS: 8 });
    expect(g.trigger(0)).toBe(true);
    expect(g.trigger(3)).toBe(false);
    expect(g.trigger(9)).toBe(true);
    expect(g.factor(30, 1)).toBeCloseTo(0.1, 5);
    expect(g.factor(30, 1, 0)).toBe(1);
  });
});
