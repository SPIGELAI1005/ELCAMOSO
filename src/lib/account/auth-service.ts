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
  sessionToken: string;
  userId: string;
  email: string;
  expiresAt: number;
}

function createSessionToken(): string {
  return createMagicLinkToken();
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

  const isDev = (process.env.ELCAMOSO_ENV ?? "development") === "development";
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

  const userId = createUserForEmail(pending.email);
  const sessionToken = createSessionToken();
  const session: AccountSession = {
    token: sessionToken,
    userId,
    email: pending.email,
    expiresAt: now + ACCOUNT_SESSION_TTL_MS,
    createdAt: now,
  };
  saveAccountSession(session);

  return {
    sessionToken,
    userId,
    email: pending.email,
    expiresAt: session.expiresAt,
  };
}

export function getAccountSession(sessionToken: string, now = Date.now()): AccountSession | null {
  if (!sessionToken.trim()) return null;
  return readAccountSession(sessionToken, now);
}

export function requireAccountSession(sessionToken: string, now = Date.now()): AccountSession {
  const session = getAccountSession(sessionToken, now);
  if (!session) throw new Error("Authentication required");
  return session;
}

export function signOutAccount(sessionToken: string): void {
  deleteAccountSession(sessionToken);
}

function sanitizeReturnTo(returnTo: string): string {
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) return "/drive";
  return returnTo;
}
