import { describe, expect, it } from "vitest";
import { IDLE_STATE } from "@/lib/drive/model";
import { familyForProfile } from "@/lib/sound/realism/families";
import { createMotionTracker, motionFromDrive } from "@/lib/sound/realism/motion";
import { getProfile } from "@/lib/sound/profiles";
import {
  CORE_SOUND_PROFILE_IDS,
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
    } as AcousticProfileSpec;
    const fixed = validateAcousticProfileSpec(broken);
    expect(fixed.dsp.transitionTauSeconds).toBeLessThanOrEqual(2);
    expect(fixed.dsp.phases.accelerationTexture).toBe(0);
    expect(fixed.events.maxEventVoices).toBeLessThanOrEqual(8);
    expect(fixed.loudness.profileTrim).toBeLessThanOrEqual(1.6);
    expect(fixed.loudness.maxGainCeiling).toBe(0.85);
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
