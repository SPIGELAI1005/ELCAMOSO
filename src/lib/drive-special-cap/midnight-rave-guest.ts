/**
 * Signed-out Midnight Dark Rave allowance during the Black Friday Special:
 * 15 minutes per Berlin calendar day. No account, so the counter lives in
 * localStorage keyed by Berlin date. Signed-in play is unlimited and is not
 * tracked here (and does not count against the 30-minute Drive the Music cap).
 */
import {
  MIDNIGHT_DARK_RAVE_GUEST_DAILY_SECONDS,
  isDriveSpecialActive,
  isMidnightDarkRaveProfile,
  remainingMidnightDarkRaveGuestSeconds,
} from "@/lib/billing/drive-special";
import { berlinDayKey } from "@/lib/guest-trial/config";

const KEY = "elcamoso.midnightDarkRaveGuest.v1";

export interface MidnightRaveGuestState {
  day: string;
  localUsed: number;
  version: number;
}

let state: MidnightRaveGuestState = { day: "", localUsed: 0, version: 0 };
const listeners = new Set<() => void>();

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function load(now: number) {
  const day = berlinDayKey(now);
  if (state.day === day) return;
  let localUsed = 0;
  try {
    const raw = storage()?.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as { day?: string; used?: number }) : null;
    if (saved?.day === day && Number.isFinite(saved.used)) localUsed = Number(saved.used);
  } catch {
    /* corrupt / private mode */
  }
  state = { day, localUsed, version: state.version + 1 };
}

function emit() {
  state = { ...state, version: state.version + 1 };
  try {
    storage()?.setItem(KEY, JSON.stringify({ day: state.day, used: state.localUsed }));
  } catch {
    /* ignore */
  }
  for (const l of listeners) l();
}

export function getMidnightRaveGuestState(now = Date.now()): MidnightRaveGuestState {
  load(now);
  return state;
}

export function subscribeMidnightRaveGuest(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function midnightRaveGuestRemainingSeconds(now = Date.now()): number {
  load(now);
  return remainingMidnightDarkRaveGuestSeconds(state.localUsed);
}

/** Count `seconds` of signed-out Midnight Dark Rave play. */
export function tickMidnightRaveGuest(seconds: number, now = Date.now()) {
  load(now);
  if (seconds <= 0) return;
  state.localUsed = Math.min(MIDNIGHT_DARK_RAVE_GUEST_DAILY_SECONDS, state.localUsed + seconds);
  emit();
}

/** Tests only. */
export function resetMidnightRaveGuestForTests() {
  state = { day: "", localUsed: 0, version: 0 };
  try {
    storage()?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * True when the signed-out 15-minute Midnight Dark Rave rule decides access:
 * visitor is logged out, the Black Friday window is open, and this is that sound.
 */
export function midnightRaveGuestGoverns(
  profileId: string,
  signedIn: boolean,
  now = Date.now(),
): boolean {
  return !signedIn && isDriveSpecialActive(now) && isMidnightDarkRaveProfile(profileId);
}

export function midnightRaveGuestAllows(
  profileId: string,
  signedIn: boolean,
  now = Date.now(),
): boolean {
  if (!midnightRaveGuestGoverns(profileId, signedIn, now)) return false;
  return midnightRaveGuestRemainingSeconds(now) > 0;
}
