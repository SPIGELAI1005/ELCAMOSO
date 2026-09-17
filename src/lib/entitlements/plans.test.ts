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
  it("FREE includes basic drive, sound profiles, and phone sensor pairing", () => {
    expect(FREE_ENTITLEMENTS).toEqual(["basic_drive", "basic_sound_profiles", "phone_sensor"]);
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
});
