/**
 * "7 Days Drive Special" (George, 3 Nov 2026).
 *
 * Drive the Music (all symphony-* / fusion-* profiles, Auto DJ, Fusion, highway
 * stages) is free for every signed-in account until purchases open on 9.11.2026.
 * Logged-out users never get it. Drive+ is NOT included, and Founders / Black
 * Friday logic is untouched. Switches itself off at DRIVE_SPECIAL_END_ISO.
 *
 * Client-safe: pure date math, shared by the server snapshot and the client.
 */
import { DRIVE_MUSIC_PACKAGE_ENTITLEMENTS } from "@/lib/entitlements/plans";
import type { Entitlement } from "@/lib/entitlements/types";

/** Exclusive end: 9 Nov 2026 00:00 Europe/Berlin (CET, UTC+1). */
export const DRIVE_SPECIAL_END_ISO = "2026-11-09T00:00:00+01:00";
export const DRIVE_SPECIAL_END_MS = Date.parse(DRIVE_SPECIAL_END_ISO);
/** Start of the 7-day window (right after the Halloween special ends). */
export const DRIVE_SPECIAL_START_ISO = "2026-11-02T00:00:00+01:00";
export const DRIVE_SPECIAL_START_MS = Date.parse(DRIVE_SPECIAL_START_ISO);
export const DRIVE_SPECIAL_NAME = "7 Days Drive Special";

/** Entitlements the special grants (Drive the Music only, never Drive+). */
export const DRIVE_SPECIAL_ENTITLEMENTS: readonly Entitlement[] = DRIVE_MUSIC_PACKAGE_ENTITLEMENTS;

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

/** Purple accent for the special (banner + Sounds list marking, like Halloween orange). */
export const DRIVE_SPECIAL_PURPLE = "#a855f7";

export const DRIVE_SPECIAL_BANNER_TEXT = {
  en: {
    text: "Drive the Music is free for every signed-in driver until 9 Nov.",
    cta: "See the sounds",
  },
  de: {
    text: "Drive the Music ist bis 9. Nov. für alle angemeldeten Fahrer gratis.",
    cta: "Zu den Sounds",
  },
  ro: {
    text: "Drive the Music e gratuit pentru toți șoferii conectați până pe 9 nov.",
    cta: "Vezi sunetele",
  },
} as const;

export function driveSpecialBannerText(language: string | undefined) {
  const key = (language ?? "en").slice(0, 2).toLowerCase();
  return key === "de" || key === "ro"
    ? DRIVE_SPECIAL_BANNER_TEXT[key]
    : DRIVE_SPECIAL_BANNER_TEXT.en;
}
