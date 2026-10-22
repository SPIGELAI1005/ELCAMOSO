import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  resolveEffectiveEntitlements,
  resolveProfileDriveAccess,
} from "@/lib/entitlements/access-resolver";
import { canDriveProfileWithAccess } from "@/lib/entitlements/drive-profile-access";
import { DEFAULT_ENTITLEMENT_USER } from "@/lib/entitlements/defaults";
import {
  FREE_SOUND_PROFILE_IDS,
  isSoundTierGateActive,
  SOUND_TIER_GATE_STARTS_AT_UTC_MS,
} from "@/lib/sound/profile-access-config";
import { canDriveWithSoundProfile } from "@/lib/sound/profile-access";
import { getProfile, SOUND_PROFILES } from "@/lib/sound/profiles";

const BEFORE = Date.parse("2026-10-21T21:59:59Z"); // 21 Oct 23:59:59 Berlin
const AFTER = Date.parse("2026-10-21T22:00:00Z"); // 22 Oct 00:00 Berlin (locked from now)
const signedOut = { ...DEFAULT_ENTITLEMENT_USER };
const lockedIds = SOUND_PROFILES.map((p) => p.id).filter(
  (id) => !FREE_SOUND_PROFILE_IDS.includes(id),
);

describe("Drive+ sound tier gate (22 Oct 2026 Europe/Berlin)", () => {
  beforeEach(() => vi.stubEnv("VITE_SOUND_GATE_SIMULATE_NOW", ""));
  afterEach(() => vi.unstubAllEnvs());

  it("starts at 22 Oct 2026 00:00 Europe/Berlin", () => {
    expect(new Date(SOUND_TIER_GATE_STARTS_AT_UTC_MS).toISOString()).toBe(
      "2026-10-21T22:00:00.000Z",
    );
    expect(isSoundTierGateActive(BEFORE)).toBe(false);
    expect(isSoundTierGateActive(AFTER)).toBe(true);
  });

  it("free tier is exactly Racing V10, American Muscle V8, GT V8", () => {
    expect([...FREE_SOUND_PROFILE_IDS].sort()).toEqual([
      "american-muscle-v8",
      "gt-v8",
      "racing-v10",
    ]);
    expect(lockedIds.length).toBeGreaterThan(0);
    expect(lockedIds).toContain("rocket-car");
  });

  it("before the gate every profile is drivable for signed-out users", () => {
    for (const id of SOUND_PROFILES.map((p) => p.id)) {
      expect(resolveProfileDriveAccess(id, { user: signedOut, now: BEFORE }).allowed).toBe(true);
      expect(canDriveWithSoundProfile(getProfile(id), false, undefined, [], BEFORE)).toBe(true);
    }
    expect(
      resolveEffectiveEntitlements({ user: signedOut, now: BEFORE }).has("all_sound_profiles"),
    ).toBe(true);
  });

  it("after the gate signed-out / free users get only the free trio", () => {
    for (const id of FREE_SOUND_PROFILE_IDS) {
      expect(resolveProfileDriveAccess(id, { user: signedOut, now: AFTER }).allowed).toBe(true);
    }
    for (const id of lockedIds) {
      const d = resolveProfileDriveAccess(id, { user: signedOut, now: AFTER });
      expect(d.allowed, id).toBe(false);
      expect(FREE_SOUND_PROFILE_IDS).toContain(d.fallbackProfileId);
      expect(canDriveWithSoundProfile(getProfile(id), false, undefined, [], AFTER)).toBe(false);
    }
    expect(
      resolveEffectiveEntitlements({ user: signedOut, now: AFTER }).has("all_sound_profiles"),
    ).toBe(false);
  });

  it("per-user admin grants override the gate", () => {
    const id = lockedIds[0]!;
    expect(
      resolveProfileDriveAccess(id, { user: signedOut, grantedProfileIds: [id], now: AFTER })
        .allowed,
    ).toBe(true);
    expect(canDriveWithSoundProfile(getProfile(id), false, undefined, [id], AFTER)).toBe(true);
    expect(
      resolveProfileDriveAccess(lockedIds[1]!, {
        user: signedOut,
        grantedProfileIds: [id],
        now: AFTER,
      }).allowed,
    ).toBe(false);
  });

  it("Drive+ subscribers keep every sound after the gate", () => {
    const user = {
      ...signedOut,
      accountId: "a1",
      plan: "DRIVE_PLUS" as const,
      subscriptionStatus: "active" as const,
    };
    for (const id of lockedIds)
      expect(resolveProfileDriveAccess(id, { user, now: AFTER }).allowed).toBe(true);
    expect(
      canDriveProfileWithAccess({
        profileId: lockedIds[0]!,
        hasAllSoundProfiles: true,
        grantedProfileIds: [],
        hasEntitlement: () => true,
      }),
    ).toBe(true);
  });

  it("simulation override flips the gate clock (non-production only)", () => {
    vi.stubEnv("VITE_SOUND_GATE_SIMULATE_NOW", "2026-11-10T12:00:00Z");
    expect(resolveProfileDriveAccess(lockedIds[0]!, { user: signedOut, now: BEFORE }).allowed).toBe(
      false,
    );
  });
});

describe("locked sound copy + fallback", () => {
  it("uses the George copy and racing-v10 fallback", async () => {
    const m = await import("@/lib/sound/profile-access-config");
    expect(m.DRIVE_PLUS_LOCKED_MESSAGE).toBe("Drive+ sound. Available from 09.11.");
    expect(m.FALLBACK_SOUND_PROFILE_ID).toBe("racing-v10");
    expect(m.isSoundTierGateActive(Date.parse("2026-10-22T16:00:00Z"))).toBe(true);
  });
});
