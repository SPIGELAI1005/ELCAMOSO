/**
 * Drive phone pairing over Supabase Realtime broadcast (same free link Symphony uses).
 *
 * Vercel cannot host the WebSocket relay, so the car and phone talk on ephemeral
 * broadcast channels. Nothing is stored server-side; the car holds the pairing state.
 *
 * Channels:
 * - `elc-drive-claim:{claimToken}` lobby for the QR link (single use, 3 min)
 * - `elc-drive-code:{pairingCode}` lobby for the typed 6-digit code (single use, 3 min)
 * - `elc-drive:{channelKey}` data link (random 128-bit key, only handed out by the car)
 */

import type { RelayRole } from "./types";

export const DRIVE_CHANNEL_PREFIX = "elc-drive:";
export const DRIVE_CLAIM_PREFIX = "elc-drive-claim:";
export const DRIVE_CODE_PREFIX = "elc-drive-code:";

/** Phone motion send rate while moving (Hz). Fusion treats phone IMU as fresh for 450 ms. */
export const DRIVE_MOTION_SEND_HZ = 10;
/** Rate while parked and still: saves quota at lights / in parking. Must stay < 450 ms. */
export const DRIVE_MOTION_IDLE_HZ = 4;
/** Peer presence heartbeat; peer counts as gone after PEER_STALE_MS. */
export const PEER_HEARTBEAT_MS = 4_000;
export const PEER_STALE_MS = 11_000;
/** Reconnect backoff: 1 s, 2 s, 4 s, 8 s, 15 s cap (+ up to 20 % jitter). */
export const RECONNECT_BASE_MS = 1_000;
export const RECONNECT_MAX_MS = 15_000;
/** Phone credentials stay usable this long (car decides whether it still listens). */
export const DRIVE_LINK_TTL_MS = 12 * 60 * 60 * 1000;
export const LOBBY_REPLY_TIMEOUT_MS = 7_000;

export function reconnectDelayMs(attempt: number, rand: () => number = Math.random): number {
  const base = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** Math.max(0, attempt));
  return Math.round(base * (1 + 0.2 * rand()));
}

export function randomKey(bytes = 16): string {
  const a = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

const KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;
export function isSafeKey(key: string): boolean {
  return KEY_RE.test(key);
}

/** Decides whether a motion sample should be sent now (10 Hz moving, 4 Hz still). */
export function createMotionSendGate(opts?: { moveHz?: number; idleHz?: number }) {
  const moveMs = 1000 / (opts?.moveHz ?? DRIVE_MOTION_SEND_HZ);
  const idleMs = 1000 / (opts?.idleHz ?? DRIVE_MOTION_IDLE_HZ);
  let lastAt = -Infinity;
  return (
    now: number,
    sample: { speedKmh?: number; accelerationLongitudinal?: number },
  ): boolean => {
    const still =
      (sample.speedKmh ?? 0) < 1 && Math.abs(sample.accelerationLongitudinal ?? 0) < 0.15;
    // Small tolerance so a 15 Hz sensor tick (67 ms) lands on ~10 Hz instead of 7.5 Hz.
    const gap = (still ? idleMs : moveMs) - 30;
    if (now - lastAt < gap) return false;
    lastAt = now;
    return true;
  };
}

/** Tracks when each peer role was last heard from. */
export function createPeerTracker() {
  const lastSeen: Partial<Record<RelayRole, number>> = {};
  return {
    seen(role: RelayRole, now: number) {
      lastSeen[role] = now;
    },
    forget(role: RelayRole) {
      delete lastSeen[role];
    },
    flags(now: number) {
      const live = (r: RelayRole) => {
        const t = lastSeen[r];
        return t !== undefined && now - t < PEER_STALE_MS;
      };
      return { display: live("display"), phone: live("phone"), telemetry: live("telemetry") };
    },
  };
}

export interface LobbyGrant {
  ok: true;
  sessionId: string;
  joinSecret: string;
  expiresAt: number;
}
export type LobbyReply =
  | LobbyGrant
  | { ok: false; reason: "expired" | "used" }
  | { ok: true; peek: true; expired: boolean; used: boolean };

/** Car-side single-use claim logic for the QR + code lobbies (pure, testable). */
export function createLobbyHost(input: {
  sessionId: string;
  channelKey: string;
  claimExpiresAt: number;
}) {
  let usedBy: string | null = null;
  return {
    get used() {
      return usedBy !== null;
    },
    peek(now: number): LobbyReply {
      return { ok: true, peek: true, expired: now > input.claimExpiresAt, used: usedBy !== null };
    },
    claim(nonce: string, now: number): LobbyReply {
      // Same phone retrying (lost reply) gets the same grant again.
      if (usedBy !== null && usedBy !== nonce) return { ok: false, reason: "used" };
      if (usedBy === null && now > input.claimExpiresAt) return { ok: false, reason: "expired" };
      usedBy = nonce;
      return {
        ok: true,
        sessionId: input.sessionId,
        joinSecret: input.channelKey,
        expiresAt: now + DRIVE_LINK_TTL_MS,
      };
    },
  };
}
