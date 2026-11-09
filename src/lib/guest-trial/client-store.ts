/**
 * Client side of the guest trial: remaining free seconds today.
 * Source of truth is the server (/api/guest-trial, hashed IP); a localStorage
 * counter is kept as a backup and the stricter of the two always wins.
 */
import { isDriveSpecialActive, isMidnightDarkRaveProfile } from "@/lib/billing/drive-special";
import {
  GUEST_TRIAL_DAILY_SECONDS,
  berlinDayKey,
  guestTrialNow,
  isGuestTrialProfile,
  isGuestTrialWindow,
} from "@/lib/guest-trial/config";
import { getGenreChoice, subscribeGenreChoice } from "@/lib/symphony/adaptive/genre-store";

const KEY = "elcamoso.guestTrial.v1";

export interface GuestTrialState {
  day: string;
  /** Seconds counted locally today (backup). */
  localUsed: number;
  /** Seconds the server has confirmed today (null until first reply / local only). */
  serverUsed: number | null;
  /** Seconds driven since the last heartbeat was accepted. */
  pending: number;
  /** Bumped on any change so React hooks re-evaluate. */
  version: number;
}

let state: GuestTrialState = { day: "", localUsed: 0, serverUsed: null, pending: 0, version: 0 };
const listeners = new Set<() => void>();
let genreUnsub: (() => void) | null = null;

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
  // New Berlin day (or first load): daily reset.
  state = { day, localUsed, serverUsed: null, pending: 0, version: state.version + 1 };
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

export function getGuestTrialState(now = guestTrialNow()): GuestTrialState {
  load(now);
  return state;
}

export function subscribeGuestTrial(fn: () => void): () => void {
  listeners.add(fn);
  genreUnsub ??= subscribeGenreChoice(() => emit());
  return () => listeners.delete(fn);
}

export function guestUsedSeconds(s: GuestTrialState = getGuestTrialState()): number {
  const server = s.serverUsed == null ? 0 : s.serverUsed + s.pending;
  return Math.max(s.localUsed, server);
}

export function guestRemainingSeconds(now = guestTrialNow()): number {
  return Math.max(0, GUEST_TRIAL_DAILY_SECONDS - guestUsedSeconds(getGuestTrialState(now)));
}

/** Count `seconds` of driving a trial sound. */
export function tickGuestTrial(seconds: number, now = guestTrialNow()) {
  load(now);
  if (seconds <= 0) return;
  state.localUsed = Math.min(GUEST_TRIAL_DAILY_SECONDS, state.localUsed + seconds);
  state.pending += seconds;
  emit();
}

/** Take the seconds to send with the next heartbeat. */
export function takePendingSeconds(): number {
  const p = Math.round(state.pending);
  return p;
}

/** Apply a server reply. */
export function applyServerUsage(
  reply: { mode: string; usedSeconds?: number; day?: string },
  sent: number,
) {
  if (reply.mode !== "guest" || typeof reply.usedSeconds !== "number") {
    // local_only / inactive / signed_in: keep counting locally.
    state.pending = Math.max(0, state.pending - sent);
    emit();
    return;
  }
  if (reply.day && reply.day !== state.day) return;
  state.serverUsed = reply.usedSeconds;
  state.pending = Math.max(0, state.pending - sent);
  emit();
}

/** Tests only. */
export function resetGuestTrialForTests() {
  state = { day: "", localUsed: 0, serverUsed: null, pending: 0, version: 0 };
  try {
    storage()?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Current genre choice for the genre host profile (Auto DJ never counts). */
export function currentTrialGenre(): string | null {
  const g = getGenreChoice();
  return g === "auto" ? null : g;
}

/**
 * Whether a signed-out visitor may drive `profileId` right now through the trial.
 * Signed-in accounts never use this path (their access is unchanged).
 */
/**
 * True when the guest trial (not the normal free/paid rules) decides access:
 * signed-out visitor, inside the window, one of the trial sounds. In that
 * case even the normally free V8 / V10 share the 7-minute daily allowance.
 */
export function guestTrialGoverns(
  profileId: string,
  signedIn: boolean,
  now = guestTrialNow(),
  genre: string | null = currentTrialGenre(),
): boolean {
  // During Black Friday, Midnight Dark Rave uses its own 15-minute guest rule.
  if (isMidnightDarkRaveProfile(profileId) && isDriveSpecialActive(now)) return false;
  return !signedIn && isGuestTrialWindow(now) && isGuestTrialProfile(profileId, genre);
}

export function guestTrialAllows(
  profileId: string,
  signedIn: boolean,
  now = guestTrialNow(),
  genre: string | null = currentTrialGenre(),
): boolean {
  if (signedIn) return false;
  if (!isGuestTrialWindow(now)) return false;
  if (isMidnightDarkRaveProfile(profileId) && isDriveSpecialActive(now)) return false;
  if (!isGuestTrialProfile(profileId, genre)) return false;
  return guestRemainingSeconds(now) > 0;
}
