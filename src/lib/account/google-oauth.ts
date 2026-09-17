import { createHash, randomBytes } from "node:crypto";

import { readGoogleOAuthConfig } from "@/lib/account/google-oauth-config";
import { verifyGoogleIdToken, type GoogleIdTokenClaims } from "@/lib/account/google-id-token";

const STATE_TTL_MS = 10 * 60 * 1000;
const GOOGLE_SCOPES = "openid email profile";

export interface PendingGoogleOAuthState {
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

export function resetGoogleOAuthStateForTests(): void {
  pendingStates.clear();
}

export function createGoogleOAuthState(returnTo: string): {
  state: string;
  codeChallenge: string;
  nonce: string;
} {
  pruneStates();
  const state = randomBytes(24).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  const { codeVerifier, codeChallenge } = createPkcePair();
  pendingStates.set(state, {
    returnTo,
    createdAt: Date.now(),
    codeVerifier,
    nonce,
  });
  return { state, codeChallenge, nonce };
}

export function consumeGoogleOAuthState(
  state: string,
  now = Date.now(),
): PendingGoogleOAuthState | null {
  pruneStates(now);
  const row = pendingStates.get(state);
  if (!row) return null;
  pendingStates.delete(state);
  if (now - row.createdAt > STATE_TTL_MS) return null;
  return row;
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
