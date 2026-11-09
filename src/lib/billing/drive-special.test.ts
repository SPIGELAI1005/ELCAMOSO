import { describe, expect, it } from "vitest";
import {
  DRIVE_SPECIAL_DAILY_SECONDS,
  DRIVE_SPECIAL_END_MS,
  DRIVE_SPECIAL_NAME,
  driveSpecialAppliesTo,
  driveSpecialCapApplies,
  isDriveSpecialActive,
  remainingDriveSpecialSeconds,
  userOwnsDriveTheMusicIndependently,
} from "@/lib/billing/drive-special";
import {
  resolveCapabilityAccess,
  resolveEffectiveEntitlements,
  resolveProfileDriveAccess,
} from "@/lib/entitlements/access-resolver";
import { DEFAULT_ENTITLEMENT_USER } from "@/lib/entitlements/defaults";
import { buildSitemapXml } from "@/lib/seo";
import { DEMO_PAGE_ENABLED } from "@/lib/feature-flags";

const NOW = Date.parse("2026-11-15T12:00:00+01:00");
const AFTER = DRIVE_SPECIAL_END_MS;
const loggedIn = { ...DEFAULT_ENTITLEMENT_USER, accountId: "acc-1" };
const anon = { ...DEFAULT_ENTITLEMENT_USER, accountId: null };

describe("Black Friday Special", () => {
  it("runs 9 Nov 2026 00:00 Berlin through exclusive end 28 Nov 2026 00:00 Berlin", () => {
    expect(new Date(DRIVE_SPECIAL_END_MS).toISOString()).toBe("2026-11-27T23:00:00.000Z");
    expect(isDriveSpecialActive(Date.parse("2026-11-08T23:59:59+01:00"))).toBe(false);
    expect(isDriveSpecialActive(Date.parse("2026-11-09T00:00:00+01:00"))).toBe(true);
    expect(isDriveSpecialActive(Date.parse("2026-11-27T23:59:59+01:00"))).toBe(true);
    expect(isDriveSpecialActive(AFTER - 1)).toBe(true);
    expect(isDriveSpecialActive(AFTER)).toBe(false);
  });
  it("needs a signed-in account", () => {
    expect(driveSpecialAppliesTo("acc", NOW)).toBe(true);
    expect(driveSpecialAppliesTo(null, NOW)).toBe(false);
  });
  it("unlocks Drive the Music for logged-in users only, never Drive+", () => {
    const e = resolveEffectiveEntitlements({ user: loggedIn, now: NOW });
    expect(e.has("symphony_all")).toBe(true);
    expect(e.has("fusion")).toBe(true);
    expect(e.has("all_sound_profiles")).toBe(false);
    expect(e.has("dynamic_drive")).toBe(false);
    expect(resolveEffectiveEntitlements({ user: anon, now: NOW }).has("symphony_all")).toBe(false);
    expect(resolveCapabilityAccess("symphony_all", { user: loggedIn, now: NOW }).source).toBe(
      "drive_special",
    );
  });
  it("applies to existing accounts too (no signup-date check)", () => {
    const existing = { ...loggedIn, accountId: "acc-registered-2025", revision: 42 };
    expect(resolveEffectiveEntitlements({ user: existing, now: NOW }).has("symphony_all")).toBe(
      true,
    );
    expect(driveSpecialAppliesTo("acc-registered-2025", NOW)).toBe(true);
  });
  it("switches off automatically after the end", () => {
    expect(resolveEffectiveEntitlements({ user: loggedIn, now: AFTER }).has("symphony_all")).toBe(
      false,
    );
  });
  it("lets logged-in users drive a music profile but not a Drive+ engine", () => {
    expect(
      resolveProfileDriveAccess("fusion-road-anthem", { user: loggedIn, now: NOW }).allowed,
    ).toBe(true);
    expect(resolveProfileDriveAccess("fusion-road-anthem", { user: anon, now: NOW }).allowed).toBe(
      false,
    );
    expect(resolveProfileDriveAccess("police-patrol", { user: loggedIn, now: NOW }).allowed).toBe(
      false,
    );
  });
});

describe("Black Friday Special 15-minute cap math", () => {
  it("is 15 minutes and remaining never goes below zero", () => {
    expect(DRIVE_SPECIAL_DAILY_SECONDS).toBe(900);
    expect(remainingDriveSpecialSeconds(0)).toBe(900);
    expect(remainingDriveSpecialSeconds(899)).toBe(1);
    expect(remainingDriveSpecialSeconds(900)).toBe(0);
    expect(remainingDriveSpecialSeconds(1200)).toBe(0);
  });
  it("does not cap purchasers, Founders with an active perk, or music-trial grants", () => {
    expect(
      userOwnsDriveTheMusicIndependently({ plan: "DRIVE_MUSIC" }),
    ).toBe(true);
    expect(
      userOwnsDriveTheMusicIndependently({ plan: "DRIVE_COMPLETE" }),
    ).toBe(true);
    expect(
      userOwnsDriveTheMusicIndependently({ founderDrivePlusActive: true }),
    ).toBe(true);
    expect(
      userOwnsDriveTheMusicIndependently({
        grantedEntitlements: ["symphony_all"],
      }),
    ).toBe(true);
    expect(
      userOwnsDriveTheMusicIndependently({
        trialActive: true,
        trialEntitlements: ["symphony_all"],
      }),
    ).toBe(true);
    expect(userOwnsDriveTheMusicIndependently({ plan: "FREE" })).toBe(false);
    expect(userOwnsDriveTheMusicIndependently({ plan: "DRIVE_PLUS" })).toBe(false);
  });
  it("cap applies only to signed-in free/Drive+ accounts in the window", () => {
    expect(driveSpecialCapApplies({ accountId: "acc-1", plan: "FREE" }, NOW)).toBe(true);
    expect(driveSpecialCapApplies({ accountId: "acc-1", plan: "DRIVE_PLUS" }, NOW)).toBe(true);
    expect(driveSpecialCapApplies({ accountId: "acc-1", plan: "DRIVE_MUSIC" }, NOW)).toBe(false);
    expect(
      driveSpecialCapApplies({ accountId: "acc-1", plan: "FREE", founderDrivePlusActive: true }, NOW),
    ).toBe(false);
    expect(driveSpecialCapApplies({ accountId: null, plan: "FREE" }, NOW)).toBe(false);
    expect(driveSpecialCapApplies({ accountId: "acc-1", plan: "FREE" }, AFTER)).toBe(false);
  });
});

describe("Demo page flag", () => {
  it("is off and /demo is not in the sitemap", () => {
    expect(DEMO_PAGE_ENABLED).toBe(false);
    expect(buildSitemapXml()).not.toContain("/demo");
  });
});

describe("Black Friday Special banner copy", () => {
  it("has EN/DE/RO copy and falls back to EN", async () => {
    const { driveSpecialBannerText, DRIVE_SPECIAL_PURPLE, driveSpecialCapCopy } = await import(
      "./drive-special"
    );
    expect(DRIVE_SPECIAL_NAME).toBe("Black Friday Special");
    expect(driveSpecialBannerText("en").text).toMatch(/15 minutes a day/);
    expect(driveSpecialBannerText("de").text).toMatch(/15 Minuten/);
    expect(driveSpecialBannerText("ro").text).toMatch(/15 minute/);
    expect(driveSpecialBannerText("fr").text).toMatch(/15 minutes a day/);
    expect(DRIVE_SPECIAL_PURPLE).toMatch(/^#[0-9a-f]{6}$/i);
    expect(driveSpecialCapCopy("en").cta).toMatch(/Drive the Music/);
    expect(driveSpecialCapCopy("de").body).toMatch(/Morgen/);
    expect(driveSpecialCapCopy("ro").title).toMatch(/15 minute/);
  });
});
