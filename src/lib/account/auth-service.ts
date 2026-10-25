import {
  ACCOUNT_SESSION_TTL_MS,
  MAGIC_LINK_TTL_MS,
  consumeMagicLink,
  createMagicLinkToken,
  createUserForEmail,
  registerUserEmail,
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
import { sanitizeReturnTo } from "@/lib/account/return-to";
import { isEmailOtpConfigured, readSupabaseAuthConfig } from "@/lib/account/supabase-config";
import { buildSupabaseGoogleAuthorizeUrl, exchangeSupabasePkceCode } from "@/lib/account/supabase-google";
import {
  assertEmailOtpSendAllowed,
  assertEmailOtpVerifyAllowed,
  clearEmailOtpVerifyFailures,
  recordEmailOtpVerifyFailure,
  secondsRemaining,
  EMAIL_OTP_RESEND_COOLDOWN_MS,
} from "@/lib/account/email-otp-rate-limit";
import {
  clearPendingEmailOtp,
  readPendingEmailOtp,
  savePendingEmailOtp,
} from "@/lib/account/email-otp-pending";
import { EmailOtpProviderError, getEmailOtpProvider } from "@/lib/account/email-otp-provider";

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

/** Client-safe Google completion payload - never includes Google tokens or session secrets. */
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

/** Write-through to Postgres (account_sessions) when DATABASE_URL is set. Never blocks sign-in. */
async function persistSessionDurably(session: AccountSession): Promise<void> {
  if (!process.env["DATABASE_URL"]) return;
  try {
    const { persistAccountSession } = await import("@/lib/admin/admin-store.server");
    await persistAccountSession(session);
    const { claimFounderSeat } = await import("@/lib/founders/founders.server");
    await claimFounderSeat(session.userId, session.email, session.createdAt);
  } catch (error) {
    console.error(
      "[account] session persist failed",
      error instanceof Error ? error.message : error,
    );
  }
}

async function revokeSessionDurably(rawToken: string): Promise<void> {
  if (!process.env["DATABASE_URL"]) return;
  try {
    const { revokeAccountSession } = await import("@/lib/admin/admin-store.server");
    await revokeAccountSession(rawToken);
  } catch (error) {
    console.error(
      "[account] session revoke failed",
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * With DATABASE_URL, the same verified email always maps to the same account id on every
 * instance (users table), so purchases stay attached across sign-ins and cold starts.
 */
async function syncDurableUserIdForEmail(email: string): Promise<void> {
  if (!process.env["DATABASE_URL"]) return;
  const normalized = normalizeAccountEmail(email);
  const { resolveDurableUserIdForEmail } = await import("@/lib/billing/durable-state.server");
  const durableId = await resolveDurableUserIdForEmail(normalized, () =>
    createUserForEmail(normalized),
  );
  if (durableId) registerUserEmail(normalized, durableId);
}

function createSessionToken(): string {
  return createMagicLinkToken();
}

/**
 * Mint an ELCAMOSO session for a *verified* email identity.
 * Preserves existing userId / Stripe mapping via createUserForEmail.
 * Never call with an unverified client-supplied email.
 */
export function createSessionFromVerifiedEmail(
  email: string,
  now = Date.now(),
): VerifyMagicLinkResult {
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
  void persistSessionDurably(session);
  return {
    sessionToken: mintAccountSessionTicket(session),
    userId,
    email: normalized,
    expiresAt: session.expiresAt,
  };
}

/** @deprecated Prefer createSessionFromVerifiedEmail — same behaviour. */
function createSessionForEmail(email: string, now = Date.now()): VerifyMagicLinkResult {
  return createSessionFromVerifiedEmail(email, now);
}

export function getEmailOtpAvailability(): { available: boolean; resendCooldownSeconds: number } {
  return {
    available: isEmailOtpConfigured(),
    resendCooldownSeconds: Math.ceil(EMAIL_OTP_RESEND_COOLDOWN_MS / 1000),
  };
}

export interface RequestEmailOtpResult {
  ok: true;
  /** Generic message — does not disclose whether the account exists. */
  message: string;
  resendCooldownSeconds: number;
}

export interface VerifyEmailOtpResult extends VerifyMagicLinkResult {
  returnTo: string;
}

export async function requestEmailOtp(input: {
  email: string;
  returnTo?: string | undefined;
  clientKey?: string | null | undefined;
  now?: number | undefined;
}): Promise<RequestEmailOtpResult> {
  const now = input.now ?? Date.now();
  const normalized = normalizeAccountEmail(input.email);
  if (!isValidAccountEmail(normalized)) {
    throw new Error("Enter a valid email address");
  }
  if (!isEmailOtpConfigured()) {
    throw new Error("Email code sign-in is not configured on this server.");
  }

  const limited = assertEmailOtpSendAllowed({
    email: normalized,
    clientKey: input.clientKey,
    now,
  });
  if (!limited.ok) {
    throw new Error(
      `Please wait ${secondsRemaining(limited.retryAfterMs)}s before requesting another code.`,
    );
  }

  savePendingEmailOtp(normalized, input.returnTo ?? "/drive", now);

  try {
    await getEmailOtpProvider().sendOtp(normalized);
  } catch (error) {
    if (error instanceof EmailOtpProviderError && error.code === "misconfigured") {
      throw new Error("Email code sign-in is not configured on this server.");
    }
    // Same generic message for provider failures — avoid account-existence disclosure.
    throw new Error("Could not send a sign-in code. Try again later.");
  }

  // Never log the code. Always return a non-disclosing success message.
  return {
    ok: true,
    message: "If that email can receive mail, a six-digit sign-in code is on its way.",
    resendCooldownSeconds: Math.ceil(EMAIL_OTP_RESEND_COOLDOWN_MS / 1000),
  };
}

export async function verifyEmailOtp(input: {
  email: string;
  code: string;
  returnTo?: string | undefined;
  now?: number | undefined;
}): Promise<VerifyEmailOtpResult> {
  const now = input.now ?? Date.now();
  const normalized = normalizeAccountEmail(input.email);
  const code = input.code.replace(/\s+/g, "").trim();

  if (!isValidAccountEmail(normalized)) {
    throw new Error("Enter a valid email address");
  }
  if (!/^\d{6}$/.test(code)) {
    throw new Error("Enter the six-digit code from your email.");
  }
  if (!isEmailOtpConfigured()) {
    throw new Error("Email code sign-in is not configured on this server.");
  }

  const limited = assertEmailOtpVerifyAllowed({ email: normalized, now });
  if (!limited.ok) {
    throw new Error(
      `Too many attempts. Wait ${secondsRemaining(limited.retryAfterMs)}s and try again.`,
    );
  }

  try {
    const verified = await getEmailOtpProvider().verifyOtp(normalized, code);
    // Identity comes from the provider after verification — never from an unverified client claim alone.
    await syncDurableUserIdForEmail(verified.email);
    const session = createSessionFromVerifiedEmail(verified.email, now);
    clearEmailOtpVerifyFailures(normalized);
    const pending = readPendingEmailOtp(normalized, now);
    clearPendingEmailOtp(normalized);
    const returnTo = sanitizeReturnTo(pending?.returnTo ?? input.returnTo ?? "/drive");
    return { ...session, returnTo };
  } catch (error) {
    recordEmailOtpVerifyFailure(normalized, now);
    if (error instanceof EmailOtpProviderError && error.code === "invalid_or_expired") {
      throw new Error("That code is invalid or has expired.");
    }
    if (
      error instanceof Error &&
      /six-digit|valid email|not configured|Too many/i.test(error.message)
    ) {
      throw error;
    }
    throw new Error("That code is invalid or has expired.");
  }
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

export async function verifyAccountMagicLink(
  token: string,
  now = Date.now(),
): Promise<VerifyMagicLinkResult> {
  const pending = consumeMagicLink(token, now);
  if (!pending) throw new Error("Sign-in link expired or invalid");
  await syncDurableUserIdForEmail(pending.email);
  return createSessionForEmail(pending.email, now);
}

export function getGoogleSignInAvailability(): { available: boolean } {
  return { available: isGoogleOAuthConfigured() || readSupabaseAuthConfig() != null };
}

export function beginGoogleSignIn(returnTo: string, origin?: string): BeginGoogleSignInResult {
  // Fallback: Google via Supabase Auth (provider configured in the Supabase dashboard).
  if (!isGoogleOAuthConfigured() && readSupabaseAuthConfig() && origin) {
    const { state, codeChallenge, pending } = createGoogleOAuthState(sanitizeReturnTo(returnTo));
    pending.provider = "supabase";
    return {
      available: true,
      authorizeUrl: buildSupabaseGoogleAuthorizeUrl(origin, state, codeChallenge),
      pendingCookie: mintGoogleOAuthPendingCookie(pending),
    };
  }
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

  if (pending.provider === "supabase") {
    const email = await exchangeSupabasePkceCode(code, pending.codeVerifier);
    await syncDurableUserIdForEmail(email);
    return { ...createSessionForEmail(email, now), returnTo: pending.returnTo };
  }

  const tokens = await exchangeGoogleAuthorizationCode(code, pending.codeVerifier);
  // Google access/refresh tokens are discarded after ID token verification - never stored or returned.
  const idToken = tokens.id_token;
  if (!idToken) throw new Error("Google token response missing id_token.");
  const claims = await verifyExchangedGoogleIdToken(idToken, pending.nonce);
  await syncDurableUserIdForEmail(claims.email);
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
  if (session) {
    deleteAccountSession(session.token);
    void revokeSessionDurably(session.token);
  }
  deleteAccountSession(sessionToken);
}

export { sanitizeReturnTo } from "@/lib/account/return-to";

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
