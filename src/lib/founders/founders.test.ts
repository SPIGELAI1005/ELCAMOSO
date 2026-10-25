import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_FOUNDER_SEAT_LIMIT,
  FOUNDER_DRIVE_PLUS_UNTIL_MS,
  FOUNDERS_SIGNUP_DEADLINE_MS,
  canMintFounder,
  founderSeatLimit,
  founderStatusFrom,
  isFounderDrivePlusActive,
  isFounderEligible,
  isFounderSignupOpen,
  seatsLeft,
  splitCountdown,
} from "@/lib/founders/founders";
import { claimFounderSeat, resetFoundersStoreForTests, setTestCrewOptIn } from "@/lib/founders/founders.server";

const DEADLINE = Date.parse("2026-11-09T22:59:59Z");
const UNTIL = Date.parse("2027-05-09T21:59:59Z");

describe("founders eligibility", () => {
  afterEach(() => {
    delete process.env["FOUNDER_SEAT_LIMIT"];
    resetFoundersStoreForTests();
  });

  it("deadline is 09.11.2026 23:59:59 Berlin and perk ends 09.05.2027 23:59:59 Berlin", () => {
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

  it("Drive+ perk active until 09.05.2027 inclusive, then expires", () => {
    const at = DEADLINE - 1000;
    expect(isFounderDrivePlusActive(at, UNTIL)).toBe(true);
    expect(isFounderDrivePlusActive(at, UNTIL + 1)).toBe(false);
    expect(isFounderDrivePlusActive(null, at)).toBe(false);
    expect(founderStatusFrom(DEADLINE + 1)).toBeNull();
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

describe("founder Drive+ via entitlement service", () => {
  it("signed-in user before the deadline becomes Founder with Drive+ entitlements", async () => {
    const { createSessionFromVerifiedEmail } = await import("@/lib/account/auth-service");
    const { resolveEntitlementSnapshot } = await import("@/lib/entitlements/service");
    const now = DEADLINE - 3_600_000;
    const s = createSessionFromVerifiedEmail("founder-test@example.com", now);
    const snap = await resolveEntitlementSnapshot({ sessionToken: s.sessionToken, now });
    expect(snap.founder?.drivePlusActive).toBe(true);
    expect(snap.entitlements).toContain("all_sound_profiles");
    const later = await resolveEntitlementSnapshot({ sessionToken: s.sessionToken, now: UNTIL + 1 });
    expect(later.founder?.drivePlusActive ?? false).toBe(false);
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
