/**
 * Client side of the Black Friday Special 30-minute cap: remaining free seconds
 * today for a signed-in account whose Drive the Music access is only the special.
 * Source of truth is the server (/api/drive-special, keyed by account id); a
 * localStorage counter is kept as a backup and the stricter of the two wins.
 */
import {
  DRIVE_SPECIAL_DAILY_SECONDS,
  driveSpecialCapApplies,
  isDriveSpecialActive,
  isMidnightDarkRaveProfile,
} from "@/lib/billing/drive-special";
import { isMusicPackageProfileId } from "@/lib/entitlements/plans";
import type { Entitlement, Plan } from "@/lib/entitlements/types";
import { berlinDayKey } from "@/lib/guest-trial/config";
import { FREE_SOUND_PROFILE_IDS } from "@/lib/sound/profile-access-config";

const KEY = "elcamoso.driveSpecialCap.v1";

export interface DriveSpecialCapState {
  accountId: string;
  day: string;
  localUsed: number;
  serverUsed: number | null;
  pending: number;
  version: number;
}

let state: DriveSpecialCapState = {
  accountId: "",
  day: "",
  localUsed: 0,
  serverUsed: null,
  pending: 0,
  version: 0,
};
const listeners = new Set<() => void>();

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function storageKey(accountId: string, day: string) {
  return `${KEY}:${accountId}:${day}`;
}

function load(accountId: string, now: number) {
  const day = berlinDayKey(now);
  if (state.accountId === accountId && state.day === day) return;
  let localUsed = 0;
  try {
    const raw = storage()?.getItem(storageKey(accountId, day));
    const saved = raw ? (JSON.parse(raw) as { used?: number }) : null;
    if (saved && Number.isFinite(saved.used)) localUsed = Number(saved.used);
  } catch {
    /* corrupt / private mode */
  }
  state = { accountId, day, localUsed, serverUsed: null, pending: 0, version: state.version + 1 };
}

function emit() {
  state = { ...state, version: state.version + 1 };
  try {
    storage()?.setItem(
      storageKey(state.accountId, state.day),
      JSON.stringify({ used: state.localUsed }),
    );
  } catch {
    /* ignore */
  }
  for (const l of listeners) l();
}

export function getDriveSpecialCapState(accountId: string, now = Date.now()): DriveSpecialCapState {
  load(accountId, now);
  return state;
}

export function subscribeDriveSpecialCap(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function driveSpecialUsedSeconds(s: DriveSpecialCapState = state): number {
  const server = s.serverUsed == null ? 0 : s.serverUsed + s.pending;
  return Math.max(s.localUsed, server);
}

export function driveSpecialRemainingSeconds(accountId: string, now = Date.now()): number {
  load(accountId, now);
  return Math.max(0, DRIVE_SPECIAL_DAILY_SECONDS - driveSpecialUsedSeconds(state));
}

export function tickDriveSpecialCap(accountId: string, seconds: number, now = Date.now()) {
  load(accountId, now);
  if (seconds <= 0) return;
  state.localUsed = Math.min(DRIVE_SPECIAL_DAILY_SECONDS, state.localUsed + seconds);
  state.pending += seconds;
  emit();
}

export function takeDriveSpecialPendingSeconds(): number {
  return Math.round(state.pending);
}

export function applyDriveSpecialServerUsage(
  reply: { mode: string; usedSeconds?: number; day?: string },
  sent: number,
) {
  if (reply.mode !== "capped" || typeof reply.usedSeconds !== "number") {
    state.pending = Math.max(0, state.pending - sent);
    emit();
    return;
  }
  if (reply.day && reply.day !== state.day) return;
  state.serverUsed = reply.usedSeconds;
  state.pending = Math.max(0, state.pending - sent);
  emit();
}

export function resetDriveSpecialCapForTests() {
  state = { accountId: "", day: "", localUsed: 0, serverUsed: null, pending: 0, version: 0 };
  try {
    const s = storage();
    if (!s) return;
    const remove: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(KEY)) remove.push(k);
    }
    for (const k of remove) s.removeItem(k);
  } catch {
    /* ignore */
  }
}

export type DriveSpecialCapUser = {
  accountId: string | null;
  plan: Plan;
  founderDrivePlusActive?: boolean | null;
  grantedEntitlements?: readonly Entitlement[] | null;
  trialActive?: boolean | null;
  trialEntitlements?: readonly Entitlement[] | null;
  grantedProfileIds?: readonly string[] | null;
};

/** True when the special's 30-minute cap decides whether this music profile may play. */
export function driveSpecialCapGoverns(
  profileId: string,
  user: DriveSpecialCapUser,
  now = Date.now(),
): boolean {
  if (!driveSpecialCapApplies(user, now)) return false;
  // Midnight Dark Rave is unlimited for signed-in drivers during the window.
  if (isMidnightDarkRaveProfile(profileId)) return false;
  if (!isMusicPackageProfileId(profileId)) return false;
  if ((FREE_SOUND_PROFILE_IDS as readonly string[]).includes(profileId)) return false;
  if (user.grantedProfileIds?.includes(profileId)) return false;
  return true;
}

export function driveSpecialCapAllows(
  profileId: string,
  user: DriveSpecialCapUser,
  now = Date.now(),
): boolean {
  if (!driveSpecialCapGoverns(profileId, user, now)) return false;
  if (!user.accountId) return false;
  return driveSpecialRemainingSeconds(user.accountId, now) > 0;
}

export function isDriveSpecialWindow(now = Date.now()): boolean {
  return isDriveSpecialActive(now);
}
