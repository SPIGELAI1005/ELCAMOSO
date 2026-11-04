import type { RealtimeChannel } from "@supabase/supabase-js";

import { getRealtimeClient } from "@/lib/phone-sync/channel";
import {
  createLobbyHost,
  DRIVE_CLAIM_PREFIX,
  DRIVE_CODE_PREFIX,
  isSafeKey,
  LOBBY_REPLY_TIMEOUT_MS,
  randomKey,
  type LobbyReply,
} from "./realtime-link";

type LobbyKind = "claim" | "code";

function lobbyName(kind: LobbyKind, key: string) {
  return (kind === "claim" ? DRIVE_CLAIM_PREFIX : DRIVE_CODE_PREFIX) + key;
}

/**
 * Car side: answer QR / code claims until the first phone takes it (single use).
 * Returns a stop function.
 */
export async function hostDrivePairingLobby(input: {
  sessionId: string;
  channelKey: string;
  claimToken: string;
  pairingCode: string;
  claimExpiresAt: number;
}): Promise<() => void> {
  const client = await getRealtimeClient();
  if (!client) throw new Error("Realtime unavailable");
  const host = createLobbyHost(input);
  const channels: RealtimeChannel[] = [];
  const open = (kind: LobbyKind, key: string) => {
    if (!isSafeKey(key)) return;
    const ch = client.channel(lobbyName(kind, key), {
      config: { broadcast: { self: false, ack: false } },
    });
    ch.on("broadcast", { event: "req" }, (msg) => {
      const p = (msg["payload"] ?? {}) as { nonce?: unknown; op?: unknown };
      if (typeof p.nonce !== "string") return;
      const now = Date.now();
      const reply: LobbyReply = p.op === "peek" ? host.peek(now) : host.claim(p.nonce, now);
      void ch.send({ type: "broadcast", event: "res", payload: { nonce: p.nonce, reply } });
    });
    ch.subscribe();
    channels.push(ch);
  };
  open("claim", input.claimToken);
  open("code", input.pairingCode);
  return () => {
    for (const ch of channels) void client.removeChannel(ch);
  };
}

/** Phone side: ask the car's lobby and wait for its answer (null = no car listening). */
export async function askDrivePairingLobby(
  kind: LobbyKind,
  key: string,
  op: "peek" | "claim",
  timeoutMs = LOBBY_REPLY_TIMEOUT_MS,
): Promise<LobbyReply | null> {
  if (!isSafeKey(key) && !/^\d{6}$/.test(key)) return null;
  const client = await getRealtimeClient();
  if (!client) return null;
  const nonce = readOrCreateNonce();
  return new Promise((resolve) => {
    let done = false;
    let resend: number | undefined;
    const ch = client.channel(lobbyName(kind, key), {
      config: { broadcast: { self: false, ack: false } },
    });
    const finish = (r: LobbyReply | null) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      if (resend !== undefined) window.clearInterval(resend);
      void client.removeChannel(ch);
      resolve(r);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    ch.on("broadcast", { event: "res" }, (msg) => {
      const p = (msg["payload"] ?? {}) as { nonce?: unknown; reply?: LobbyReply };
      if (p.nonce === nonce && p.reply) finish(p.reply);
    });
    ch.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      const send = () => void ch.send({ type: "broadcast", event: "req", payload: { nonce, op } });
      send();
      resend = window.setInterval(send, 1_200);
    });
  });
}

/** One nonce per phone tab, so a retried claim gets the same grant back. */
function readOrCreateNonce(): string {
  const k = "elcamoso.drive.pair-nonce";
  try {
    const v = sessionStorage.getItem(k);
    if (v) return v;
    const n = randomKey(12);
    sessionStorage.setItem(k, n);
    return n;
  } catch {
    return randomKey(12);
  }
}

export type DrivePairJoinResult =
  | { ok: true; sessionId: string; joinSecret: string; expiresAt: number }
  | { ok: false; reason: "expired" | "used" | "offline" };

function toJoin(r: LobbyReply | null): DrivePairJoinResult {
  if (!r) return { ok: false, reason: "offline" };
  if (!r.ok) return { ok: false, reason: r.reason };
  if ("peek" in r) return { ok: false, reason: "offline" };
  return r;
}

export async function claimDrivePairToken(claimToken: string): Promise<DrivePairJoinResult> {
  return toJoin(await askDrivePairingLobby("claim", claimToken, "claim"));
}

export async function joinDrivePairByCode(code: string): Promise<DrivePairJoinResult> {
  return toJoin(await askDrivePairingLobby("code", code.replace(/\s/g, ""), "claim"));
}

export async function peekDrivePairToken(
  claimToken: string,
): Promise<{ ok: false } | { ok: true; expired: boolean; used: boolean }> {
  const r = await askDrivePairingLobby("claim", claimToken, "peek", 6_000);
  if (!r || !r.ok || !("peek" in r)) return { ok: false };
  return { ok: true, expired: r.expired, used: r.used };
}
