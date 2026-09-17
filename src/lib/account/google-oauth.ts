import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { readGoogleOAuthConfig } from "@/lib/account/google-oauth-config";
import { verifyGoogleIdToken, type GoogleIdTokenClaims } from "@/lib/account/google-id-token";

const STATE_TTL_MS = 10 * 60 * 1000;
const GOOGLE_SCOPES = "openid email profile";

export interface PendingGoogleOAuthState {
  state: string;
  returnTo: string;
  createdAt: number;
  codeVerifier: string;
  nonce: string;
}

export interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  id_token?: string;
  scope?: string;
  token_type?: string;
  refresh_token?: string;
}

const pendingStates = new Map<string, PendingGoogleOAuthState>();

function pruneStates(now = Date.now()) {
  for (const [state, row] of pendingStates) {
    if (now - row.createdAt > STATE_TTL_MS) pendingStates.delete(state);
  }
}

function createPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

function oauthPendingSecret(): string {
  const dedicated = (process.env["ELCAMOSO_ACCOUNT_SESSION_SECRET"] ?? "").trim();
  if (dedicated.length >= 16) return dedicated;
  const google = (process.env["GOOGLE_CLIENT_SECRET"] ?? "").trim();
  if (google.length >= 16) return `elcamoso-oauth:${google}`;
  return "elcamoso-dev-google-oauth-pending";
}

function signPending(payloadB64: string): string {
  return createHmac("sha256", oauthPendingSecret()).update(payloadB64).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function resetGoogleOAuthStateForTests(): void {
  pendingStates.clear();
}

export function createGoogleOAuthState(returnTo: string): {
  state: string;
  codeChallenge: string;
  nonce: string;
  pending: PendingGoogleOAuthState;
} {
  pruneStates();
  const state = randomBytes(24).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  const { codeVerifier, codeChallenge } = createPkcePair();
  const pending: PendingGoogleOAuthState = {
    state,
    returnTo,
    createdAt: Date.now(),
    codeVerifier,
    nonce,
  };
  pendingStates.set(state, pending);
  return { state, codeChallenge, nonce, pending };
}

/** Signed cookie payload so PKCE/state survive serverless / multi-instance. */
export function mintGoogleOAuthPendingCookie(pending: PendingGoogleOAuthState): string {
  const payloadB64 = Buffer.from(JSON.stringify(pending), "utf8").toString("base64url");
  return `${payloadB64}.${signPending(payloadB64)}`;
}

export function verifyGoogleOAuthPendingCookie(
  raw: string,
  expectedState: string,
  now = Date.now(),
): PendingGoogleOAuthState | null {
  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;
  if (!payloadB64 || !signature) return null;
  if (!safeEqual(signPending(payloadB64), signature)) return null;
  try {
    const pending = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as PendingGoogleOAuthState;
    if (pending.state !== expectedState) return null;
    if (now - pending.createdAt > STATE_TTL_MS) return null;
    if (!pending.codeVerifier || !pending.nonce) return null;
    return pending;
  } catch {
    return null;
  }
}

export function consumeGoogleOAuthState(
  state: string,
  now = Date.now(),
  cookieRaw?: string | null,
): PendingGoogleOAuthState | null {
  pruneStates(now);
  const row = pendingStates.get(state);
  if (row) {
    pendingStates.delete(state);
    if (now - row.createdAt > STATE_TTL_MS) return null;
    return row;
  }
  if (cookieRaw) {
    return verifyGoogleOAuthPendingCookie(cookieRaw, state, now);
  }
  return null;
}

export function buildGoogleAuthorizeUrl(
  state: string,
  codeChallenge: string,
  nonce: string,
): string {
  const config = readGoogleOAuthConfig();
  if (!config.configured) {
    throw new Error("Google sign-in is not configured on this server.");
  }
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    access_type: "online",
    include_granted_scopes: "true",
    prompt: "select_account",
  });
  return `${config.authorizeUrl}?${params.toString()}`;
}

export async function exchangeGoogleAuthorizationCode(
  code: string,
  codeVerifier: string,
): Promise<GoogleTokenResponse> {
  const config = readGoogleOAuthConfig();
  if (!config.configured) {
    throw new Error("Google sign-in is not configured on this server.");
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  });
  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as GoogleTokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok) {
    throw new Error(
      json.error_description ?? json.error ?? `Google token request failed (${res.status}).`,
    );
  }
  if (!json.id_token) throw new Error("Google token response missing id_token.");
  return json;
}

export async function verifyExchangedGoogleIdToken(
  idToken: string,
  nonce: string,
): Promise<GoogleIdTokenClaims> {
  const config = readGoogleOAuthConfig();
  if (!config.configured) {
    throw new Error("Google sign-in is not configured on this server.");
  }
  return verifyGoogleIdToken(idToken, {
    audience: config.clientId,
    nonce,
  });
}
