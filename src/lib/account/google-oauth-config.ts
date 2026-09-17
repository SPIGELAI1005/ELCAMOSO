/**
 * Server-only Google OAuth client config for ELCAMOSO account sign-in.
 * Never prefix with VITE_ — secrets must not reach the browser bundle.
 */

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  configured: boolean;
}

export const PRODUCTION_GOOGLE_REDIRECT_URI =
  "https://www.elcamoso.com/auth/account/google/callback";
export const LOCAL_GOOGLE_REDIRECT_URI =
  "http://localhost:5173/auth/account/google/callback";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

function envName(base: string, suffix: string): string {
  return suffix ? `${base}_${suffix}` : base;
}

function readEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

function envTierSuffix(): string {
  const tier = (process.env["ELCAMOSO_ENV"] ?? "development").toLowerCase();
  if (tier === "staging") return "STAGING";
  if (tier === "production") return "PRODUCTION";
  return "";
}

function pick(base: string, suffix: string): string {
  if (suffix) {
    const specific = readEnv(envName(base, suffix));
    if (specific) return specific;
  }
  return readEnv(base);
}

export function readGoogleOAuthEnvPresence(): {
  clientId: boolean;
  clientSecret: boolean;
  redirectUri: boolean;
} {
  const suffix = envTierSuffix();
  return {
    clientId: Boolean(pick("GOOGLE_CLIENT_ID", suffix)),
    clientSecret: Boolean(pick("GOOGLE_CLIENT_SECRET", suffix)),
    redirectUri: Boolean(pick("GOOGLE_REDIRECT_URI", suffix)),
  };
}

/** True when Google client id, secret, and redirect URI are all set. */
export function isGoogleOAuthConfigured(): boolean {
  const presence = readGoogleOAuthEnvPresence();
  return presence.clientId && presence.clientSecret && presence.redirectUri;
}

export function readGoogleOAuthConfig(): GoogleOAuthConfig {
  const suffix = envTierSuffix();
  const clientId = pick("GOOGLE_CLIENT_ID", suffix);
  const clientSecret = pick("GOOGLE_CLIENT_SECRET", suffix);
  const redirectUri = pick("GOOGLE_REDIRECT_URI", suffix);

  return {
    clientId,
    clientSecret,
    redirectUri,
    authorizeUrl: AUTHORIZE_URL,
    tokenUrl: TOKEN_URL,
    userInfoUrl: USERINFO_URL,
    configured: Boolean(clientId && clientSecret && redirectUri),
  };
}

/**
 * Startup validation: partial Google OAuth env is a hard error.
 * Fully absent is allowed (Google sign-in disabled).
 * Production requires the www.elcamoso.com redirect URI when configured.
 */
export function validateGoogleOAuthEnvAtStartup(): {
  configured: boolean;
  warnings: string[];
} {
  const presence = readGoogleOAuthEnvPresence();
  const setCount = [presence.clientId, presence.clientSecret, presence.redirectUri].filter(
    Boolean,
  ).length;

  if (setCount > 0 && setCount < 3) {
    const missing: string[] = [];
    if (!presence.clientId) missing.push("GOOGLE_CLIENT_ID");
    if (!presence.clientSecret) missing.push("GOOGLE_CLIENT_SECRET");
    if (!presence.redirectUri) missing.push("GOOGLE_REDIRECT_URI");
    throw new Error(
      `Google OAuth misconfigured: missing ${missing.join(", ")}. Set all three or none.`,
    );
  }

  if (setCount === 0) {
    return {
      configured: false,
      warnings: ["Google OAuth is not configured; Continue with Google is hidden."],
    };
  }

  const config = readGoogleOAuthConfig();
  const tier = (process.env["ELCAMOSO_ENV"] ?? "development").toLowerCase();
  if (tier === "production" && config.redirectUri !== PRODUCTION_GOOGLE_REDIRECT_URI) {
    throw new Error(
      `GOOGLE_REDIRECT_URI must be ${PRODUCTION_GOOGLE_REDIRECT_URI} when ELCAMOSO_ENV=production.`,
    );
  }

  return { configured: true, warnings: [] };
}
