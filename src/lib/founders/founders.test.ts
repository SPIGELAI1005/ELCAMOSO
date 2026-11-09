import { afterEach, describe, expect, it } from "vitest";

import { addMonthsUtc } from "@/lib/billing/black-friday";
import { resetEntitlementGrantsForTests } from "@/lib/entitlements/grants";
import {
  DEFAULT_FOUNDER_SEAT_LIMIT,
  FOUNDER_DRIVE_PLUS_UNTIL_MS,
  FOUNDER_PACK_UNLIMITED_MONTHS,
  FOUNDER_PAID_UNLIMITED_CUTOVER_MS,
  FOUNDERS_SIGNUP_DEADLINE_MS,
  canMintFounder,
  canMintFounderFromPurchase,
  founderDriveUnlimitedUntilMs,
  founderSeatLimit,
  founderStatusFrom,
  foundersPackUnlimitedUntilMs,
  isFounderDrivePlusActive,
  isFounderEligible,
  isFounderSignupOpen,
  isFoundersPackPurchaseOpen,
  isFoundersPackQualifyingPlan,
  isFoundersPackQualifyingPurchaseTime,
  isLegacyFounderClaim,
  seatsLeft,
  splitCountdown,
} from "@/lib/founders/founders";
import {
  applyFoundersPackFromYearlySubscription,
  claimFounderSeat,
  claimFounderSeatFromPurchase,
  grantFoundersPackUnlimited,
  resetFoundersStoreForTests,
  setTestCrewOptIn,
} from "@/lib/founders/founders.server";
import { resetFounderSoundPicksForTests } from "@/lib/founders/sound-picks.server";

const DEADLINE = Date.parse("2026-11-27T22:59:59Z");
const UNTIL = Date.parse("2027-05-27T21:59:59Z");
const LEGACY = FOUNDER_PAID_UNLIMITED_CUTOVER_MS - 60_000;

describe("founders eligibility", () => {
  afterEach(() => {
    delete process.env["FOUNDER_SEAT_LIMIT"];
    resetFoundersStoreForTests();
    resetEntitlementGrantsForTests();
    resetFounderSoundPicksForTests();
  });

  it("deadline is 27.11.2026 (Black Friday) 23:59:59 Berlin and legacy perk ends 27.05.2027 23:59:59 Berlin", () => {
    expect(FOUNDERS_SIGNUP_DEADLINE_MS).toBe(DEADLINE);
    expect(FOUNDER_DRIVE_PLUS_UNTIL_MS).toBe(UNTIL);
  });

  it("free signup closes after 09.11 23:59 Berlin; purchase stays open through Black Friday", () => {
    expect(isFounderSignupOpen(FOUNDER_PAID_UNLIMITED_CUTOVER_MS)).toBe(true);
    expect(isFounderSignupOpen(FOUNDER_PAID_UNLIMITED_CUTOVER_MS + 1)).toBe(false);
    expect(isFoundersPackPurchaseOpen(DEADLINE)).toBe(true);
    expect(isFoundersPackPurchaseOpen(DEADLINE + 1)).toBe(false);
  });

  it("requires created AND confirmed before the 09.11 cutover for a free seat", () => {
    const before = FOUNDER_PAID_UNLIMITED_CUTOVER_MS - 10;
    expect(isFounderEligible({ createdAt: before, confirmedAt: before })).toBe(true);
    expect(
      isFounderEligible({
        createdAt: before,
        confirmedAt: FOUNDER_PAID_UNLIMITED_CUTOVER_MS,
      }),
    ).toBe(true);
    expect(
      isFounderEligible({
        createdAt: FOUNDER_PAID_UNLIMITED_CUTOVER_MS + 1,
        confirmedAt: FOUNDER_PAID_UNLIMITED_CUTOVER_MS + 2,
      }),
    ).toBe(false);
    expect(isFounderEligible({ createdAt: before, confirmedAt: null })).toBe(false);
  });

  it("legacy Founders (claimed before the cutover) keep Drive Unlimited until 27.05.2027", () => {
    expect(isLegacyFounderClaim(LEGACY)).toBe(true);
    expect(isFounderDrivePlusActive(LEGACY, UNTIL)).toBe(true);
    expect(isFounderDrivePlusActive(LEGACY, UNTIL + 1)).toBe(false);
    expect(isFounderDrivePlusActive(null, LEGACY)).toBe(false);
    expect(founderStatusFrom(DEADLINE + 1)).toBeNull();
    expect(founderDriveUnlimitedUntilMs({ founderAt: LEGACY })).toBe(UNTIL);
  });

  it("new free claims after the cutover do not get Drive Unlimited", () => {
    const claimed = FOUNDER_PAID_UNLIMITED_CUTOVER_MS + 1_000;
    expect(isLegacyFounderClaim(claimed)).toBe(false);
    expect(isFounderDrivePlusActive(claimed, claimed + 1)).toBe(false);
    expect(founderDriveUnlimitedUntilMs({ founderAt: claimed })).toBeNull();
    expect(founderStatusFrom(claimed)?.drivePlusUntil).toBe(0);
  });

  it("paid Founders Pack purchase grants Drive Unlimited for 4 months from the purchase date", () => {
    const claimed = FOUNDER_PAID_UNLIMITED_CUTOVER_MS + 1_000;
    const purchasedAt = Date.parse("2026-11-20T10:00:00+01:00");
    const until = foundersPackUnlimitedUntilMs(purchasedAt);
    expect(until).toBe(addMonthsUtc(purchasedAt, FOUNDER_PACK_UNLIMITED_MONTHS));
    expect(founderDriveUnlimitedUntilMs({ founderAt: claimed, purchasedAt })).toBe(until);
    expect(isFounderDrivePlusActive(claimed, purchasedAt + 1, purchasedAt)).toBe(true);
    expect(isFounderDrivePlusActive(claimed, until, purchasedAt)).toBe(true);
    expect(isFounderDrivePlusActive(claimed, until + 1, purchasedAt)).toBe(false);
  });

  it("seat cap defaults to 458 and is configurable", () => {
    expect(DEFAULT_FOUNDER_SEAT_LIMIT).toBe(458);
    expect(founderSeatLimit()).toBe(458);
    process.env["FOUNDER_SEAT_LIMIT"] = "3";
    expect(founderSeatLimit()).toBe(3);
    expect(canMintFounder(2, FOUNDER_PAID_UNLIMITED_CUTOVER_MS, 3)).toBe(true);
    expect(canMintFounder(3, FOUNDER_PAID_UNLIMITED_CUTOVER_MS, 3)).toBe(false);
    expect(canMintFounder(0, FOUNDER_PAID_UNLIMITED_CUTOVER_MS + 1, 3)).toBe(false);
    expect(canMintFounderFromPurchase(2, DEADLINE, 3)).toBe(true);
    expect(canMintFounderFromPurchase(3, DEADLINE, 3)).toBe(false);
    expect(canMintFounderFromPurchase(0, DEADLINE + 1, 3)).toBe(false);
    expect(seatsLeft(460, 458)).toBe(0);
  });

  it("countdown split", () => {
    expect(splitCountdown(90061_000)).toEqual({ d: 1, h: 1, m: 1, s: 1 });
  });

  it("memory store assigns seats up to the cap, idempotently", async () => {
    process.env["FOUNDER_SEAT_LIMIT"] = "2";
    const t = FOUNDER_PAID_UNLIMITED_CUTOVER_MS - 60_000;
    const a = await claimFounderSeat("a", null, t);
    const a2 = await claimFounderSeat("a", null, t);
    const b = await claimFounderSeat("b", null, t);
    const c = await claimFounderSeat("c", null, t);
    expect(a.seat).toBe(1);
    expect(a2.seat).toBe(1);
    expect(b.seat).toBe(2);
    expect(c.founderAt).toBeNull();
    expect(
      (await claimFounderSeat("d", null, FOUNDER_PAID_UNLIMITED_CUTOVER_MS + 1)).founderAt,
    ).toBeNull();
    expect((await setTestCrewOptIn("a", true)).testCrewOptIn).toBe(true);
    await expect(setTestCrewOptIn("c", true)).rejects.toThrow();
  });

  it("paid purchase can still mint a seat after free signup closed, until Black Friday", async () => {
    const duringBf = Date.parse("2026-11-20T12:00:00+01:00");
    expect(isFounderSignupOpen(duringBf)).toBe(false);
    expect((await claimFounderSeat("bf-free", null, duringBf)).founderAt).toBeNull();
    const paid = await claimFounderSeatFromPurchase("bf-paid", null, duringBf);
    expect(paid.founderAt).toBe(duringBf);
    expect(paid.seat).toBe(1);
    expect(
      (await claimFounderSeatFromPurchase("bf-late", null, DEADLINE + 1)).founderAt,
    ).toBeNull();
  });
});

describe("founder Drive Unlimited via entitlement service", () => {
  afterEach(() => {
    resetFoundersStoreForTests();
    resetEntitlementGrantsForTests();
    resetFounderSoundPicksForTests();
  });

  it("legacy claim before the cutover still gets Drive Unlimited until 27.05.2027", async () => {
    const { createSessionFromVerifiedEmail } = await import("@/lib/account/auth-service");
    const { resolveEntitlementSnapshot } = await import("@/lib/entitlements/service");
    const now = LEGACY;
    const s = createSessionFromVerifiedEmail("founder-legacy@example.com", now);
    const snap = await resolveEntitlementSnapshot({ sessionToken: s.sessionToken, now });
    expect(snap.founder?.drivePlusActive).toBe(true);
    expect(snap.founder?.drivePlusUntil).toBe(UNTIL);
    expect(snap.entitlements).toContain("all_sound_profiles");
    const later = await resolveEntitlementSnapshot({
      sessionToken: s.sessionToken,
      now: UNTIL + 1,
    });
    expect(later.founder?.drivePlusActive ?? false).toBe(false);
  });

  it("sign-in after the 09.11 cutover does not grant a free Founder seat", async () => {
    const { createSessionFromVerifiedEmail } = await import("@/lib/account/auth-service");
    const { resolveEntitlementSnapshot } = await import("@/lib/entitlements/service");
    const now = FOUNDER_PAID_UNLIMITED_CUTOVER_MS + 60_000;
    const s = createSessionFromVerifiedEmail("founder-new@example.com", now);
    const snap = await resolveEntitlementSnapshot({ sessionToken: s.sessionToken, now });
    expect(snap.founder ?? null).toBeNull();
    expect(snap.entitlements).not.toContain("all_sound_profiles");
  });

  it("Founders Pack purchase during Black Friday mints a seat and grants Drive Unlimited", async () => {
    const { createSessionFromVerifiedEmail } = await import("@/lib/account/auth-service");
    const { resolveEntitlementSnapshot } = await import("@/lib/entitlements/service");
    const now = FOUNDER_PAID_UNLIMITED_CUTOVER_MS + 60_000;
    const s = createSessionFromVerifiedEmail("founder-paid@example.com", now);
    await resolveEntitlementSnapshot({ sessionToken: s.sessionToken, now });
    await claimFounderSeatFromPurchase(s.userId, s.email, now);
    const until = grantFoundersPackUnlimited(s.userId, now);
    expect(until).toBe(addMonthsUtc(now, 4));
    const snap = await resolveEntitlementSnapshot({ sessionToken: s.sessionToken, now });
    expect(snap.founder?.drivePlusActive).toBe(true);
    expect(snap.founder?.drivePlusUntil).toBe(until);
    expect(snap.entitlements).toContain("all_sound_profiles");
    expect(snap.entitlements).toContain("symphony_all");
    const after = await resolveEntitlementSnapshot({
      sessionToken: s.sessionToken,
      now: until + 1,
    });
    expect(after.founder?.drivePlusActive ?? false).toBe(false);
  });

  it("yearly Drive+ purchase during Black Friday mints a Founder and 4-month Unlimited", async () => {
    const purchasedAt = Date.parse("2026-11-20T12:00:00+01:00");
    const result = await applyFoundersPackFromYearlySubscription({
      userId: "yearly-founder",
      plan: "DRIVE_PLUS",
      interval: "year",
      status: "active",
      createdAt: new Date(purchasedAt),
    });
    expect(result.applied).toBe(true);
    expect(result.until).toBe(addMonthsUtc(purchasedAt, 4));
    const monthly = await applyFoundersPackFromYearlySubscription({
      userId: "monthly-not-founder",
      plan: "DRIVE_PLUS",
      interval: "month",
      status: "active",
      createdAt: new Date(purchasedAt),
    });
    expect(monthly.applied).toBe(false);
    expect(isFoundersPackQualifyingPlan("DRIVE_PLUS", "year")).toBe(true);
    expect(isFoundersPackQualifyingPlan("DRIVE_MUSIC", "year")).toBe(true);
    expect(isFoundersPackQualifyingPlan("DRIVE_COMPLETE", "year")).toBe(false);
    expect(isFoundersPackQualifyingPurchaseTime(purchasedAt)).toBe(true);
  });

  it("does not treat a yearly Drive+ created before 9 Nov as a Founders Pack", async () => {
    const result = await applyFoundersPackFromYearlySubscription({
      userId: "old-yearly",
      plan: "DRIVE_PLUS",
      interval: "year",
      status: "active",
      createdAt: new Date(Date.parse("2026-10-01T12:00:00+02:00")),
    });
    expect(result.applied).toBe(false);
  });

  it("after 4 months falls back off Unlimited while forever sound grants remain", async () => {
    const { createSessionFromVerifiedEmail } = await import("@/lib/account/auth-service");
    const { resolveEntitlementSnapshot } = await import("@/lib/entitlements/service");
    const { activeGrantedProfileIds } = await import("@/lib/entitlements/grants");
    const { confirmFounderSoundPicks, saveFounderSoundPicks } =
      await import("@/lib/founders/sound-picks.server");
    const now = Date.parse("2026-11-20T12:00:00+01:00");
    const s = createSessionFromVerifiedEmail("founder-fallback@example.com", now);
    await applyFoundersPackFromYearlySubscription({
      userId: s.userId,
      plan: "DRIVE_MUSIC",
      interval: "year",
      status: "active",
      createdAt: new Date(now),
    });
    const picks = ["gt-v8", "police-patrol", "fusion-road-anthem", "wild-west-carriage"];
    await saveFounderSoundPicks(s.userId, picks, now);
    await confirmFounderSoundPicks(s.userId, now);
    const until = addMonthsUtc(now, 4);
    const during = await resolveEntitlementSnapshot({ sessionToken: s.sessionToken, now });
    expect(during.founder?.drivePlusActive).toBe(true);
    expect(during.entitlements).toContain("all_sound_profiles");
    const after = await resolveEntitlementSnapshot({
      sessionToken: s.sessionToken,
      now: until + 1,
    });
    expect(after.founder?.drivePlusActive ?? false).toBe(false);
    expect(after.entitlements).not.toContain("all_sound_profiles");
    expect(activeGrantedProfileIds(s.userId, until + 1).sort()).toEqual([...picks].sort());
  });

  it("first sign-in after the deadline is not a Founder", async () => {
    const { createSessionFromVerifiedEmail } = await import("@/lib/account/auth-service");
    const { resolveEntitlementSnapshot } = await import("@/lib/entitlements/service");
    const now = DEADLINE + 1000;
    const s = createSessionFromVerifiedEmail("late@example.com", now);
    const snap = await resolveEntitlementSnapshot({ sessionToken: s.sessionToken, now });
    expect(snap.founder ?? null).toBeNull();
    expect(snap.entitlements).not.toContain("all_sound_profiles");
  });
});
