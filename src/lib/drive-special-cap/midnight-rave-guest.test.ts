import { beforeEach, describe, expect, it } from "vitest";

import {
  DRIVE_SPECIAL_DAILY_SECONDS,
  DRIVE_SPECIAL_END_MS,
  MIDNIGHT_DARK_RAVE_GUEST_DAILY_SECONDS,
  MIDNIGHT_DARK_RAVE_MENU_ID,
  MIDNIGHT_DARK_RAVE_PROFILE_ID,
  isMidnightDarkRaveProfile,
  landingStartDriveProfileId,
} from "@/lib/billing/drive-special";
import { FALLBACK_SOUND_PROFILE_ID } from "@/lib/sound/profile-access-config";
import {
  driveSpecialCapAllows,
  driveSpecialCapGoverns,
  resetDriveSpecialCapForTests,
  tickDriveSpecialCap,
} from "@/lib/drive-special-cap/client-store";
import {
  midnightRaveGuestAllows,
  midnightRaveGuestGoverns,
  midnightRaveGuestRemainingSeconds,
  resetMidnightRaveGuestForTests,
  tickMidnightRaveGuest,
} from "@/lib/drive-special-cap/midnight-rave-guest";
import { guestTrialGoverns } from "@/lib/guest-trial/client-store";

const IN = Date.parse("2026-11-15T12:00:00+01:00");
const AFTER = DRIVE_SPECIAL_END_MS;
const freeUser = { accountId: "acc-special", plan: "FREE" as const };

describe("Midnight Dark Rave catalog id", () => {
  it("is fusion-midnight-boost (menu genre:darkrave)", () => {
    expect(MIDNIGHT_DARK_RAVE_PROFILE_ID).toBe("fusion-midnight-boost");
    expect(MIDNIGHT_DARK_RAVE_MENU_ID).toBe("genre:darkrave");
    expect(isMidnightDarkRaveProfile("fusion-midnight-boost")).toBe(true);
    expect(isMidnightDarkRaveProfile("genre:darkrave")).toBe(true);
    expect(isMidnightDarkRaveProfile("fusion-road-anthem")).toBe(false);
    expect(isMidnightDarkRaveProfile("racing-v10")).toBe(false);
  });
});

describe("signed-out 15 min / day (Berlin, localStorage)", () => {
  beforeEach(() => resetMidnightRaveGuestForTests());

  it("allows Midnight Dark Rave until 15 minutes are used, then blocks", () => {
    expect(midnightRaveGuestGoverns(MIDNIGHT_DARK_RAVE_PROFILE_ID, false, IN)).toBe(true);
    expect(midnightRaveGuestAllows(MIDNIGHT_DARK_RAVE_PROFILE_ID, false, IN)).toBe(true);
    expect(midnightRaveGuestAllows(MIDNIGHT_DARK_RAVE_MENU_ID, false, IN)).toBe(true);
    expect(MIDNIGHT_DARK_RAVE_GUEST_DAILY_SECONDS).toBe(900);
    tickMidnightRaveGuest(MIDNIGHT_DARK_RAVE_GUEST_DAILY_SECONDS - 1, IN);
    expect(midnightRaveGuestRemainingSeconds(IN)).toBe(1);
    expect(midnightRaveGuestAllows(MIDNIGHT_DARK_RAVE_PROFILE_ID, false, IN)).toBe(true);
    tickMidnightRaveGuest(1, IN);
    expect(midnightRaveGuestRemainingSeconds(IN)).toBe(0);
    expect(midnightRaveGuestAllows(MIDNIGHT_DARK_RAVE_PROFILE_ID, false, IN)).toBe(false);
  });

  it("does not apply when signed in, to other sounds, or after the window", () => {
    expect(midnightRaveGuestGoverns(MIDNIGHT_DARK_RAVE_PROFILE_ID, true, IN)).toBe(false);
    expect(midnightRaveGuestAllows(MIDNIGHT_DARK_RAVE_PROFILE_ID, true, IN)).toBe(false);
    expect(midnightRaveGuestGoverns("fusion-road-anthem", false, IN)).toBe(false);
    expect(midnightRaveGuestGoverns(MIDNIGHT_DARK_RAVE_PROFILE_ID, false, AFTER)).toBe(false);
    expect(midnightRaveGuestAllows(MIDNIGHT_DARK_RAVE_PROFILE_ID, false, AFTER)).toBe(false);
  });

  it("resets at Berlin midnight and does not share the guest-trial 7 minutes", () => {
    tickMidnightRaveGuest(MIDNIGHT_DARK_RAVE_GUEST_DAILY_SECONDS, IN);
    expect(midnightRaveGuestAllows(MIDNIGHT_DARK_RAVE_PROFILE_ID, false, IN)).toBe(false);
    expect(
      midnightRaveGuestAllows(
        MIDNIGHT_DARK_RAVE_PROFILE_ID,
        false,
        Date.parse("2026-11-16T00:00:01+01:00"),
      ),
    ).toBe(true);
    expect(guestTrialGoverns(MIDNIGHT_DARK_RAVE_PROFILE_ID, false, IN, null)).toBe(false);
  });
});

describe("signed-in unlimited Midnight Dark Rave; other music still 30 min", () => {
  beforeEach(() => {
    resetDriveSpecialCapForTests();
    resetMidnightRaveGuestForTests();
  });

  it("does not put Midnight Dark Rave on the 30-minute Drive the Music cap", () => {
    expect(driveSpecialCapGoverns(MIDNIGHT_DARK_RAVE_PROFILE_ID, freeUser, IN)).toBe(false);
    expect(driveSpecialCapGoverns(MIDNIGHT_DARK_RAVE_MENU_ID, freeUser, IN)).toBe(false);
    tickDriveSpecialCap("acc-special", DRIVE_SPECIAL_DAILY_SECONDS, IN);
    expect(driveSpecialCapGoverns(MIDNIGHT_DARK_RAVE_PROFILE_ID, freeUser, IN)).toBe(false);
  });

  it("keeps other Drive the Music sounds at 30 minutes per Berlin day", () => {
    expect(driveSpecialCapGoverns("fusion-road-anthem", freeUser, IN)).toBe(true);
    expect(driveSpecialCapAllows("fusion-road-anthem", freeUser, IN)).toBe(true);
    tickDriveSpecialCap("acc-special", DRIVE_SPECIAL_DAILY_SECONDS - 1, IN);
    expect(driveSpecialCapAllows("fusion-road-anthem", freeUser, IN)).toBe(true);
    tickDriveSpecialCap("acc-special", 1, IN);
    expect(driveSpecialCapAllows("fusion-road-anthem", freeUser, IN)).toBe(false);
    expect(driveSpecialCapGoverns("symphony-neon-run", freeUser, IN)).toBe(true);
    expect(driveSpecialCapAllows("symphony-neon-run", freeUser, IN)).toBe(false);
  });

  it("does not spend the 30-minute cap when the signed-out 15-minute counter ticks", () => {
    tickMidnightRaveGuest(MIDNIGHT_DARK_RAVE_GUEST_DAILY_SECONDS, IN);
    expect(driveSpecialCapAllows("fusion-road-anthem", freeUser, IN)).toBe(true);
  });

  it("does not cap Founders who already have Drive Unlimited", () => {
    const founder = {
      accountId: "acc-founder",
      plan: "FREE" as const,
      founderDrivePlusActive: true,
    };
    expect(driveSpecialCapGoverns("fusion-road-anthem", founder, IN)).toBe(false);
    expect(driveSpecialCapGoverns(MIDNIGHT_DARK_RAVE_PROFILE_ID, founder, IN)).toBe(false);
  });
});

describe("window end fallback", () => {
  it("Start Drive opens Midnight Dark Rave in-window and Racing V10 after", () => {
    expect(landingStartDriveProfileId(IN)).toBe(MIDNIGHT_DARK_RAVE_PROFILE_ID);
    expect(landingStartDriveProfileId(AFTER - 1)).toBe(MIDNIGHT_DARK_RAVE_PROFILE_ID);
    expect(landingStartDriveProfileId(AFTER)).toBe(FALLBACK_SOUND_PROFILE_ID);
    expect(FALLBACK_SOUND_PROFILE_ID).toBe("racing-v10");
  });

  it("drops the signed-out 15-minute grant and the signed-in cap exclusion after the window", () => {
    expect(midnightRaveGuestGoverns(MIDNIGHT_DARK_RAVE_PROFILE_ID, false, AFTER)).toBe(false);
    expect(driveSpecialCapGoverns(MIDNIGHT_DARK_RAVE_PROFILE_ID, freeUser, AFTER)).toBe(false);
    expect(driveSpecialCapGoverns("fusion-road-anthem", freeUser, AFTER)).toBe(false);
  });
});
