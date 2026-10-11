import { hashEmailForRateLimit } from "@/lib/account/email-otp-rate-limit";
import { sanitizeReturnTo } from "@/lib/account/return-to";

/** Pending OTP context (return path). Codes themselves are never stored or logged. */

export const EMAIL_OTP_PENDING_TTL_MS = 20 * 60 * 1000;

interface PendingEmailOtp {
  email: string;
  returnTo: string;
  expiresAt: number;
}

const pendingByEmail = new Map<string, PendingEmailOtp>();

export function resetEmailOtpPendingForTests(): void {
  pendingByEmail.clear();
}

export function savePendingEmailOtp(email: string, returnTo: string, now = Date.now()): void {
  const normalized = email.trim().toLowerCase();
  pendingByEmail.set(hashEmailForRateLimit(normalized), {
    email: normalized,
    returnTo: sanitizeReturnTo(returnTo),
    expiresAt: now + EMAIL_OTP_PENDING_TTL_MS,
  });
}

export function readPendingEmailOtp(email: string, now = Date.now()): PendingEmailOtp | null {
  const key = hashEmailForRateLimit(email.trim().toLowerCase());
  const pending = pendingByEmail.get(key);
  if (!pending) return null;
  if (pending.expiresAt <= now) {
    pendingByEmail.delete(key);
    return null;
  }
  return pending;
}

export function clearPendingEmailOtp(email: string): void {
  pendingByEmail.delete(hashEmailForRateLimit(email.trim().toLowerCase()));
}
