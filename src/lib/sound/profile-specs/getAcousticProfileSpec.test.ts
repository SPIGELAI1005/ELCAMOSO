import { describe, expect, it } from "vitest";
import { IDLE_STATE } from "@/lib/drive/model";
import { familyForProfile } from "@/lib/sound/realism/families";
import { createMotionTracker, motionFromDrive } from "@/lib/sound/realism/motion";
import { getProfile } from "@/lib/sound/profiles";
import { PUBLIC_PROFILE_IDS } from "@/lib/sound/profile-experience-config";
import {
  CORE_SOUND_PROFILE_IDS,
  allCatalogAcousticProfileSpecs,
  clearAcousticProfileSpecCache,
  getAcousticProfileSpec,
  mismatchedPackageFamilyIds,
  packageFamilyForProfile,
  validateAcousticProfileSpec,
} from "@/lib/sound/profile-specs";
import type { AcousticProfileSpec } from "@/lib/sound/profile-specs/types";

describe("getAcousticProfileSpec", () => {
  it("covers all 47 core Sound Profile IDs with valid regime and control maps", () => {
    expect(CORE_SOUND_PROFILE_IDS).toHaveLength(47);
    clearAcousticProfileSpecCache();
    for (const id of CORE_SOUND_PROFILE_IDS) {
      const catalog = getProfile(id);
      const spec = getAcousticProfileSpec(id);
      expect(spec.id).toBe(id);
      expect(spec.family).toBe(familyForProfile(id));
      expect(spec.packageFamily).toBe(packageFamilyForProfile(id));
      expect(spec.layers.roles.length).toBeGreaterThan(0);
      expect(spec.controls.pitchDriver).toBeTruthy();
      expect(spec.controls.loadDriver).toBeTruthy();
      expect(spec.regimes.drivetrainMode).toBe(catalog.drivetrainMode);
      expect(spec.regimes.phaseKeys).toContain("accelerationTexture");
      expect(spec.dsp.transitionTauSeconds).toBeGreaterThan(0);
      expect(spec.events.maxEventVoices).toBeGreaterThanOrEqual(0);
      expect(spec.loudness.maxGainCeiling).toBe(0.85);
      expect(spec.loudness.profileTrim).toBeGreaterThanOrEqual(0.4);
      expect(spec.loudness.profileTrim).toBeLessThanOrEqual(1.6);
      expect(spec.sampleBank.approvedAssetsPresent).toBe(false);
      expect(spec.acceptance.status).toBeTruthy();
      expect(spec.recipe.rendererKind).toBeTruthy();
      expect(spec.recipe.inheritance.familyDefaultsId.startsWith("foundation:")).toBe(true);
      expect(spec.recipe.inheritance.overrides.length).toBeGreaterThan(0);
      expect(spec.recipe.sampleBankRecipe.proceduralFallback).toBe(true);
      expect(spec.recipe.headroom.maxGainCeiling).toBe(0.85);
      expect(spec.recipe.listening.listeningVerdict).toBe("pending");
      // Specs must be JSON-serializable across SSR/client boundaries.
      expect(() => JSON.parse(JSON.stringify(spec))).not.toThrow();
    }
  });

  it("covers all 59 catalog IDs with unique recipe mappings", () => {
    expect(PUBLIC_PROFILE_IDS).toHaveLength(59);
    clearAcousticProfileSpecCache();
    const specs = allCatalogAcousticProfileSpecs();
    expect(specs).toHaveLength(59);
    const ids = specs.map((s) => s.id);
    expect(new Set(ids).size).toBe(59);
    for (const spec of specs) {
      expect(spec.recipe.inheritance.overrides.some((o) => o === `identity:${spec.id}`)).toBe(
        true,
      );
    }
  });

  it("marks Realism V2 combustion and turbo regimes where expected", () => {
    expect(getAcousticProfileSpec("gt-v8").regimes.realismV2Combustion).toBe(true);
    expect(getAcousticProfileSpec("american-muscle-v8").regimes.realismV2Combustion).toBe(true);
    expect(getAcousticProfileSpec("turbo-inline-6").regimes.hasForcedInductionDynamics).toBe(true);
    expect(getAcousticProfileSpec("rally-car").regimes.hasForcedInductionDynamics).toBe(true);
    expect(getAcousticProfileSpec("cyber-pulse").regimes.realismV2Combustion).toBe(false);
    expect(getAcousticProfileSpec("open-wind").regimes.hasForcedInductionDynamics).toBe(false);
  });

  it("returns a validated fallback for unknown ids without throwing", () => {
    const spec = getAcousticProfileSpec("not-a-real-profile-zzz");
    expect(spec.id).toBe("not-a-real-profile-zzz");
    expect(spec.family).toBe(familyForProfile("not-a-real-profile-zzz"));
    expect(spec.family).toBe("physical");
    expect(spec.familyMismatch).toBeNull();
    // getProfile falls back to the first catalog entry for unknown ids; family stays physical.
    expect(["continuous", "virtual-transmission"]).toContain(spec.regimes.drivetrainMode);
    expect(spec.layers.roles.length).toBeGreaterThan(0);
    expect(spec.loudness.maxGainCeiling).toBe(0.85);
    expect(spec.recipe).toBeTruthy();
    expect(spec.recipe.sampleBankRecipe.proceduralFallback).toBe(true);
  });

  it("clamps invalid numeric fields during validation", () => {
    const base = getAcousticProfileSpec("gt-v8");
    const broken = {
      ...base,
      dsp: {
        ...base.dsp,
        transitionTauSeconds: 99,
        phases: { ...base.dsp.phases, accelerationTexture: -5 },
      },
      events: { ...base.events, maxEventVoices: 100, variationDepth: 9 },
      loudness: { profileTrim: 9, maxGainCeiling: 2 },
      recipe: {
        ...base.recipe,
        cycle: {
          ...base.recipe.cycle,
          idleRpm: -50,
          maxRpm: 999999,
          cycleVariation: 4,
          harmonicOrderWeights: [2, -1, 0.5],
        },
        virtualTransmission: {
          ...base.recipe.virtualTransmission,
          torqueCutMs: 5000,
          downshiftBlip: 3,
        },
        headroom: {
          ...base.recipe.headroom,
          maxGainCeiling: 2,
          antiHarshnessGainDb: 5,
        },
        listening: { listeningVerdict: "maybe", notes: 12 },
      },
    } as unknown as AcousticProfileSpec;
    const fixed = validateAcousticProfileSpec(broken);
    expect(fixed.dsp.transitionTauSeconds).toBeLessThanOrEqual(2);
    expect(fixed.dsp.phases.accelerationTexture).toBe(0);
    expect(fixed.events.maxEventVoices).toBeLessThanOrEqual(8);
    expect(fixed.loudness.profileTrim).toBeLessThanOrEqual(1.6);
    expect(fixed.loudness.maxGainCeiling).toBe(0.85);
    expect(fixed.recipe.cycle.idleRpm).toBe(0);
    expect(fixed.recipe.cycle.maxRpm).toBeLessThanOrEqual(20000);
    expect(fixed.recipe.cycle.cycleVariation).toBeLessThanOrEqual(1);
    expect(fixed.recipe.cycle.harmonicOrderWeights.every((w) => w >= 0 && w <= 1)).toBe(true);
    expect(fixed.recipe.virtualTransmission.torqueCutMs).toBeLessThanOrEqual(800);
    expect(fixed.recipe.virtualTransmission.downshiftBlip).toBeLessThanOrEqual(1);
    expect(fixed.recipe.headroom.maxGainCeiling).toBe(0.85);
    expect(fixed.recipe.headroom.antiHarshnessGainDb).toBeLessThanOrEqual(0);
    expect(fixed.recipe.listening.listeningVerdict).toBe("pending");
  });

  it("repairs a missing recipe block with a safe validated recipe", () => {
    const base = getAcousticProfileSpec("cyber-pulse");
    const { recipe: _removed, ...rest } = base;
    const fixed = validateAcousticProfileSpec(rest as AcousticProfileSpec);
    expect(fixed.recipe.rendererKind).toBe("electric-designed");
    expect(fixed.recipe.virtualTransmission.allowCombustionShiftAccents).toBe(false);
  });

  it("keeps gearless profiles free of combustion pops / RPM clacks", () => {
    const gearlessIds = [
      "cyber-pulse",
      "open-wind",
      "formula-electric",
      "dragon",
      "neon-drive",
      "symphony-cinematic-rock",
      "world-space-drive",
      "fusion-road-anthem",
    ];
    for (const id of gearlessIds) {
      const spec = getAcousticProfileSpec(id);
      expect(spec.regimes.drivetrainMode).toBe("continuous");
      expect(spec.recipe.virtualTransmission.enabled).toBe(false);
      expect(spec.recipe.virtualTransmission.allowCombustionShiftAccents).toBe(false);
      expect(spec.recipe.capabilities).not.toContain("combustion-shift-accents");
      expect(spec.recipe.cycle.stroke).toBe("none");
      expect(spec.recipe.cycle.cylinders).toBe(0);
    }
  });

  it("gives combustion Realism V2 profiles four-stroke cycle geometry and VT accents", () => {
    const gt = getAcousticProfileSpec("gt-v8");
    expect(gt.recipe.rendererKind).toBe("combustion-hybrid-v2");
    expect(gt.recipe.cycle.stroke).toBe("four-stroke");
    expect(gt.recipe.cycle.cycleDegrees).toBe(720);
    expect(gt.recipe.cycle.cylinders).toBe(8);
    expect(gt.recipe.cycle.idleRpm).toBeGreaterThan(0);
    expect(gt.recipe.cycle.maxRpm).toBeGreaterThan(gt.recipe.cycle.idleRpm);
    expect(gt.recipe.virtualTransmission.enabled).toBe(true);
    expect(gt.recipe.virtualTransmission.allowCombustionShiftAccents).toBe(true);
    expect(gt.recipe.virtualTransmission.upshiftThresholdsKmh.length).toBeGreaterThan(0);
    expect(gt.recipe.capabilities).toContain("combustion-events");

    const muscle = getAcousticProfileSpec("american-muscle-v8");
    expect(muscle.recipe.cycle.architecture).toContain("lope");
    expect(muscle.recipe.inheritance.overrides.some((o) => o.includes("cycle"))).toBe(true);
  });

  it("does not let comedy VT profiles inherit combustion shift accents", () => {
    for (const id of ["farting-car", "kazoo-kart", "electric-hypercar"] as const) {
      const spec = getAcousticProfileSpec(id);
      expect(spec.recipe.virtualTransmission.enabled).toBe(true);
      expect(spec.recipe.virtualTransmission.allowCombustionShiftAccents).toBe(false);
      expect(spec.recipe.capabilities).not.toContain("combustion-shift-accents");
    }
  });

  it("marks missing samples with procedural fallback and separates listening from runtime", () => {
    const gt = getAcousticProfileSpec("gt-v8");
    expect(gt.sampleBank.approvedAssetsPresent).toBe(false);
    expect(gt.recipe.sampleBankRecipe.approvedAssetsPresent).toBe(false);
    expect(gt.recipe.sampleBankRecipe.proceduralFallback).toBe(true);
    // Listening stays out of acceptance runtime meta.
    expect(gt.acceptance).not.toHaveProperty("listeningVerdict");
    expect(gt.recipe.listening.listeningVerdict).toBe("pending");
  });

  it("records package vs runtime mismatches for neon-drive, dragon, thunder-beast only", () => {
    expect(mismatchedPackageFamilyIds().sort()).toEqual(
      ["dragon", "neon-drive", "thunder-beast"].sort(),
    );

    const neon = getAcousticProfileSpec("neon-drive");
    expect(neon.family).toBe("designed");
    expect(neon.packageFamily).toBe("musical");
    expect(neon.familyMismatch?.runtimeFamily).toBe("designed");
    expect(neon.familyMismatch?.packageFamily).toBe("musical");
    expect(neon.familyMismatch?.documentation).toContain("FAMILY_CLASSIFICATION_MISMATCHES");

    const dragon = getAcousticProfileSpec("dragon");
    expect(dragon.family).toBe("designed");
    expect(dragon.packageFamily).toBe("environmental");
    expect(dragon.familyMismatch).not.toBeNull();

    const thunder = getAcousticProfileSpec("thunder-beast");
    expect(thunder.family).toBe("designed");
    expect(thunder.packageFamily).toBe("environmental");
    expect(thunder.familyMismatch).not.toBeNull();

    const gt = getAcousticProfileSpec("gt-v8");
    expect(gt.family).toBe("physical");
    expect(gt.packageFamily).toBe("physical");
    expect(gt.familyMismatch).toBeNull();
  });

  it("does not change familyForProfile assignments for the mismatched trio", () => {
    expect(familyForProfile("neon-drive")).toBe("designed");
    expect(familyForProfile("dragon")).toBe("designed");
    expect(familyForProfile("thunder-beast")).toBe("designed");
  });
});

describe("family mismatch routing lock (motion)", () => {
  /**
   * Locks designed-family motion envelopes for the mismatched trio.
   * Flipping FAMILY_BY_ID to package labels would change these values.
   */
  it("keeps designed-family motion envelopes for neon-drive, dragon, thunder-beast", () => {
    const state = {
      ...IDLE_STATE,
      speed: 18,
      acceleration: 1.2,
      throttle: 0.55,
      load: 0.4,
      rpm: 0,
      gear: 0,
      regen: 0,
      timestamp: 1000,
    };

    // neon-drive / dragon are event-driven: designed branch scales fundamental with load.
    // If family became musical/environmental, fundamental would stay at baseFrequency.
    for (const id of ["neon-drive", "dragon"] as const) {
      const profile = getProfile(id);
      const frame = motionFromDrive(state, profile, createMotionTracker(), 1);
      expect(frame.virtualRpm).toBe(0);
      expect(frame.engineFundamentalHz).toBeGreaterThan(profile.voice.baseFrequency);
      expect(frame.bodyLevel).toBeGreaterThan(0.08);
    }

    // thunder-beast is ambient, so RPM path is already ambient-gated; lock pitchTau override
    // and confirm ambient fundamental (family flip would still change speed/throttle taus).
    const thunder = getProfile("thunder-beast");
    const thunderFrame = motionFromDrive(state, thunder, createMotionTracker(), 1);
    expect(thunderFrame.engineFundamentalHz).toBe(thunder.voice.baseFrequency);
    expect(thunderFrame.pitchTau).toBe(0.32);
    expect(thunderFrame.bodyLevel).toBeGreaterThan(0.08);
  });
});
