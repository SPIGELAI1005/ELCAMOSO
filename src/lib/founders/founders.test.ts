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
  founderDriveUnlimitedUntilMs,
  founderSeatLimit,
  founderStatusFrom,
  foundersPackUnlimitedUntilMs,
  isFounderDrivePlusActive,
  isFounderEligible,
  isFounderSignupOpen,
  isLegacyFounderClaim,
  seatsLeft,
  splitCountdown,
} from "@/lib/founders/founders";
import {
  claimFounderSeat,
  grantFoundersPackUnlimited,
  resetFoundersStoreForTests,
  setTestCrewOptIn,
} from "@/lib/founders/founders.server";

const DEADLINE = Date.parse("2026-11-27T22:59:59Z");
const UNTIL = Date.parse("2027-05-27T21:59:59Z");
const LEGACY = FOUNDER_PAID_UNLIMITED_CUTOVER_MS - 60_000;

describe("founders eligibility", () => {
  afterEach(() => {
    delete process.env["FOUNDER_SEAT_LIMIT"];
    resetFoundersStoreForTests();
    resetEntitlementGrantsForTests();
  });

  it("deadline is 27.11.2026 (Black Friday) 23:59:59 Berlin and legacy perk ends 27.05.2027 23:59:59 Berlin", () => {
    expect(FOUNDERS_SIGNUP_DEADLINE_MS).toBe(DEADLINE);
    expect(FOUNDER_DRIVE_PLUS_UNTIL_MS).toBe(UNTIL);
  });

  it("signup window closes after the deadline", () => {
    expect(isFounderSignupOpen(DEADLINE)).toBe(true);
    expect(isFounderSignupOpen(DEADLINE + 1)).toBe(false);
  });

  it("requires created AND confirmed before the deadline", () => {
    expect(isFounderEligible({ createdAt: DEADLINE - 10, confirmedAt: DEADLINE })).toBe(true);
    expect(isFounderEligible({ createdAt: DEADLINE - 10, confirmedAt: DEADLINE + 1 })).toBe(false);
    expect(isFounderEligible({ createdAt: DEADLINE + 1, confirmedAt: DEADLINE + 2 })).toBe(false);
    expect(isFounderEligible({ createdAt: DEADLINE - 10, confirmedAt: null })).toBe(false);
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
    expect(canMintFounder(2, DEADLINE - 1, 3)).toBe(true);
    expect(canMintFounder(3, DEADLINE - 1, 3)).toBe(false);
    expect(canMintFounder(0, DEADLINE + 1, 3)).toBe(false);
    expect(seatsLeft(460, 458)).toBe(0);
  });

  it("countdown split", () => {
    expect(splitCountdown(90061_000)).toEqual({ d: 1, h: 1, m: 1, s: 1 });
  });

  it("memory store assigns seats up to the cap, idempotently", async () => {
    process.env["FOUNDER_SEAT_LIMIT"] = "2";
    const t = DEADLINE - 60_000;
    const a = await claimFounderSeat("a", null, t);
    const a2 = await claimFounderSeat("a", null, t);
    const b = await claimFounderSeat("b", null, t);
    const c = await claimFounderSeat("c", null, t);
    expect(a.seat).toBe(1);
    expect(a2.seat).toBe(1);
    expect(b.seat).toBe(2);
    expect(c.founderAt).toBeNull();
    expect((await claimFounderSeat("d", null, DEADLINE + 1)).founderAt).toBeNull();
    expect((await setTestCrewOptIn("a", true)).testCrewOptIn).toBe(true);
    await expect(setTestCrewOptIn("c", true)).rejects.toThrow();
  });
});

describe("founder Drive Unlimited via entitlement service", () => {
  afterEach(() => {
    resetFoundersStoreForTests();
    resetEntitlementGrantsForTests();
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
    const later = await resolveEntitlementSnapshot({ sessionToken: s.sessionToken, now: UNTIL + 1 });
    expect(later.founder?.drivePlusActive ?? false).toBe(false);
  });

  it("new free claim after the cutover is a Founder but does not get Drive Unlimited", async () => {
    const { createSessionFromVerifiedEmail } = await import("@/lib/account/auth-service");
    const { resolveEntitlementSnapshot } = await import("@/lib/entitlements/service");
    const now = FOUNDER_PAID_UNLIMITED_CUTOVER_MS + 60_000;
    const s = createSessionFromVerifiedEmail("founder-new@example.com", now);
    const snap = await resolveEntitlementSnapshot({ sessionToken: s.sessionToken, now });
    expect(snap.founder).not.toBeNull();
    expect(snap.founder?.drivePlusActive).toBe(false);
    expect(snap.entitlements).not.toContain("all_sound_profiles");
  });

  it("Founders Pack purchase grants Drive Unlimited for 4 months from purchase", async () => {
    const { createSessionFromVerifiedEmail } = await import("@/lib/account/auth-service");
    const { resolveEntitlementSnapshot } = await import("@/lib/entitlements/service");
    const now = FOUNDER_PAID_UNLIMITED_CUTOVER_MS + 60_000;
    const s = createSessionFromVerifiedEmail("founder-paid@example.com", now);
    await resolveEntitlementSnapshot({ sessionToken: s.sessionToken, now });
    const until = grantFoundersPackUnlimited(s.userId, now);
    expect(until).toBe(addMonthsUtc(now, 4));
    const snap = await resolveEntitlementSnapshot({ sessionToken: s.sessionToken, now });
    expect(snap.founder?.drivePlusActive).toBe(true);
    expect(snap.founder?.drivePlusUntil).toBe(until);
    expect(snap.entitlements).toContain("all_sound_profiles");
    expect(snap.entitlements).toContain("symphony_all");
    const after = await resolveEntitlementSnapshot({ sessionToken: s.sessionToken, now: until + 1 });
    expect(after.founder?.drivePlusActive ?? false).toBe(false);
  });

  it("webhook grants 4 months from the paid Founders Pack checkout", async () => {
    process.env.STRIPE_PRICE_FOUNDERS_PACK = "price_founders_test";
    const purchasedAt = FOUNDER_PAID_UNLIMITED_CUTOVER_MS + 120_000;
    const { handleFoundersPackCheckoutCompleted } = await import(
      "@/lib/billing/stripe/founders-pack-sync"
    );
    const result = await handleFoundersPackCheckoutCompleted({
      id: "cs_founders_1",
      object: "checkout.session",
      mode: "payment",
      payment_status: "paid",
      payment_intent: "pi_founders_1",
      customer: "cus_founders",
      client_reference_id: "founder-paid-webhook",
      created: Math.floor(purchasedAt / 1000),
      metadata: {
        commercialPlanId: "founders_pack",
        userId: "founder-paid-webhook",
      },
    } as never);
    expect(result.skipped).toBe(false);
    if (result.skipped) return;
    expect(result.until).toBe(addMonthsUtc(purchasedAt, 4));
    delete process.env.STRIPE_PRICE_FOUNDERS_PACK;
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
