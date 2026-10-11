import { createHash } from "node:crypto";

/** Server-side abuse controls — a disabled resend button alone is insufficient. */

export const EMAIL_OTP_RESEND_COOLDOWN_MS = 60_000;
export const EMAIL_OTP_SEND_WINDOW_MS = 60 * 60 * 1000;
export const EMAIL_OTP_MAX_SENDS_PER_WINDOW = 5;
export const EMAIL_OTP_VERIFY_WINDOW_MS = 15 * 60 * 1000;
export const EMAIL_OTP_MAX_VERIFY_ATTEMPTS = 8;

interface SendBucket {
  timestamps: number[];
  lastSentAt: number;
}

interface VerifyBucket {
  failures: number[];
  lockedUntil: number;
}

const sendByEmail = new Map<string, SendBucket>();
const sendByIp = new Map<string, SendBucket>();
const verifyByEmail = new Map<string, VerifyBucket>();

export function resetEmailOtpRateLimitsForTests(): void {
  sendByEmail.clear();
  sendByIp.clear();
  verifyByEmail.clear();
}

export function hashEmailForRateLimit(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32);
}

function prune(timestamps: number[], now: number, windowMs: number): number[] {
  return timestamps.filter((t) => now - t < windowMs);
}

function touchSend(
  map: Map<string, SendBucket>,
  key: string,
  now: number,
): { allowed: boolean; retryAfterMs: number } {
  const bucket = map.get(key) ?? { timestamps: [], lastSentAt: 0 };
  bucket.timestamps = prune(bucket.timestamps, now, EMAIL_OTP_SEND_WINDOW_MS);

  const sinceLast = now - bucket.lastSentAt;
  if (bucket.lastSentAt > 0 && sinceLast < EMAIL_OTP_RESEND_COOLDOWN_MS) {
    return { allowed: false, retryAfterMs: EMAIL_OTP_RESEND_COOLDOWN_MS - sinceLast };
  }
  if (bucket.timestamps.length >= EMAIL_OTP_MAX_SENDS_PER_WINDOW) {
    const oldest = bucket.timestamps[0] ?? now;
    return { allowed: false, retryAfterMs: Math.max(1000, EMAIL_OTP_SEND_WINDOW_MS - (now - oldest)) };
  }

  bucket.timestamps.push(now);
  bucket.lastSentAt = now;
  map.set(key, bucket);
  return { allowed: true, retryAfterMs: 0 };
}

export function assertEmailOtpSendAllowed(input: {
  email: string;
  clientKey?: string | null | undefined;
  now?: number | undefined;
}): { ok: true } | { ok: false; retryAfterMs: number; code: "rate_limited" } {
  const now = input.now ?? Date.now();
  const emailKey = hashEmailForRateLimit(input.email);
  const emailResult = touchSend(sendByEmail, emailKey, now);
  if (!emailResult.allowed) {
    return { ok: false, retryAfterMs: emailResult.retryAfterMs, code: "rate_limited" };
  }
  const ip = input.clientKey?.trim();
  if (ip) {
    const ipResult = touchSend(sendByIp, `ip:${ip}`, now);
    if (!ipResult.allowed) {
      // Roll back email stamp so a shared IP cannot burn the email budget forever.
      const bucket = sendByEmail.get(emailKey);
      if (bucket) {
        bucket.timestamps.pop();
        bucket.lastSentAt = bucket.timestamps[bucket.timestamps.length - 1] ?? 0;
        sendByEmail.set(emailKey, bucket);
      }
      return { ok: false, retryAfterMs: ipResult.retryAfterMs, code: "rate_limited" };
    }
  }
  return { ok: true };
}

export function assertEmailOtpVerifyAllowed(input: {
  email: string;
  now?: number;
}): { ok: true } | { ok: false; retryAfterMs: number; code: "rate_limited" } {
  const now = input.now ?? Date.now();
  const key = hashEmailForRateLimit(input.email);
  const bucket = verifyByEmail.get(key) ?? { failures: [], lockedUntil: 0 };
  if (bucket.lockedUntil > now) {
    return { ok: false, retryAfterMs: bucket.lockedUntil - now, code: "rate_limited" };
  }
  bucket.failures = prune(bucket.failures, now, EMAIL_OTP_VERIFY_WINDOW_MS);
  if (bucket.failures.length >= EMAIL_OTP_MAX_VERIFY_ATTEMPTS) {
    bucket.lockedUntil = now + EMAIL_OTP_RESEND_COOLDOWN_MS;
    verifyByEmail.set(key, bucket);
    return { ok: false, retryAfterMs: EMAIL_OTP_RESEND_COOLDOWN_MS, code: "rate_limited" };
  }
  verifyByEmail.set(key, bucket);
  return { ok: true };
}

export function recordEmailOtpVerifyFailure(email: string, now = Date.now()): void {
  const key = hashEmailForRateLimit(email);
  const bucket = verifyByEmail.get(key) ?? { failures: [], lockedUntil: 0 };
  bucket.failures = prune(bucket.failures, now, EMAIL_OTP_VERIFY_WINDOW_MS);
  bucket.failures.push(now);
  if (bucket.failures.length >= EMAIL_OTP_MAX_VERIFY_ATTEMPTS) {
    bucket.lockedUntil = now + EMAIL_OTP_RESEND_COOLDOWN_MS;
  }
  verifyByEmail.set(key, bucket);
}

export function clearEmailOtpVerifyFailures(email: string): void {
  verifyByEmail.delete(hashEmailForRateLimit(email));
}

export function secondsRemaining(retryAfterMs: number): number {
  return Math.max(1, Math.ceil(retryAfterMs / 1000));
}
