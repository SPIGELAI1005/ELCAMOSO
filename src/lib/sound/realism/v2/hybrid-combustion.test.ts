/**
 * Realism V2 unit coverage — deterministic firing math, sample neighbors, eligibility.
 */
import { describe, expect, it } from "vitest";
import {
  acousticEngineForProfile,
  firingHzFromRpm,
  isCombustionRealismV2Profile,
} from "@/lib/sound/realism/v2/acoustic-engine";
import {
  loadRegionFromDemand,
  playbackRateForRpm,
  SAMPLE_RATE_MAX,
  SAMPLE_RATE_MIN,
  selectSampleNeighbors,
  type CombustionSampleBank,
} from "@/lib/sound/realism/v2/sample-bank";

describe("firingHzFromRpm", () => {
  it("matches four-stroke V8 at 3000 RPM", () => {
    // 3000/60 * 8/2 = 200 Hz
    expect(firingHzFromRpm(3000, 8, "four-stroke")).toBeCloseTo(200, 5);
  });

  it("matches flat-six at 6000 RPM", () => {
    expect(firingHzFromRpm(6000, 6, "four-stroke")).toBeCloseTo(300, 5);
  });

  it("matches two-stroke formula", () => {
    expect(firingHzFromRpm(6000, 2, "two-stroke")).toBeCloseTo(200, 5);
  });
});

describe("acoustic eligibility", () => {
  it("covers priority combustion profiles", () => {
    for (const id of [
      "gt-v8",
      "american-muscle-v8",
      "flat-six-sport",
      "turbo-inline-6",
      "racing-v10",
      "race-car",
      "rally-car",
    ]) {
      expect(isCombustionRealismV2Profile(id)).toBe(true);
      expect(acousticEngineForProfile(id)?.cylinders).toBeGreaterThan(0);
    }
  });

  it("does not claim electronic profiles", () => {
    expect(isCombustionRealismV2Profile("cyber-pulse")).toBe(false);
    expect(acousticEngineForProfile("cyber-pulse")).toBeNull();
  });

  it("gives American V8 more idle irregularity than GT V8", () => {
    const gt = acousticEngineForProfile("gt-v8")!;
    const am = acousticEngineForProfile("american-muscle-v8")!;
    expect(am.idleIrregularity).toBeGreaterThan(gt.idleIrregularity);
  });

  it("gives Racing V10 denser intake than GT V8", () => {
    const gt = acousticEngineForProfile("gt-v8")!;
    const v10 = acousticEngineForProfile("racing-v10")!;
    expect(v10.intakePresence).toBeGreaterThan(gt.intakePresence);
    expect(v10.cylinders).toBe(10);
  });
});

describe("sample bank helpers", () => {
  const bank: CombustionSampleBank = {
    personalityId: "gt-v8",
    entries: [
      { assetId: "a", personalityId: "gt-v8", rpmRef: 900, load: "idle" },
      { assetId: "b", personalityId: "gt-v8", rpmRef: 2500, load: "low" },
      { assetId: "c", personalityId: "gt-v8", rpmRef: 3500, load: "low" },
      { assetId: "d", personalityId: "gt-v8", rpmRef: 4500, load: "high" },
    ],
  };

  it("blends between adjacent RPM refs", () => {
    const { a, b, blend } = selectSampleNeighbors(bank, 3000, "low");
    expect(a?.assetId).toBe("b");
    expect(b?.assetId).toBe("c");
    expect(blend).toBeCloseTo(0.5, 1);
  });

  it("clamps playback rate", () => {
    expect(playbackRateForRpm(900, 2500)).toBe(SAMPLE_RATE_MIN);
    expect(playbackRateForRpm(5000, 2500)).toBe(SAMPLE_RATE_MAX);
    expect(playbackRateForRpm(2500, 2500)).toBeCloseTo(1, 5);
  });

  it("maps demand to load regions", () => {
    expect(loadRegionFromDemand(0.05, false)).toBe("idle");
    expect(loadRegionFromDemand(0.5, false)).toBe("medium");
    expect(loadRegionFromDemand(0.2, true)).toBe("overrun");
  });
});
