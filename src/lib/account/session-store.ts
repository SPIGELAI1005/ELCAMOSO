import { createHash, randomBytes, randomUUID } from "node:crypto";

export interface AccountSession {
  token: string;
  userId: string;
  email: string;
  expiresAt: number;
  createdAt: number;
}

export interface PendingMagicLink {
  tokenHash: string;
  email: string;
  returnTo: string;
  expiresAt: number;
  consumedAt: number | null;
}

const sessions = new Map<string, AccountSession>();
const magicLinks = new Map<string, PendingMagicLink>();
const usersByEmail = new Map<string, string>();

export const ACCOUNT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createMagicLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

export function resetAccountAuthStoreForTests(): void {
  sessions.clear();
  magicLinks.clear();
  usersByEmail.clear();
}

export function registerUserEmail(email: string, userId: string): void {
  usersByEmail.set(email.toLowerCase(), userId);
}

export function resolveUserIdForEmail(email: string): string | null {
  return usersByEmail.get(email.toLowerCase()) ?? null;
}

export function createUserForEmail(email: string): string {
  const normalized = email.toLowerCase();
  const existing = usersByEmail.get(normalized);
  if (existing) return existing;
  const userId = randomUUID();
  usersByEmail.set(normalized, userId);
  return userId;
}

export function saveMagicLink(link: PendingMagicLink): void {
  magicLinks.set(link.tokenHash, link);
}

export function consumeMagicLink(token: string, now = Date.now()): PendingMagicLink | null {
  const hash = hashToken(token);
  const link = magicLinks.get(hash);
  if (!link || link.consumedAt != null || link.expiresAt <= now) return null;
  link.consumedAt = now;
  magicLinks.set(hash, link);
  return link;
}

export function saveAccountSession(session: AccountSession): void {
  sessions.set(hashToken(session.token), session);
}

export function readAccountSession(token: string, now = Date.now()): AccountSession | null {
  const session = sessions.get(hashToken(token));
  if (!session) return null;
  if (session.expiresAt <= now) {
    sessions.delete(hashToken(token));
    return null;
  }
  return session;
}

export function deleteAccountSession(token: string): void {
  sessions.delete(hashToken(token));
}
