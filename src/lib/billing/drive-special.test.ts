import { describe, expect, it } from "vitest";
import {
  BLACK_FRIDAY_WINDOW,
  CYBER_MONDAY_WINDOW,
  DRIVE_SPECIAL_DAILY_SECONDS,
  DRIVE_SPECIAL_END_MS,
  DRIVE_SPECIAL_START_MS,
  DRIVE_SPECIAL_WINDOWS,
  MIDNIGHT_DARK_RAVE_PROFILE_ID,
  activeDriveSpecialWindow,
  driveSpecialAppliesTo,
  driveSpecialCapApplies,
  driveSpecialLastDayLabel,
  driveSpecialName,
  driveSpecialRunEndMs,
  isDriveSpecialActive,
  LANDING_START_DRIVE_PROFILE_ID,
  landingHeroPinsStartProfile,
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
/** Instant the whole special run (Black Friday + Cyber Monday) is over: 1 Dec 2026 00:00 Berlin. */
const AFTER = DRIVE_SPECIAL_END_MS;
const BF_END = BLACK_FRIDAY_WINDOW.endMs;
const CM_NOW = Date.parse("2026-11-29T12:00:00+01:00");
const loggedIn = { ...DEFAULT_ENTITLEMENT_USER, accountId: "acc-1" };
const anon = { ...DEFAULT_ENTITLEMENT_USER, accountId: null };

describe("Black Friday Special", () => {
  it("runs 9 Nov 2026 00:00 Berlin through exclusive end 28 Nov 2026 00:00 Berlin", () => {
    expect(BLACK_FRIDAY_WINDOW.startIso).toBe("2026-11-09T00:00:00+01:00");
    expect(BLACK_FRIDAY_WINDOW.endIso).toBe("2026-11-28T00:00:00+01:00");
    expect(new Date(BF_END).toISOString()).toBe("2026-11-27T23:00:00.000Z");
    const bf = (t: string) => activeDriveSpecialWindow(Date.parse(t))?.id ?? null;
    expect(bf("2026-11-08T23:59:59+01:00")).toBeNull();
    expect(isDriveSpecialActive(Date.parse("2026-11-08T23:59:59+01:00"))).toBe(false);
    expect(bf("2026-11-09T00:00:00+01:00")).toBe("black-friday");
    expect(bf("2026-11-27T23:59:59+01:00")).toBe("black-friday");
    expect(activeDriveSpecialWindow(BF_END - 1)?.id).toBe("black-friday");
    // Black Friday's exclusive end is the instant Cyber Monday starts: no gap, no overlap.
    expect(activeDriveSpecialWindow(BF_END)?.id).toBe("cyber-monday");
    expect(DRIVE_SPECIAL_START_MS).toBe(BLACK_FRIDAY_WINDOW.startMs);
  });
  it("Black Friday behaviour is unchanged by Cyber Monday (name, copy, Founders-pack welcome)", async () => {
    const { driveSpecialWelcomeCopy, driveSpecialBannerText, driveSpecialCapCopy } =
      await import("./drive-special");
    expect(driveSpecialName(NOW)).toBe("Black Friday Special");
    expect(driveSpecialBannerText("en", NOW).teaser).toBe(
      "Limited availability until 27th of November.",
    );
    expect(driveSpecialBannerText("de", NOW).teaser).toBe(
      "Nur begrenzt verfügbar bis 27. November.",
    );
    expect(driveSpecialBannerText("ro", NOW).teaser).toBe(
      "Disponibilitate limitată până pe 27 noiembrie.",
    );
    expect(driveSpecialWelcomeCopy("en", NOW).body).toBe(
      "Your Black Friday benefits are unlocked: Midnight Dark Rave unlimited and Drive the Music 30 minutes a day, until 27 November 2026. This offer has limited availability until 27 November. To keep access, purchase the Founders Pack — a yearly Drive+ or Drive the Music subscription.",
    );
    expect(driveSpecialWelcomeCopy("en", NOW).secondary).toEqual({
      kind: "founders",
      label: "Founders Pack",
    });
    expect(driveSpecialWelcomeCopy("en", NOW).termsHash).toBe("black-friday-special");
    expect(driveSpecialCapCopy("en", NOW).remaining(12, 5)).toBe(
      "Black Friday Special: 12:05 left today",
    );
    expect(driveSpecialCapCopy("de", NOW).body).toMatch(
      /Morgen gibt es wieder Black-Friday-Minuten/,
    );
    expect(driveSpecialCapCopy("ro", NOW).body).toMatch(/Minutele Black Friday revin mâine/);
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

describe("Cyber Monday Special", () => {
  it("runs 28 Nov 2026 00:00 Berlin through exclusive end 1 Dec 2026 00:00 Berlin", () => {
    expect(CYBER_MONDAY_WINDOW.startIso).toBe("2026-11-28T00:00:00+01:00");
    expect(CYBER_MONDAY_WINDOW.endIso).toBe("2026-12-01T00:00:00+01:00");
    expect(new Date(CYBER_MONDAY_WINDOW.startMs).toISOString()).toBe("2026-11-27T23:00:00.000Z");
    expect(new Date(CYBER_MONDAY_WINDOW.endMs).toISOString()).toBe("2026-11-30T23:00:00.000Z");
    const cm = (t: string) => activeDriveSpecialWindow(Date.parse(t))?.id ?? null;
    expect(cm("2026-11-27T23:59:59+01:00")).toBe("black-friday");
    expect(cm("2026-11-28T00:00:00+01:00")).toBe("cyber-monday");
    expect(cm("2026-11-29T12:00:00+01:00")).toBe("cyber-monday");
    expect(cm("2026-11-30T00:00:00+01:00")).toBe("cyber-monday");
    expect(cm("2026-11-30T23:59:59+01:00")).toBe("cyber-monday");
    expect(isDriveSpecialActive(AFTER - 1)).toBe(true);
    expect(cm("2026-12-01T00:00:00+01:00")).toBeNull();
    expect(isDriveSpecialActive(AFTER)).toBe(false);
    expect(AFTER).toBe(CYBER_MONDAY_WINDOW.endMs);
  });
  it("windows are in order, contiguous and never overlap", () => {
    expect(DRIVE_SPECIAL_WINDOWS.map((w) => w.id)).toEqual(["black-friday", "cyber-monday"]);
    for (let i = 1; i < DRIVE_SPECIAL_WINDOWS.length; i++) {
      expect(DRIVE_SPECIAL_WINDOWS[i]!.startMs).toBe(DRIVE_SPECIAL_WINDOWS[i - 1]!.endMs);
    }
    // Every sampled instant across both windows has exactly one active window.
    for (let t = DRIVE_SPECIAL_START_MS; t < AFTER; t += 6 * 60 * 60 * 1000) {
      expect(DRIVE_SPECIAL_WINDOWS.filter((w) => t >= w.startMs && t < w.endMs)).toHaveLength(1);
    }
  });
  it("the run end is the end of the back-to-back windows (entitlement expiry)", () => {
    expect(driveSpecialRunEndMs(NOW)).toBe(AFTER);
    expect(driveSpecialRunEndMs(CM_NOW)).toBe(AFTER);
    expect(driveSpecialRunEndMs(AFTER)).toBeNull();
    expect(
      resolveCapabilityAccess("symphony_all", { user: loggedIn, now: CM_NOW }).expiresAtUtc,
    ).toBe(AFTER);
  });
  it("uses the same conditions as Black Friday: signed-in Drive the Music, never Drive+, 30-minute cap", () => {
    const e = resolveEffectiveEntitlements({ user: loggedIn, now: CM_NOW });
    expect(e.has("symphony_all")).toBe(true);
    expect(e.has("fusion")).toBe(true);
    expect(e.has("all_sound_profiles")).toBe(false);
    expect(e.has("dynamic_drive")).toBe(false);
    expect(resolveEffectiveEntitlements({ user: anon, now: CM_NOW }).has("symphony_all")).toBe(
      false,
    );
    expect(driveSpecialAppliesTo("acc", CM_NOW)).toBe(true);
    expect(driveSpecialAppliesTo(null, CM_NOW)).toBe(false);
    expect(driveSpecialCapApplies({ accountId: "acc-1", plan: "FREE" }, CM_NOW)).toBe(true);
    expect(driveSpecialCapApplies({ accountId: "acc-1", plan: "DRIVE_MUSIC" }, CM_NOW)).toBe(false);
    expect(driveSpecialCapApplies({ accountId: "acc-1", plan: "FREE" }, AFTER)).toBe(false);
    // No gap at the Black Friday -> Cyber Monday handover.
    expect(driveSpecialAppliesTo("acc", BF_END - 1)).toBe(true);
    expect(driveSpecialAppliesTo("acc", BF_END)).toBe(true);
    expect(resolveEffectiveEntitlements({ user: loggedIn, now: AFTER }).has("symphony_all")).toBe(
      false,
    );
  });
  it("keeps the home-page Start Drive pin and Midnight Dark Rave welcome profile", () => {
    expect(landingHeroPinsStartProfile(BF_END)).toBe(true);
    expect(landingHeroPinsStartProfile(CM_NOW)).toBe(true);
    expect(landingStartDriveProfileId(CM_NOW)).toBe(MIDNIGHT_DARK_RAVE_PROFILE_ID);
    expect(landingHeroPinsStartProfile(AFTER)).toBe(false);
    expect(landingStartDriveProfileId(AFTER)).toBe("racing-v10");
  });
  it("renames to Cyber Monday Special at 28 Nov 00:00 and links its own terms section", () => {
    expect(driveSpecialName(BF_END - 1)).toBe("Black Friday Special");
    expect(driveSpecialName(BF_END)).toBe("Cyber Monday Special");
    expect(CYBER_MONDAY_WINDOW.termsHash).toBe("cyber-monday-special");
    expect(BLACK_FRIDAY_WINDOW.termsHash).toBe("black-friday-special");
  });
  it("formats the last day from the exclusive end (30 November, not 1 December)", () => {
    expect(driveSpecialLastDayLabel(CYBER_MONDAY_WINDOW, "en", { year: true })).toBe(
      "30 November 2026",
    );
    expect(driveSpecialLastDayLabel(CYBER_MONDAY_WINDOW, "de", { year: true })).toBe(
      "30. November 2026",
    );
    expect(driveSpecialLastDayLabel(CYBER_MONDAY_WINDOW, "ro", { year: true })).toBe(
      "30 noiembrie 2026",
    );
    expect(driveSpecialLastDayLabel(BLACK_FRIDAY_WINDOW, "en", { year: true })).toBe(
      "27 November 2026",
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
    expect(BLACK_FRIDAY_WINDOW.name).toBe("Black Friday Special");
    // No minutes/package details (a date such as "30th" is fine).
    const offerDetail = /minute|Minuten|Drive the Music|\b(15|30) ?(min|Min)/i;
    for (const now of [NOW, CM_NOW]) {
      for (const lang of ["en", "de", "ro", "fr"] as const) {
        expect(driveSpecialBannerText(lang, now).teaser).not.toMatch(offerDetail);
      }
    }
    for (const lang of ["en", "de", "ro", "fr"] as const) {
      const copy = driveSpecialBannerText(lang, NOW);
      expect(copy.cta.length).toBeGreaterThan(0);
      expect(copy.terms.length).toBeGreaterThan(0);
    }
    expect(driveSpecialBannerText("en", NOW).teaser).toMatch(/27th of November/);
    expect(driveSpecialBannerText("de", NOW).teaser).toMatch(/27\. November/);
    expect(driveSpecialBannerText("ro", NOW).teaser).toMatch(/27 noiembrie/);
    expect(driveSpecialBannerText("en", NOW).signup).toBe("Sign up");
    expect(driveSpecialBannerText("de", NOW).signup).toBe("Registrieren");
    expect(driveSpecialBannerText("ro", NOW).signup).toBe("Înregistrare");
    expect(driveSpecialBannerText("en", NOW).cta).toBe("See the sounds");
    expect(driveSpecialBannerText("ro", NOW).terms).toMatch(/termen/i);
    expect(DRIVE_SPECIAL_PURPLE).toMatch(/^#[0-9a-f]{6}$/i);
    expect(driveSpecialCapCopy("en", NOW).cta).toMatch(/Drive the Music/);
    expect(driveSpecialCapCopy("de", NOW).body).toMatch(/Morgen/);
    expect(driveSpecialCapCopy("en", NOW).title).toMatch(/30/);
    expect(driveSpecialCapCopy("ro", NOW).title).toMatch(/30/);
  });
  it("Cyber Monday banner teaser names 30 November in EN/DE/RO and the right name", async () => {
    const { driveSpecialBannerText } = await import("./drive-special");
    expect(driveSpecialBannerText("en", CM_NOW).teaser).toBe(
      "Limited availability until 30th of November.",
    );
    expect(driveSpecialBannerText("de", CM_NOW).teaser).toBe(
      "Nur begrenzt verfügbar bis 30. November.",
    );
    expect(driveSpecialBannerText("ro", CM_NOW).teaser).toBe(
      "Disponibilitate limitată până pe 30 noiembrie.",
    );
    expect(driveSpecialBannerText("en", BF_END).teaser).toMatch(/30th of November/);
    expect(driveSpecialBannerText("en", BF_END - 1).teaser).toMatch(/27th of November/);
    expect(driveSpecialName(CM_NOW)).toBe("Cyber Monday Special");
  });
  it("Cyber Monday welcome copy: same benefits, ends 30 Nov, plans instead of Founders Pack", async () => {
    const { driveSpecialWelcomeCopy } = await import("./drive-special");
    const en = driveSpecialWelcomeCopy("en", CM_NOW);
    expect(en.title).toBe("Congratulations!");
    expect(en.body).toBe(
      "Your Cyber Monday benefits are unlocked: Midnight Dark Rave unlimited and Drive the Music 30 minutes a day, until 30 November 2026. This offer has limited availability until 30 November. To keep access, get Drive+ or Drive the Music.",
    );
    expect(en.secondary).toEqual({ kind: "plans", label: "See plans" });
    expect(en.termsHash).toBe("cyber-monday-special");
    expect(en.body).not.toMatch(/Founders/);
    const de = driveSpecialWelcomeCopy("de", CM_NOW);
    expect(de.body).toMatch(/Cyber-Monday-Vorteile/);
    expect(de.body).toMatch(/30\. November 2026/);
    expect(de.secondary.kind).toBe("plans");
    const ro = driveSpecialWelcomeCopy("ro", CM_NOW);
    expect(ro.body).toMatch(/Cyber Monday/);
    expect(ro.body).toMatch(/30 noiembrie 2026/);
    expect(ro.secondary.kind).toBe("plans");
  });
  it("sign-up description and guest copy follow the open special's last day", async () => {
    const { driveSpecialSignUpDescription, midnightDarkRaveGuestCopy } =
      await import("./drive-special");
    expect(driveSpecialSignUpDescription("en", NOW)).toMatch(/until 27 November\.$/);
    expect(driveSpecialSignUpDescription("de", NOW)).toMatch(/bis zum 27\. November zu nutzen\.$/);
    expect(driveSpecialSignUpDescription("ro", NOW)).toMatch(/până pe 27 noiembrie\.$/);
    expect(driveSpecialSignUpDescription("en", CM_NOW)).toMatch(/until 30 November\.$/);
    expect(driveSpecialSignUpDescription("de", CM_NOW)).toMatch(
      /bis zum 30\. November zu nutzen\.$/,
    );
    expect(driveSpecialSignUpDescription("ro", CM_NOW)).toMatch(/până pe 30 noiembrie\.$/);
    expect(midnightDarkRaveGuestCopy("en", NOW).body).toMatch(/until 27 November 2026\./);
    expect(midnightDarkRaveGuestCopy("en", CM_NOW).body).toMatch(/until 30 November 2026\./);
    expect(midnightDarkRaveGuestCopy("de", CM_NOW).body).toMatch(/30\. November 2026/);
    expect(midnightDarkRaveGuestCopy("ro", CM_NOW).body).toMatch(/30 noiembrie 2026/);
  });
  it("Cyber Monday cap copy uses its name and only promises tomorrow's minutes before the last day", async () => {
    const { driveSpecialCapCopy } = await import("./drive-special");
    expect(driveSpecialCapCopy("en", CM_NOW).remaining(3, 7)).toBe(
      "Cyber Monday Special: 3:07 left today",
    );
    expect(driveSpecialCapCopy("en", CM_NOW).body).toMatch(
      /Your Cyber Monday Special minutes come back tomorrow/,
    );
    expect(driveSpecialCapCopy("de", CM_NOW).body).toMatch(/Cyber-Monday-Minuten/);
    expect(driveSpecialCapCopy("ro", CM_NOW).body).toMatch(/Minutele Cyber Monday revin mâine/);
    // Black Friday's last day hands over to Cyber Monday, so tomorrow still has minutes.
    const bfLastDay = Date.parse("2026-11-27T20:00:00+01:00");
    expect(driveSpecialCapCopy("en", bfLastDay).body).toMatch(/come back tomorrow/);
    // Cyber Monday's last day (30 Nov): nothing comes back tomorrow.
    const cmLastDay = Date.parse("2026-11-30T20:00:00+01:00");
    for (const lang of ["en", "de", "ro"] as const) {
      const body = driveSpecialCapCopy(lang, cmLastDay).body;
      expect(body).not.toMatch(/tomorrow|Morgen|mâine/);
      expect(body.length).toBeGreaterThan(0);
    }
  });
  it("welcome copy is EN/DE/RO and names the benefits", async () => {
    const { driveSpecialWelcomeCopy } = await import("./drive-special");
    const w = (l: string) => driveSpecialWelcomeCopy(l, NOW);
    expect(w("en").title).toBe("Congratulations!");
    expect(w("en").body).toMatch(/Midnight Dark Rave/);
    expect(w("en").body).toMatch(/30 minutes/);
    expect(w("en").startDrive).toBe("Start Drive");
    expect(w("en").secondary.label).toBe("Founders Pack");
    expect(w("en").body).toMatch(/limited availability/);
    expect(w("de").title).toMatch(/Glückwunsch/);
    expect(w("ro").terms).toMatch(/termen/i);
  });
  it("guest time-up copy asks to sign up (primary) then sign in", async () => {
    const { midnightDarkRaveGuestCopy } = await import("./drive-special");
    expect(midnightDarkRaveGuestCopy("en", NOW).signUp).toBe("Sign up");
    expect(midnightDarkRaveGuestCopy("en", NOW).signIn).toBe("Sign in");
    expect(midnightDarkRaveGuestCopy("de", NOW).signUp).toBe("Registrieren");
    expect(midnightDarkRaveGuestCopy("ro", NOW).signUp).toBe("Înregistrare");
    expect(midnightDarkRaveGuestCopy("en", NOW).body).toMatch(/Sign up or sign in/);
  });
  it("sounds hint names Midnight Dark Rave and the 30-minute Drive the Music allowance", async () => {
    const { driveSpecialSoundsHint } = await import("./drive-special");
    expect(driveSpecialSoundsHint("en", true, NOW)).toMatch(/Midnight Dark Rave/);
    expect(driveSpecialSoundsHint("en", true, NOW)).toMatch(/30 minutes/);
    expect(driveSpecialSoundsHint("en", true, NOW)).toMatch(/until Black Friday/);
    expect(driveSpecialSoundsHint("en", false, NOW)).toMatch(/15 minutes/);
    expect(driveSpecialSoundsHint("de", true, NOW)).toMatch(/30 Minuten/);
    expect(driveSpecialSoundsHint("ro", false, NOW)).toMatch(/30 minute/);
    expect(driveSpecialSoundsHint("en", true, CM_NOW)).toMatch(/until the end of Cyber Monday/);
    expect(driveSpecialSoundsHint("de", false, CM_NOW)).toMatch(/bis Ende Cyber Monday/);
    expect(driveSpecialSoundsHint("ro", true, CM_NOW)).toMatch(/până la sfârșitul Cyber Monday/);
  });
});

describe("landing Start Drive profile", () => {
  it("welcome-modal Start Drive is still Midnight Dark Rave during the window and Racing V10 after", () => {
    expect(landingStartDriveProfileId(NOW)).toBe(MIDNIGHT_DARK_RAVE_PROFILE_ID);
    expect(landingStartDriveProfileId(AFTER)).toBe("racing-v10");
  });

  it("home-page Start Drive pins the American Muscle V8 during the window, then leaves the current sound", () => {
    expect(LANDING_START_DRIVE_PROFILE_ID).toBe("american-muscle-v8");
    expect(LANDING_START_DRIVE_PROFILE_ID).not.toBe(MIDNIGHT_DARK_RAVE_PROFILE_ID);
    expect(landingHeroPinsStartProfile(NOW)).toBe(true);
    expect(landingHeroPinsStartProfile(AFTER)).toBe(false);
  });
});
