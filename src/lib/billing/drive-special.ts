/**
 * Black Friday Special (replaces the ended 7 Days Drive Special).
 *
 * Signed-in drivers get Drive the Music (DRIVE_MUSIC_PACKAGE_ENTITLEMENTS) for
 * 30 minutes per Berlin day, from 9 Nov 2026 until exclusive end
 * 2026-11-28T00:00:00+01:00 (end of Black Friday in Europe/Berlin).
 * Logged-out users never get it. Drive+ is NOT included.
 * Paying users and Founders who already own the music are not capped.
 * The purple banner stays non-specific; full terms live on /legal/terms#black-friday-special.
 *
 * Independent of the Black Friday Drive the Music 4-month checkout trial in
 * `black-friday.ts` — that deal is unchanged and must not double-count here.
 *
 * Client-safe: pure date math, shared by the server snapshot and the client.
 */
import { DRIVE_MUSIC_PACKAGE_ENTITLEMENTS } from "@/lib/entitlements/plans";
import type { Entitlement, Plan } from "@/lib/entitlements/types";

/** Inclusive start: 9 Nov 2026 00:00 Europe/Berlin (CET, UTC+1). */
export const DRIVE_SPECIAL_START_ISO = "2026-11-09T00:00:00+01:00";
export const DRIVE_SPECIAL_START_MS = Date.parse(DRIVE_SPECIAL_START_ISO);
/** Exclusive end: 28 Nov 2026 00:00 Europe/Berlin (CET, UTC+1) — after Black Friday. */
export const DRIVE_SPECIAL_END_ISO = "2026-11-28T00:00:00+01:00";
export const DRIVE_SPECIAL_END_MS = Date.parse(DRIVE_SPECIAL_END_ISO);
export const DRIVE_SPECIAL_NAME = "Black Friday Special";
/** Short chip on Sounds list items. */
export const DRIVE_SPECIAL_BADGE = "Special";

/** Entitlements the special grants (Drive the Music only, never Drive+). */
export const DRIVE_SPECIAL_ENTITLEMENTS: readonly Entitlement[] = DRIVE_MUSIC_PACKAGE_ENTITLEMENTS;

/** Free minutes per Berlin day for signed-in drivers who only have the special. */
export const DRIVE_SPECIAL_DAILY_MINUTES = 30;
/** Free seconds per Berlin day for signed-in drivers who only have the special. */
export const DRIVE_SPECIAL_DAILY_SECONDS = DRIVE_SPECIAL_DAILY_MINUTES * 60;
/** Client heartbeat interval while a special sound plays. */
export const DRIVE_SPECIAL_HEARTBEAT_SECONDS = 30;

/** Engine sounds listed next to the music at the top of the sounds list. */
export const DRIVE_SPECIAL_COMPANION_IDS: readonly string[] = [
  "american-muscle-v8",
  "racing-v10",
  "police-patrol",
  "wild-west-carriage",
  "romanian-85-carriage",
];

export function isDriveSpecialActive(now: number = Date.now()): boolean {
  return now >= DRIVE_SPECIAL_START_MS && now < DRIVE_SPECIAL_END_MS;
}

/** Whether this account gets the special at `now` (signed in + inside the window). */
export function driveSpecialAppliesTo(
  accountId: string | null | undefined,
  now: number = Date.now(),
): boolean {
  return Boolean(accountId) && isDriveSpecialActive(now);
}

/**
 * True when the account already owns Drive the Music through a purchase, Founder
 * perk, reward grant, or active trial — the 30-minute cap must not apply.
 */
export function userOwnsDriveTheMusicIndependently(input: {
  plan?: Plan | null;
  founderDrivePlusActive?: boolean | null;
  grantedEntitlements?: readonly Entitlement[] | null;
  trialActive?: boolean | null;
  trialEntitlements?: readonly Entitlement[] | null;
}): boolean {
  if (input.founderDrivePlusActive) return true;
  if (input.plan === "DRIVE_MUSIC" || input.plan === "DRIVE_COMPLETE") return true;
  if (input.grantedEntitlements?.includes("symphony_all")) return true;
  if (input.trialActive && input.trialEntitlements?.includes("symphony_all")) return true;
  return false;
}

/** Daily 30-minute cap applies: signed-in, in window, music access is only from the special. */
export function driveSpecialCapApplies(
  input: {
    accountId: string | null | undefined;
    plan?: Plan | null;
    founderDrivePlusActive?: boolean | null;
    grantedEntitlements?: readonly Entitlement[] | null;
    trialActive?: boolean | null;
    trialEntitlements?: readonly Entitlement[] | null;
  },
  now: number = Date.now(),
): boolean {
  return (
    driveSpecialAppliesTo(input.accountId, now) && !userOwnsDriveTheMusicIndependently(input)
  );
}

export function remainingDriveSpecialSeconds(usedSeconds: number): number {
  return Math.max(0, DRIVE_SPECIAL_DAILY_SECONDS - Math.max(0, Math.floor(usedSeconds)));
}

/** Purple accent for the special (banner + Sounds list marking). */
export const DRIVE_SPECIAL_PURPLE = "#a855f7";

/** Purple banner: short teaser only — no minutes, package name, or per-day details. */
export const DRIVE_SPECIAL_BANNER_TEXT = {
  en: {
    teaser: "On now until Black Friday.",
    cta: "See the sounds",
    terms: "See terms and conditions",
  },
  de: {
    teaser: "Jetzt bis Black Friday.",
    cta: "Zu den Sounds",
    terms: "Zu den Bedingungen",
  },
  ro: {
    teaser: "Până de Black Friday.",
    cta: "Vezi sunetele",
    terms: "Vezi termenii și condițiile",
  },
} as const;

export function driveSpecialBannerText(language: string | undefined) {
  const key = (language ?? "en").slice(0, 2).toLowerCase();
  return key === "de" || key === "ro"
    ? DRIVE_SPECIAL_BANNER_TEXT[key]
    : DRIVE_SPECIAL_BANNER_TEXT.en;
}

export const DRIVE_SPECIAL_SOUNDS_HINT = {
  en: {
    signedIn: "Drive the Music is free for you 30 minutes a day, until Black Friday.",
    signedOut: "Log in to unlock: Drive the Music free 30 minutes a day until Black Friday.",
  },
  de: {
    signedIn: "Drive the Music ist für dich 30 Minuten am Tag gratis, bis Black Friday.",
    signedOut: "Anmelden zum Freischalten: Drive the Music 30 Minuten am Tag gratis bis Black Friday.",
  },
  ro: {
    signedIn: "Drive the Music e gratuit pentru tine 30 minute pe zi, până de Black Friday.",
    signedOut: "Autentifică-te: Drive the Music gratuit 30 minute pe zi până de Black Friday.",
  },
} as const;

export function driveSpecialSoundsHint(language: string | undefined, signedIn: boolean) {
  const key = (language ?? "en").slice(0, 2).toLowerCase();
  const copy =
    key === "de" || key === "ro" ? DRIVE_SPECIAL_SOUNDS_HINT[key] : DRIVE_SPECIAL_SOUNDS_HINT.en;
  return signedIn ? copy.signedIn : copy.signedOut;
}

export type DriveSpecialCapCopy = {
  remaining: (min: number, sec: number) => string;
  title: string;
  body: string;
  cta: string;
  close: string;
};

const CAP_COPY: Record<"en" | "de" | "ro", DriveSpecialCapCopy> = {
  en: {
    remaining: (m, s) => `Black Friday Special: ${m}:${String(s).padStart(2, "0")} left today`,
    title: "Today's 30 free minutes are up",
    body: "Your Black Friday Special minutes come back tomorrow. Get Drive the Music to keep playing without a daily cap.",
    cta: "Get Drive the Music",
    close: "Not now",
  },
  de: {
    remaining: (m, s) => `Black Friday Special: noch ${m}:${String(s).padStart(2, "0")} heute`,
    title: "Die 30 Gratis-Minuten für heute sind vorbei",
    body: "Morgen gibt es wieder Black-Friday-Minuten. Mit Drive the Music spielst du ohne Tageslimit weiter.",
    cta: "Drive the Music holen",
    close: "Später",
  },
  ro: {
    remaining: (m, s) => `Black Friday Special: ${m}:${String(s).padStart(2, "0")} rămase azi`,
    title: "Cele 30 de minute gratuite de azi s-au terminat",
    body: "Minutele Black Friday revin mâine. Ia Drive the Music ca să asculți fără limită zilnică.",
    cta: "Ia Drive the Music",
    close: "Nu acum",
  },
};

export function driveSpecialCapCopy(language: string | undefined): DriveSpecialCapCopy {
  const key = (language ?? "en").slice(0, 2).toLowerCase();
  return key === "de" || key === "ro" ? CAP_COPY[key] : CAP_COPY.en;
}
