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
