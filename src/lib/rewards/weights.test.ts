import { afterEach, describe, expect, it } from "vitest";

import {
  selectWeightedReward,
  setRewardRandomForTests,
  validateAndBuildPool,
} from "./weights";
import type { WeightedRewardDefinition } from "./types";

const sample: WeightedRewardDefinition[] = [
  {
    rewardId: "a",
    kind: "cockpit_theme",
    weight: 1,
    label: "A",
    termsSummary: "A",
    themeId: "a",
  },
  {
    rewardId: "b",
    kind: "cockpit_theme",
    weight: 3,
    label: "B",
    termsSummary: "B",
    themeId: "b",
  },
];

afterEach(() => {
  setRewardRandomForTests(null);
});

describe("reward weights", () => {
  it("rejects NaN, negative, and zero-total pools", () => {
    expect(
      validateAndBuildPool([{ ...sample[0]!, weight: Number.NaN }]).ok,
    ).toBe(false);
    expect(
      validateAndBuildPool([{ ...sample[0]!, weight: -1 }]).ok,
    ).toBe(false);
    expect(
      validateAndBuildPool([
        { ...sample[0]!, weight: 0 },
        { ...sample[1]!, weight: 0 },
      ]).ok,
    ).toBe(false);
    expect(validateAndBuildPool([{ ...sample[0]!, weight: Infinity }]).ok).toBe(false);
  });

  it("uses deterministic RNG injection for tests only", () => {
    const validated = validateAndBuildPool(sample);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    setRewardRandomForTests(() => 0);
    expect(selectWeightedReward(validated.pool).rewardId).toBe("a");
    setRewardRandomForTests(() => 1000); // milli total = 4000
    expect(selectWeightedReward(validated.pool).rewardId).toBe("b");
  });
});
