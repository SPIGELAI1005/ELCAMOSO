/**
 * Server-only Google ID token (JWT) validation.
 * Never log or return the raw token.
 */

const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

export interface GoogleIdTokenClaims {
  iss: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean;
  exp: number;
  iat?: number;
  nonce?: string;
  name?: string;
  picture?: string;
}

export interface VerifyGoogleIdTokenOptions {
  audience: string;
  nonce: string;
  nowSeconds?: number;
  /** Override for tests; default uses Google tokeninfo (signature + claims). */
  fetchImpl?: typeof fetch;
}

function decodeJwtPayload(idToken: string): Record<string, unknown> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid Google ID token.");
  const payloadPart = parts[1];
  if (!payloadPart) throw new Error("Invalid Google ID token.");
  const json = Buffer.from(payloadPart, "base64url").toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}

export function assertGoogleIdTokenClaims(
  payload: Record<string, unknown>,
  opts: { audience: string; nonce: string; nowSeconds?: number },
): GoogleIdTokenClaims {
  const nowSeconds = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  const iss = typeof payload["iss"] === "string" ? payload["iss"] : "";
  if (!GOOGLE_ISSUERS.has(iss)) {
    throw new Error("Invalid Google ID token issuer.");
  }

  const audRaw = payload["aud"];
  const audiences = Array.isArray(audRaw)
    ? audRaw.filter((v): v is string => typeof v === "string")
    : typeof audRaw === "string"
      ? [audRaw]
      : [];
  if (!audiences.includes(opts.audience)) {
    throw new Error("Invalid Google ID token audience.");
  }

  const exp = typeof payload["exp"] === "number" ? payload["exp"] : NaN;
  if (!Number.isFinite(exp) || exp <= nowSeconds) {
    throw new Error("Google ID token expired.");
  }

  const nonce = typeof payload["nonce"] === "string" ? payload["nonce"] : "";
  if (!nonce || nonce !== opts.nonce) {
    throw new Error("Invalid Google ID token nonce.");
  }

  const email = typeof payload["email"] === "string" ? payload["email"] : "";
  if (!email) throw new Error("Google account did not return an email address.");

  const emailVerifiedRaw = payload["email_verified"];
  const emailVerified =
    emailVerifiedRaw === true || emailVerifiedRaw === "true" || emailVerifiedRaw === "1";
  if (!emailVerified) {
    throw new Error("Verify your Google email address, then try again.");
  }

  const sub = typeof payload["sub"] === "string" ? payload["sub"] : "";
  if (!sub) throw new Error("Invalid Google ID token subject.");

  const claims: GoogleIdTokenClaims = {
    iss,
    aud: opts.audience,
    sub,
    email,
    email_verified: true,
    exp,
    nonce,
  };
  if (typeof payload["iat"] === "number") claims.iat = payload["iat"];
  if (typeof payload["name"] === "string") claims.name = payload["name"];
  if (typeof payload["picture"] === "string") claims.picture = payload["picture"];
  return claims;
}

/**
 * Validates issuer, audience, expiration, nonce, and email via local claims,
 * then confirms the signature with Google's tokeninfo endpoint.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  opts: VerifyGoogleIdTokenOptions,
): Promise<GoogleIdTokenClaims> {
  if (!idToken.trim()) throw new Error("Missing Google ID token.");

  const claimOpts: { audience: string; nonce: string; nowSeconds?: number } = {
    audience: opts.audience,
    nonce: opts.nonce,
  };
  if (opts.nowSeconds !== undefined) claimOpts.nowSeconds = opts.nowSeconds;

  const localClaims = assertGoogleIdTokenClaims(decodeJwtPayload(idToken), claimOpts);

  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = `${TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`;
  const res = await fetchImpl(url, { method: "GET" });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok) {
    throw new Error(json.error_description ?? json.error ?? "Invalid Google ID token.");
  }

  // Re-check critical claims from the verified tokeninfo payload.
  return assertGoogleIdTokenClaims(json, claimOpts);
}

/** @internal test helper — builds an unsigned JWT-shaped token (signature ignored when tokeninfo is mocked). */
export function buildTestIdToken(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.test-signature`;
}
