import { createHmac, timingSafeEqual } from "node:crypto";

import type { AccountSession } from "@/lib/account/session-store";

interface SessionTicketPayload {
  v: 1;
  t: string;
  u: string;
  e: string;
  x: number;
  c: number;
}

function readSessionSigningSecret(): string {
  const dedicated = (process.env["ELCAMOSO_ACCOUNT_SESSION_SECRET"] ?? "").trim();
  if (dedicated.length >= 16) return dedicated;
  const google = (process.env["GOOGLE_CLIENT_SECRET"] ?? "").trim();
  if (google.length >= 16) return `elcamoso-account:${google}`;
  // Local/dev fallback so signed cookies still round-trip in a single process.
  return "elcamoso-dev-account-session-secret";
}

function sign(payloadB64: string): string {
  return createHmac("sha256", readSessionSigningSecret()).update(payloadB64).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Mint a self-contained signed session ticket for the HttpOnly cookie. */
export function mintAccountSessionTicket(session: AccountSession): string {
  const payload: SessionTicketPayload = {
    v: 1,
    t: session.token,
    u: session.userId,
    e: session.email,
    x: session.expiresAt,
    c: session.createdAt,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

/** Verify a signed session ticket. Returns null when forged or expired. */
export function verifyAccountSessionTicket(
  ticket: string,
  now = Date.now(),
): AccountSession | null {
  const parts = ticket.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;
  if (!payloadB64 || !signature) return null;
  if (!safeEqual(sign(payloadB64), signature)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as Partial<SessionTicketPayload>;
    if (parsed.v !== 1) return null;
    if (typeof parsed.t !== "string" || !parsed.t) return null;
    if (typeof parsed.u !== "string" || !parsed.u) return null;
    if (typeof parsed.e !== "string" || !parsed.e) return null;
    if (typeof parsed.x !== "number" || parsed.x <= now) return null;
    if (typeof parsed.c !== "number") return null;
    return {
      token: parsed.t,
      userId: parsed.u,
      email: parsed.e,
      expiresAt: parsed.x,
      createdAt: parsed.c,
    };
  } catch {
    return null;
  }
}
