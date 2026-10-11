import { describe, expect, it } from "vitest";
import { acousticEngineBaseForProfile } from "@/lib/sound/realism/v2/acoustic-engine";
import {
  buildLegacyOrderBandSpec,
  buildOrderBandSpec,
  buildProfileOrderBandSpec,
} from "@/lib/sound/realism/v2/profile-order-bands";

describe("profile order bands", () => {
  const muscle = acousticEngineBaseForProfile("american-muscle-v8")!;

  it("legacy path keeps three firing-order bands for V8", () => {
    const bands = buildLegacyOrderBandSpec(muscle);
    expect(bands).toHaveLength(3);
    expect(bands[0]!.order).toBe(2); // half of firing order 4
    expect(bands[1]!.order).toBe(4);
    expect(bands[2]!.order).toBe(8);
  });

  it("default buildOrderBandSpec matches legacy (flag off in tests)", () => {
    expect(buildOrderBandSpec(muscle, false)).toEqual(buildLegacyOrderBandSpec(muscle));
  });

  it("profile path consumes supportRatios as crank orders", () => {
    const bands = buildProfileOrderBandSpec(muscle);
    expect(bands.length).toBeGreaterThanOrEqual(3);
    expect(bands[0]!.order).toBe(muscle.supportRatios[0]);
    expect(bands[0]!.weight).toBeCloseTo(muscle.supportWeights[0]!, 5);
    // Changing a weight changes the matching band, not an unrelated profile.
    const tweaked = {
      ...muscle,
      supportWeights: muscle.supportWeights.map((w, i) => (i === 0 ? 0.11 : w)),
    };
    const tweakedBands = buildProfileOrderBandSpec(tweaked);
    expect(tweakedBands[0]!.weight).toBeCloseTo(0.11, 5);
    expect(tweakedBands[1]!.weight).toBeCloseTo(bands[1]!.weight, 5);
  });

  it("falls back to legacy when profile arrays are empty", () => {
    const empty = { ...muscle, supportRatios: [], supportWeights: [] };
    expect(buildProfileOrderBandSpec(empty)).toEqual(buildLegacyOrderBandSpec(muscle));
  });
});
