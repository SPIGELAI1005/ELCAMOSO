import { describe, expect, it } from "vitest";
import { interpolateScalar, lowPassToward, rejectSpike } from "@/lib/motion/filters";

describe("motion filters", () => {
  it("low-passes toward a target", () => {
    let v = 0;
    for (let i = 0; i < 40; i += 1) {
      v = lowPassToward(v, 10, 0.05, 0.2);
    }
    expect(v).toBeGreaterThan(7);
    expect(v).toBeLessThan(10.5);
  });

  it("rejects spikes beyond threshold", () => {
    const result = rejectSpike(40, 12, 5);
    expect(result.rejected).toBe(true);
    expect(result.value).toBe(12);
  });

  it("interpolates between timestamped samples", () => {
    const mid = interpolateScalar({ t: 0, v: 0 }, { t: 100, v: 10 }, 50);
    expect(mid).toBeCloseTo(5, 5);
  });
});
