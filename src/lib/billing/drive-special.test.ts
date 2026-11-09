import { describe, expect, it } from "vitest";
import {
  DRIVE_SPECIAL_DAILY_SECONDS,
  DRIVE_SPECIAL_END_MS,
  DRIVE_SPECIAL_NAME,
  MIDNIGHT_DARK_RAVE_PROFILE_ID,
  driveSpecialAppliesTo,
  driveSpecialCapApplies,
  isDriveSpecialActive,
  landingStartDriveProfileId,
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

describe("Black Friday Special 30-minute cap math", () => {
  it("is 30 minutes and remaining never goes below zero", () => {
    expect(DRIVE_SPECIAL_DAILY_SECONDS).toBe(1800);
    expect(remainingDriveSpecialSeconds(0)).toBe(1800);
    expect(remainingDriveSpecialSeconds(1799)).toBe(1);
    expect(remainingDriveSpecialSeconds(1800)).toBe(0);
    expect(remainingDriveSpecialSeconds(2400)).toBe(0);
  });
  it("does not cap purchasers, Founders with an active perk, or music-trial grants", () => {
    expect(userOwnsDriveTheMusicIndependently({ plan: "DRIVE_MUSIC" })).toBe(true);
    expect(userOwnsDriveTheMusicIndependently({ plan: "DRIVE_COMPLETE" })).toBe(true);
    expect(userOwnsDriveTheMusicIndependently({ founderDrivePlusActive: true })).toBe(true);
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
      driveSpecialCapApplies(
        { accountId: "acc-1", plan: "FREE", founderDrivePlusActive: true },
        NOW,
      ),
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
  it("has a short non-specific EN/DE/RO teaser and falls back to EN", async () => {
    const { driveSpecialBannerText, DRIVE_SPECIAL_PURPLE, driveSpecialCapCopy } =
      await import("./drive-special");
    expect(DRIVE_SPECIAL_NAME).toBe("Black Friday Special");
    const offerDetail = /minute|Drive the Music|15|30/i;
    for (const lang of ["en", "de", "ro", "fr"] as const) {
      const copy = driveSpecialBannerText(lang);
      expect(copy.teaser).not.toMatch(offerDetail);
      expect(copy.cta.length).toBeGreaterThan(0);
      expect(copy.terms.length).toBeGreaterThan(0);
    }
    expect(driveSpecialBannerText("en").teaser).toMatch(/27th of November/);
    expect(driveSpecialBannerText("de").teaser).toMatch(/27\. November/);
    expect(driveSpecialBannerText("ro").teaser).toMatch(/27 noiembrie/);
    expect(driveSpecialBannerText("en").login).toBe("Log In");
    expect(driveSpecialBannerText("en").cta).toBe("See the sounds");
    expect(driveSpecialBannerText("ro").terms).toMatch(/termen/i);
    expect(DRIVE_SPECIAL_PURPLE).toMatch(/^#[0-9a-f]{6}$/i);
    expect(driveSpecialCapCopy("en").cta).toMatch(/Drive the Music/);
    expect(driveSpecialCapCopy("de").body).toMatch(/Morgen/);
    expect(driveSpecialCapCopy("en").title).toMatch(/30/);
    expect(driveSpecialCapCopy("ro").title).toMatch(/30/);
  });
  it("welcome copy is EN/DE/RO and names the benefits", async () => {
    const { blackFridayWelcomeCopy } = await import("./drive-special");
    expect(blackFridayWelcomeCopy("en").title).toBe("Congratulations!");
    expect(blackFridayWelcomeCopy("en").body).toMatch(/Midnight Dark Rave/);
    expect(blackFridayWelcomeCopy("en").body).toMatch(/30 minutes/);
    expect(blackFridayWelcomeCopy("en").startDrive).toBe("Start Drive");
    expect(blackFridayWelcomeCopy("en").foundersPack).toBe("Founders Pack");
    expect(blackFridayWelcomeCopy("en").body).toMatch(/limited availability/);
    expect(blackFridayWelcomeCopy("de").title).toMatch(/Glückwunsch/);
    expect(blackFridayWelcomeCopy("ro").terms).toMatch(/termen/i);
  });
  it("sounds hint names Midnight Dark Rave and the 30-minute Drive the Music allowance", async () => {
    const { driveSpecialSoundsHint } = await import("./drive-special");
    expect(driveSpecialSoundsHint("en", true)).toMatch(/Midnight Dark Rave/);
    expect(driveSpecialSoundsHint("en", true)).toMatch(/30 minutes/);
    expect(driveSpecialSoundsHint("en", false)).toMatch(/15 minutes/);
    expect(driveSpecialSoundsHint("de", true)).toMatch(/30 Minuten/);
    expect(driveSpecialSoundsHint("ro", false)).toMatch(/30 minute/);
  });
});

describe("landing Start Drive profile", () => {
  it("is Midnight Dark Rave during the window and Racing V10 after", () => {
    expect(landingStartDriveProfileId(NOW)).toBe(MIDNIGHT_DARK_RAVE_PROFILE_ID);
    expect(landingStartDriveProfileId(AFTER)).toBe("racing-v10");
  });
});
