import { randomBytes } from "node:crypto";
import { readTeslaOAuthConfig } from "@/lib/tesla/config";
import { TESLA_SCOPE_STRING } from "@/lib/tesla/scopes";
import type { TeslaStoredTokens } from "@/lib/tesla/types";

const STATE_TTL_MS = 10 * 60 * 1000;

interface PendingOAuthState {
  linkId: string;
  nonce: string;
  createdAt: number;
  deploy: string;
}

const pendingStates = new Map<string, PendingOAuthState>();

function pruneStates(now = Date.now()) {
  for (const [state, row] of pendingStates) {
    if (now - row.createdAt > STATE_TTL_MS) pendingStates.delete(state);
  }
}

export function createOAuthState(linkId: string): string {
  pruneStates();
  const state = randomBytes(24).toString("base64url");
  const config = readTeslaOAuthConfig();
  pendingStates.set(state, {
    linkId,
    nonce: randomBytes(16).toString("base64url"),
    createdAt: Date.now(),
    deploy: config.deploy,
  });
  return state;
}

export function consumeOAuthState(state: string): PendingOAuthState | null {
  pruneStates();
  const row = pendingStates.get(state);
  if (!row) return null;
  pendingStates.delete(state);
  if (Date.now() - row.createdAt > STATE_TTL_MS) return null;
  return row;
}

export function buildAuthorizeUrl(state: string): string {
  const config = readTeslaOAuthConfig();
  const nonce = pendingStates.get(state)?.nonce ?? randomBytes(16).toString("base64url");
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: TESLA_SCOPE_STRING,
    state,
    nonce,
    require_requested_scopes: "true",
  });
  return `${config.authorizeUrl}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  const config = readTeslaOAuthConfig();
  const res = await fetch(config.authTokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok) {
    throw new Error(
      json.error_description ?? json.error ?? `Token request failed (${res.status}).`,
    );
  }
  if (!json.access_token) throw new Error("Token response missing access_token.");
  return json;
}

export async function exchangeAuthorizationCode(code: string): Promise<TeslaStoredTokens> {
  const config = readTeslaOAuthConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    audience: config.fleetApiBase,
  });
  const json = await postToken(body);
  if (!json.refresh_token) throw new Error("Token response missing refresh_token.");
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 3600;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + expiresIn * 1000 - 30_000,
    fleetApiBase: config.fleetApiBase,
    scopes: json.scope ?? TESLA_SCOPE_STRING,
    region: "NA",
  };
}

export async function refreshAccessToken(
  refreshToken: string,
  fleetApiBase: string,
): Promise<TeslaStoredTokens> {
  const config = readTeslaOAuthConfig();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    audience: fleetApiBase,
  });
  const json = await postToken(body);
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 3600;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresAt: Date.now() + expiresIn * 1000 - 30_000,
    fleetApiBase,
    scopes: json.scope ?? TESLA_SCOPE_STRING,
    region: "NA",
  };
}

/** Best-effort revoke on disconnect (RFC 7009). */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const config = readTeslaOAuthConfig();
  if (!config.clientId) return;
  const body = new URLSearchParams({
    token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  try {
    await fetch("https://auth.tesla.com/oauth2/v3/revoke", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch {
    /* local delete still proceeds */
  }
}

export function resetOAuthStateForTests(): void {
  pendingStates.clear();
}
