import { describe, expect, it } from "vitest";

import {
  ALL_ENTITLEMENTS,
  FREE_ENTITLEMENTS,
  PLAN_ENTITLEMENTS,
  PREMIUM_ENTITLEMENTS,
  TRIAL_DRIVE_PLUS_ENTITLEMENTS,
  entitlementsForPlan,
  isMusicPackageProfileId,
} from "@/lib/entitlements/plans";

describe("plan entitlements", () => {
  it("FREE preserves legacy grants and completes the creative viral loop", () => {
    expect(FREE_ENTITLEMENTS).toEqual(
      expect.arrayContaining([
        "basic_drive",
        "basic_sound_profiles",
        "phone_sensor",
        "symphony_essential",
        "drive_dna",
        "journey_history_local",
      ]),
    );
    expect(entitlementsForPlan("FREE")).toEqual(FREE_ENTITLEMENTS);
  });

  it("DRIVE_COMPLETE (Lifetime / Founders) includes all entitlements", () => {
    expect(PLAN_ENTITLEMENTS.DRIVE_COMPLETE).toEqual(ALL_ENTITLEMENTS);
    expect(entitlementsForPlan("DRIVE_COMPLETE")).toHaveLength(ALL_ENTITLEMENTS.length);
  });

  it("splits Drive+ (engines) and Drive the Music (music) without overlap", () => {
    const plus = entitlementsForPlan("DRIVE_PLUS");
    const music = entitlementsForPlan("DRIVE_MUSIC");
    expect(plus).toContain("all_sound_profiles");
    expect(plus).not.toContain("symphony_all");
    expect(plus).not.toContain("fusion");
    expect(music).toEqual(expect.arrayContaining(["symphony_all", "fusion"]));
    expect(music).not.toContain("all_sound_profiles");
    expect(isMusicPackageProfileId("symphony-neon-run")).toBe(true);
    expect(isMusicPackageProfileId("fusion-road-anthem")).toBe(true);
    expect(isMusicPackageProfileId("gt-v8")).toBe(false);
  });

  it("premium list excludes FREE basics", () => {
    for (const e of FREE_ENTITLEMENTS) {
      expect(PREMIUM_ENTITLEMENTS).not.toContain(e);
    }
    expect(PREMIUM_ENTITLEMENTS.length + FREE_ENTITLEMENTS.length).toBe(ALL_ENTITLEMENTS.length);
  });

  it("trial grant matches premium entitlements", () => {
    expect(TRIAL_DRIVE_PLUS_ENTITLEMENTS).toEqual(PREMIUM_ENTITLEMENTS);
  });

  it("Complete includes every full creative capability", () => {
    expect(entitlementsForPlan("DRIVE_COMPLETE")).toEqual(
      expect.arrayContaining([
        "symphony_all",
        "worlds_all",
        "fusion",
        "drive_song_full",
        "drive_reel",
        "journey_history_full",
        "journey_remix",
        "studio_symphony",
        "studio_fusion",
        "premium_presets",
        "experience_drops",
      ]),
    );
  });
});
