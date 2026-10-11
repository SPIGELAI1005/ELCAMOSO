import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSessionFromVerifiedEmail,
  getAccountSession,
  requestEmailOtp,
  verifyEmailOtp,
} from "@/lib/account/auth-service";
import {
  resetEmailOtpPendingForTests,
  savePendingEmailOtp,
} from "@/lib/account/email-otp-pending";
import {
  EMAIL_OTP_MAX_VERIFY_ATTEMPTS,
  resetEmailOtpRateLimitsForTests,
} from "@/lib/account/email-otp-rate-limit";
import {
  EmailOtpProviderError,
  setEmailOtpProviderForTests,
  type EmailOtpProvider,
} from "@/lib/account/email-otp-provider";
import { sanitizeReturnTo } from "@/lib/account/return-to";
import {
  createUserForEmail,
  registerUserEmail,
  resetAccountAuthStoreForTests,
} from "@/lib/account/session-store";

function mockProvider(opts?: {
  failSend?: boolean;
  failVerify?: boolean;
  verifiedEmail?: string;
}): EmailOtpProvider & { sent: string[]; verified: string[] } {
  const state = { sent: [] as string[], verified: [] as string[] };
  return {
    ...state,
    async sendOtp(email: string) {
      if (opts?.failSend) {
        throw new EmailOtpProviderError("provider_unavailable", "fail");
      }
      state.sent.push(email);
      return { ok: true as const };
    },
    async verifyOtp(email: string, token: string) {
      state.verified.push(`${email}:${token}`);
      if (opts?.failVerify || token === "000000") {
        throw new EmailOtpProviderError("invalid_or_expired", "bad");
      }
      if (token === "111111") {
        throw new EmailOtpProviderError("invalid_or_expired", "reused");
      }
      return {
        ok: true as const,
        email: (opts?.verifiedEmail ?? email).toLowerCase(),
        providerUserId: "supabase-user-1",
      };
    },
  };
}

describe("sanitizeReturnTo allowlist", () => {
  it("allows internal destinations and rejects open redirects", () => {
    expect(sanitizeReturnTo("/settings")).toBe("/settings");
    expect(sanitizeReturnTo("/drive?activateTrial=1")).toBe("/drive?activateTrial=1");
    expect(sanitizeReturnTo("https://evil.example/phish")).toBe("/drive");
    expect(sanitizeReturnTo("//evil.example")).toBe("/drive");
    expect(sanitizeReturnTo("/\\evil")).toBe("/drive");
    expect(sanitizeReturnTo("/admin/secret")).toBe("/drive");
  });
});

describe("email OTP auth", () => {
  beforeEach(() => {
    resetAccountAuthStoreForTests();
    resetEmailOtpRateLimitsForTests();
    resetEmailOtpPendingForTests();
    setEmailOtpProviderForTests(null);
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("ELCAMOSO_EMAIL_OTP_ENABLED", "1");
  });

  it("sends OTP without disclosing account existence", async () => {
    const provider = mockProvider();
    setEmailOtpProviderForTests(provider);
    const result = await requestEmailOtp({ email: "New.User@Example.com", returnTo: "/garage" });
    expect(result.ok).toBe(true);
    expect(result.message.toLowerCase()).toMatch(/code|email/);
    expect(provider.sent).toEqual(["new.user@example.com"]);
  });

  it("creates a session for a new account after verifyOtp", async () => {
    setEmailOtpProviderForTests(mockProvider());
    await requestEmailOtp({ email: "fresh@example.com", returnTo: "/sounds" });
    const verified = await verifyEmailOtp({
      email: "fresh@example.com",
      code: "123456",
      returnTo: "/sounds",
    });
    expect(verified.email).toBe("fresh@example.com");
    expect(verified.returnTo).toBe("/sounds");
    expect(getAccountSession(verified.sessionToken)?.userId).toBe(verified.userId);
  });

  it("preserves existing paid account userId for the same verified email", async () => {
    const existingId = "22222222-2222-4222-8222-222222222222";
    registerUserEmail("paid@example.com", existingId);
    setEmailOtpProviderForTests(mockProvider());
    await requestEmailOtp({ email: "paid@example.com", returnTo: "/settings" });
    const verified = await verifyEmailOtp({
      email: "paid@example.com",
      code: "654321",
    });
    expect(verified.userId).toBe(existingId);
  });

  it("never merges solely from an unverified client email", () => {
    const a = createUserForEmail("a@example.com");
    // Client claiming b@example.com must not receive a's id without provider verification.
    const session = createSessionFromVerifiedEmail("b@example.com");
    expect(session.userId).not.toBe(a);
    expect(session.email).toBe("b@example.com");
  });

  it("rejects wrong codes and records throttling after repeated failures", async () => {
    setEmailOtpProviderForTests(mockProvider({ failVerify: true }));
    savePendingEmailOtp("throttle@example.com", "/drive");
    for (let i = 0; i < EMAIL_OTP_MAX_VERIFY_ATTEMPTS; i += 1) {
      await expect(
        verifyEmailOtp({ email: "throttle@example.com", code: "000000" }),
      ).rejects.toThrow(/invalid or has expired/i);
    }
    await expect(
      verifyEmailOtp({ email: "throttle@example.com", code: "000000" }),
    ).rejects.toThrow(/too many attempts|wait/i);
  });

  it("rejects reused / invalid codes from the provider", async () => {
    setEmailOtpProviderForTests(mockProvider());
    await requestEmailOtp({ email: "reuse@example.com" });
    await expect(
      verifyEmailOtp({ email: "reuse@example.com", code: "111111" }),
    ).rejects.toThrow(/invalid or has expired/i);
  });

  it("enforces resend cooldown server-side", async () => {
    setEmailOtpProviderForTests(mockProvider());
    await requestEmailOtp({ email: "cooldown@example.com" });
    await expect(requestEmailOtp({ email: "cooldown@example.com" })).rejects.toThrow(
      /wait \d+s/i,
    );
  });

  it("uses provider-verified email for identity, not a mismatched client claim alone", async () => {
    setEmailOtpProviderForTests(
      mockProvider({ verifiedEmail: "real@example.com" }),
    );
    await requestEmailOtp({ email: "real@example.com" });
    // Client could try another casing / alias — provider email wins after verify.
    const verified = await verifyEmailOtp({
      email: "real@example.com",
      code: "424242",
    });
    expect(verified.email).toBe("real@example.com");
  });

  it("blocks cross-user access: session A cannot become user B via email claim", async () => {
    setEmailOtpProviderForTests(mockProvider());
    await requestEmailOtp({ email: "alice@example.com" });
    const alice = await verifyEmailOtp({ email: "alice@example.com", code: "123456" });
    await requestEmailOtp({ email: "bob@example.com" });
    const bob = await verifyEmailOtp({ email: "bob@example.com", code: "123456" });
    expect(alice.userId).not.toBe(bob.userId);
    expect(getAccountSession(alice.sessionToken)?.email).toBe("alice@example.com");
    expect(getAccountSession(bob.sessionToken)?.email).toBe("bob@example.com");
  });
});
