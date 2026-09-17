import {
  ACCOUNT_SESSION_TTL_MS,
  MAGIC_LINK_TTL_MS,
  consumeMagicLink,
  createMagicLinkToken,
  createUserForEmail,
  deleteAccountSession,
  hashToken,
  readAccountSession,
  saveAccountSession,
  saveMagicLink,
  type AccountSession,
} from "@/lib/account/session-store";
import { isGoogleOAuthConfigured } from "@/lib/account/google-oauth-config";
import {
  buildGoogleAuthorizeUrl,
  consumeGoogleOAuthState,
  createGoogleOAuthState,
  exchangeGoogleAuthorizationCode,
  mintGoogleOAuthPendingCookie,
  verifyExchangedGoogleIdToken,
} from "@/lib/account/google-oauth";
import { mintAccountSessionTicket, verifyAccountSessionTicket } from "@/lib/account/session-ticket";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeAccountEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidAccountEmail(email: string): boolean {
  return EMAIL_RE.test(normalizeAccountEmail(email));
}

export interface RequestSignInResult {
  ok: true;
  message: string;
  /** Development-only instant verification URL. */
  verifyUrl?: string;
}

export interface VerifyMagicLinkResult {
  /** Signed session ticket for the HttpOnly cookie (not a raw bearer for localStorage). */
  sessionToken: string;
  userId: string;
  email: string;
  expiresAt: number;
}

export interface BeginGoogleSignInResult {
  available: boolean;
  authorizeUrl?: string;
  /** Server-only: signed PKCE/state payload for the pending OAuth cookie. */
  pendingCookie?: string;
  message?: string;
}

/** Client-safe Google completion payload — never includes Google tokens or session secrets. */
export interface CompleteGoogleSignInPublicResult {
  userId: string;
  email: string;
  expiresAt: number;
  returnTo: string;
}

export interface CompleteGoogleSignInResult extends CompleteGoogleSignInPublicResult {
  /** Server-only: used to set the HttpOnly session cookie. Never send to the browser. */
  sessionToken: string;
}

function createSessionToken(): string {
  return createMagicLinkToken();
}

function createSessionForEmail(email: string, now = Date.now()): VerifyMagicLinkResult {
  const normalized = normalizeAccountEmail(email);
  const userId = createUserForEmail(normalized);
  const sessionToken = createSessionToken();
  const session: AccountSession = {
    token: sessionToken,
    userId,
    email: normalized,
    expiresAt: now + ACCOUNT_SESSION_TTL_MS,
    createdAt: now,
  };
  saveAccountSession(session);
  return {
    sessionToken: mintAccountSessionTicket(session),
    userId,
    email: normalized,
    expiresAt: session.expiresAt,
  };
}

export function requestAccountSignIn(
  email: string,
  returnTo: string,
  origin: string,
  now = Date.now(),
): RequestSignInResult {
  const normalized = normalizeAccountEmail(email);
  if (!isValidAccountEmail(normalized)) {
    throw new Error("Enter a valid email address");
  }

  const token = createMagicLinkToken();
  saveMagicLink({
    tokenHash: hashToken(token),
    email: normalized,
    returnTo: sanitizeReturnTo(returnTo),
    expiresAt: now + MAGIC_LINK_TTL_MS,
    consumedAt: null,
  });

  const verifyPath = `/auth/account/callback?token=${encodeURIComponent(token)}&returnTo=${encodeURIComponent(sanitizeReturnTo(returnTo))}`;
  const verifyUrl = `${origin.replace(/\/$/, "")}${verifyPath}`;

  const isDev = (process.env["ELCAMOSO_ENV"] ?? "development") === "development";
  return {
    ok: true,
    message: isDev
      ? "Use the secure link below to continue."
      : "Check your email for a secure sign-in link.",
    ...(isDev ? { verifyUrl } : {}),
  };
}

export function verifyAccountMagicLink(token: string, now = Date.now()): VerifyMagicLinkResult {
  const pending = consumeMagicLink(token, now);
  if (!pending) throw new Error("Sign-in link expired or invalid");
  return createSessionForEmail(pending.email, now);
}

export function getGoogleSignInAvailability(): { available: boolean } {
  return { available: isGoogleOAuthConfigured() };
}

export function beginGoogleSignIn(returnTo: string): BeginGoogleSignInResult {
  if (!isGoogleOAuthConfigured()) {
    return {
      available: false,
      message: "Google sign-in is not configured on this server.",
    };
  }
  const { state, codeChallenge, nonce, pending } = createGoogleOAuthState(
    sanitizeReturnTo(returnTo),
  );
  return {
    available: true,
    authorizeUrl: buildGoogleAuthorizeUrl(state, codeChallenge, nonce),
    pendingCookie: mintGoogleOAuthPendingCookie(pending),
  };
}

export async function completeGoogleSignIn(
  code: string,
  state: string,
  now = Date.now(),
  pendingCookie?: string | null,
): Promise<CompleteGoogleSignInResult> {
  if (!code.trim()) {
    throw new Error("Missing Google sign-in response.");
  }
  if (!state.trim()) {
    throw new Error("Missing Google OAuth state.");
  }
  const pending = consumeGoogleOAuthState(state, now, pendingCookie);
  if (!pending) throw new Error("Google sign-in expired. Try again.");

  const tokens = await exchangeGoogleAuthorizationCode(code, pending.codeVerifier);
  // Google access/refresh tokens are discarded after ID token verification — never stored or returned.
  const idToken = tokens.id_token;
  if (!idToken) throw new Error("Google token response missing id_token.");
  const claims = await verifyExchangedGoogleIdToken(idToken, pending.nonce);
  const session = createSessionForEmail(claims.email, now);
  return {
    ...session,
    returnTo: pending.returnTo,
  };
}

export function getAccountSession(sessionToken: string, now = Date.now()): AccountSession | null {
  if (!sessionToken.trim()) return null;
  const fromTicket = verifyAccountSessionTicket(sessionToken, now);
  if (fromTicket) {
    saveAccountSession(fromTicket);
    return fromTicket;
  }
  return readAccountSession(sessionToken, now);
}

export function requireAccountSession(sessionToken: string, now = Date.now()): AccountSession {
  const session = getAccountSession(sessionToken, now);
  if (!session) throw new Error("Authentication required");
  return session;
}

export function signOutAccount(sessionToken: string): void {
  const session = getAccountSession(sessionToken);
  if (session) deleteAccountSession(session.token);
  deleteAccountSession(sessionToken);
}

export function sanitizeReturnTo(returnTo: string): string {
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) return "/drive";
  return returnTo;
}

export function toPublicGoogleSignInResult(
  result: CompleteGoogleSignInResult,
): CompleteGoogleSignInPublicResult {
  return {
    userId: result.userId,
    email: result.email,
    expiresAt: result.expiresAt,
    returnTo: result.returnTo,
  };
}
