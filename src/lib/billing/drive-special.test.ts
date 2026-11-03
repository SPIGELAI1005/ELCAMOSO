import { describe, expect, it } from "vitest";
import {
  DRIVE_SPECIAL_END_MS,
  driveSpecialAppliesTo,
  isDriveSpecialActive,
} from "@/lib/billing/drive-special";
import {
  resolveCapabilityAccess,
  resolveEffectiveEntitlements,
  resolveProfileDriveAccess,
} from "@/lib/entitlements/access-resolver";
import { DEFAULT_ENTITLEMENT_USER } from "@/lib/entitlements/defaults";
import { buildSitemapXml } from "@/lib/seo";
import { DEMO_PAGE_ENABLED } from "@/lib/feature-flags";

const NOW = Date.parse("2026-11-05T12:00:00+01:00");
const AFTER = DRIVE_SPECIAL_END_MS;
const loggedIn = { ...DEFAULT_ENTITLEMENT_USER, accountId: "acc-1" };
const anon = { ...DEFAULT_ENTITLEMENT_USER, accountId: null };

describe("7 Days Drive Special", () => {
  it("ends 09.11.2026 00:00 Berlin", () => {
    expect(new Date(DRIVE_SPECIAL_END_MS).toISOString()).toBe("2026-11-08T23:00:00.000Z");
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
  it("is off before the 7-day window starts", () => {
    expect(isDriveSpecialActive(Date.parse("2026-11-01T23:59:59+01:00"))).toBe(false);
    expect(isDriveSpecialActive(Date.parse("2026-11-02T00:00:00+01:00"))).toBe(true);
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

describe("Demo page flag", () => {
  it("is off and /demo is not in the sitemap", () => {
    expect(DEMO_PAGE_ENABLED).toBe(false);
    expect(buildSitemapXml()).not.toContain("/demo");
  });
});

describe("7 Days Drive Special banner copy", () => {
  it("has EN/DE/RO copy and falls back to EN", async () => {
    const { driveSpecialBannerText, DRIVE_SPECIAL_PURPLE } = await import("./drive-special");
    expect(driveSpecialBannerText("de").text).toMatch(/gratis/);
    expect(driveSpecialBannerText("ro").text).toMatch(/gratuit/);
    expect(driveSpecialBannerText("fr").text).toMatch(/free/);
    expect(DRIVE_SPECIAL_PURPLE).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
