/**
 * Optional proxy to a dedicated drive-relay host.
 * When `DRIVE_RELAY_INTERNAL_URL` is set (server-only), create/claim/join
 * hit the relay process so WebSocket peers share the same in-memory store.
 *
 * Never put Stripe/Google/DB secrets on the relay - only session material.
 */

import type { CreateDriveRelaySessionResult } from "./types";

function internalBase(): string | null {
  const raw = process.env["DRIVE_RELAY_INTERNAL_URL"]?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function isRemoteDriveRelayStoreEnabled(): boolean {
  return Boolean(internalBase());
}

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  const base = internalBase();
  if (!base) return null;
  const secret = process.env["DRIVE_RELAY_INTERNAL_SECRET"]?.trim();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export async function remoteCreateSession(): Promise<CreateDriveRelaySessionResult | null> {
  return postJson<CreateDriveRelaySessionResult>("/v1/session/create", {});
}

export async function remoteClaimToken(claimToken: string): Promise<{
  sessionId: string;
  joinSecret: string;
  expiresAt: number;
} | null> {
  const r = await postJson<{
    ok: boolean;
    sessionId?: string;
    joinSecret?: string;
    expiresAt?: number;
  }>("/v1/session/claim", { claimToken });
  if (!r?.ok || !r.sessionId || !r.joinSecret || !r.expiresAt) return null;
  return { sessionId: r.sessionId, joinSecret: r.joinSecret, expiresAt: r.expiresAt };
}

export async function remoteJoinByCode(pairingCode: string): Promise<{
  sessionId: string;
  joinSecret: string;
  expiresAt: number;
} | null> {
  const r = await postJson<{
    ok: boolean;
    sessionId?: string;
    joinSecret?: string;
    expiresAt?: number;
  }>("/v1/session/join-code", { pairingCode });
  if (!r?.ok || !r.sessionId || !r.joinSecret || !r.expiresAt) return null;
  return { sessionId: r.sessionId, joinSecret: r.joinSecret, expiresAt: r.expiresAt };
}

export async function remotePeekClaim(claimToken: string): Promise<{
  expired: boolean;
  used: boolean;
  phoneConnected: boolean;
} | null> {
  const r = await postJson<{
    ok: boolean;
    expired?: boolean;
    used?: boolean;
    phoneConnected?: boolean;
  }>("/v1/session/peek-claim", { claimToken });
  if (!r?.ok) return null;
  return {
    expired: Boolean(r.expired),
    used: Boolean(r.used),
    phoneConnected: Boolean(r.phoneConnected),
  };
}
