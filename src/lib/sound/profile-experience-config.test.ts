import { describe, expect, it } from "vitest";
import { SOUND_PROFILES } from "@/lib/sound/profiles";
import {
  PROFILE_EXPERIENCE_CONFIG,
  PUBLIC_PROFILE_IDS,
  profileExperienceConfig,
} from "@/lib/sound/profile-experience-config";
import { inferLayerRole, phaseRoleGain } from "@/lib/sound/realism/improved-synth";
import type { MotionFrame } from "@/lib/sound/realism/types";

describe("profile experience configuration", () => {
  it("covers the live registry exactly without changing public order", () => {
    const runtimeIds = SOUND_PROFILES.map((profile) => profile.id);
    expect(PUBLIC_PROFILE_IDS).toEqual(runtimeIds);
    expect(Object.keys(PROFILE_EXPERIENCE_CONFIG)).toEqual(runtimeIds);
    expect(new Set(runtimeIds).size).toBe(runtimeIds.length);
  });

  it("keeps every control bounded and every profile isolatable", () => {
    for (const profile of SOUND_PROFILES) {
      const config = profileExperienceConfig(profile.id)!;
      expect(config, profile.id).not.toBeNull();
      expect(config.availableRoles.length, profile.id).toBeGreaterThan(0);
      expect(config.transitionTauSeconds, profile.id).toBeGreaterThanOrEqual(0.04);
      expect(config.transitionTauSeconds, profile.id).toBeLessThanOrEqual(0.8);
      expect(config.variation.depth, profile.id).toBeGreaterThanOrEqual(0);
      expect(config.variation.depth, profile.id).toBeLessThanOrEqual(0.04);
      expect(config.variation.maxEventVoices, profile.id).toBeGreaterThanOrEqual(1);
      expect(config.variation.maxEventVoices, profile.id).toBeLessThanOrEqual(2);
      for (const value of Object.values(config.phases)) {
        expect(value, profile.id).toBeGreaterThanOrEqual(0);
        expect(value, profile.id).toBeLessThanOrEqual(1.35);
      }
    }
  });

  it("does not invent absent supercharged or V12 variants", () => {
    expect(Object.values(PROFILE_EXPERIENCE_CONFIG).some((config) => config.aspiration === "supercharged")).toBe(false);
    expect(SOUND_PROFILES.some((profile) => /v12/i.test(`${profile.id} ${profile.name}`))).toBe(false);
  });

  it("assigns developer isolation roles deterministically", () => {
    expect(inferLayerRole("v2-combustion")).toBe("combustion");
    expect(inferLayerRole("intake-stack")).toBe("intake");
    expect(inferLayerRole("turbo-spool")).toBe("boost");
    expect(inferLayerRole("regen-tone")).toBe("regen");
    expect(inferLayerRole("shift-click")).toBe("event");
  });

  it("preserves cruise-to-load contrast and gives regen a distinct layer state", () => {
    const config = profileExperienceConfig("electric-hypercar")!;
    const base = {
      speedKmh: 80,
      speedSlow: 0.5,
      throttleFast: 0.22,
      accelMps2: 0,
      accelFast: 0,
      regen: 0,
      overrun: false,
    } as MotionFrame;
    const cruiseMotor = phaseRoleGain("motor", base, config);
    const cruiseMechanical = phaseRoleGain("mechanical", base, config);
    const loadedMotor = phaseRoleGain(
      "motor",
      { ...base, throttleFast: 0.85, accelMps2: 2.4, accelFast: 0.6 },
      config,
    );
    const regenMotor = phaseRoleGain("motor", { ...base, throttleFast: 0, regen: 0.75 }, config);
    const regenLayer = phaseRoleGain("regen", { ...base, throttleFast: 0, regen: 0.75 }, config);
    expect(cruiseMechanical).toBeLessThan(cruiseMotor);
    expect(loadedMotor).toBeGreaterThan(cruiseMotor);
    expect(regenMotor).toBeLessThan(cruiseMotor);
    expect(regenLayer).toBeGreaterThan(regenMotor);
  });
});
