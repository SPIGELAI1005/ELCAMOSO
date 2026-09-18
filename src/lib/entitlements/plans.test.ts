import { describe, expect, it } from "vitest";

import {
  ALL_ENTITLEMENTS,
  FREE_ENTITLEMENTS,
  PLAN_ENTITLEMENTS,
  PREMIUM_ENTITLEMENTS,
  TRIAL_DRIVE_PLUS_ENTITLEMENTS,
  entitlementsForPlan,
} from "@/lib/entitlements/plans";

describe("plan entitlements", () => {
  it("FREE preserves legacy grants and completes the creative viral loop", () => {
    expect(FREE_ENTITLEMENTS).toEqual(
      expect.arrayContaining([
        "basic_drive",
        "basic_sound_profiles",
        "phone_sensor",
        "symphony_essential",
        "worlds_sampler",
        "drive_dna",
        "drive_song_basic",
        "journey_history_local",
        "basic_share",
      ]),
    );
    expect(entitlementsForPlan("FREE")).toEqual(FREE_ENTITLEMENTS);
  });

  it("DRIVE_PLUS includes all entitlements", () => {
    expect(PLAN_ENTITLEMENTS.DRIVE_PLUS).toEqual(ALL_ENTITLEMENTS);
    expect(entitlementsForPlan("DRIVE_PLUS")).toHaveLength(ALL_ENTITLEMENTS.length);
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

  it("Drive+ includes every full creative capability", () => {
    expect(entitlementsForPlan("DRIVE_PLUS")).toEqual(
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
