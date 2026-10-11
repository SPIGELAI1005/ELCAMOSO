/**
 * Email OTP provider boundary.
 * Production uses Supabase Auth; tests inject a mock — mocks do not prove delivery.
 */

export interface EmailOtpSendResult {
  ok: true;
}

export interface EmailOtpVerifyResult {
  ok: true;
  /** Verified email from the provider (never trust client-supplied email alone). */
  email: string;
  /** Provider subject id when available — not used as ELCAMOSO userId. */
  providerUserId: string | null;
}

export interface EmailOtpProvider {
  sendOtp(email: string): Promise<EmailOtpSendResult>;
  verifyOtp(email: string, token: string): Promise<EmailOtpVerifyResult>;
}

export class EmailOtpProviderError extends Error {
  readonly code: "invalid_or_expired" | "provider_unavailable" | "misconfigured";

  constructor(code: EmailOtpProviderError["code"], message: string) {
    super(message);
    this.name = "EmailOtpProviderError";
    this.code = code;
  }
}

let injected: EmailOtpProvider | null = null;

export function setEmailOtpProviderForTests(provider: EmailOtpProvider | null): void {
  injected = provider;
}

export function getEmailOtpProvider(): EmailOtpProvider {
  if (injected) return injected;
  return createSupabaseEmailOtpProvider();
}

function createSupabaseEmailOtpProvider(): EmailOtpProvider {
  return {
    async sendOtp(email: string) {
      const { createSupabaseAuthClient } = await import("@/lib/account/supabase-auth-client");
      const { EMAIL_OTP_SHOULD_CREATE_USER } = await import("@/lib/account/supabase-config");
      const client = createSupabaseAuthClient();
      if (!client) {
        throw new EmailOtpProviderError("misconfigured", "Email sign-in is not configured.");
      }
      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          // Intentional: first-time users may create an ELCAMOSO account via email OTP.
          shouldCreateUser: EMAIL_OTP_SHOULD_CREATE_USER,
          // Code entry works in the car while email is read on the phone — no redirect dependency.
        },
      });
      if (error) {
        // Do not surface account-existence distinctions from the provider.
        const status = (error as { status?: number }).status;
        if (status === 429) {
          throw new EmailOtpProviderError("provider_unavailable", "Too many requests. Try again later.");
        }
        throw new EmailOtpProviderError(
          "provider_unavailable",
          "Could not send a sign-in code. Try again later.",
        );
      }
      return { ok: true as const };
    },

    async verifyOtp(email: string, token: string) {
      const { createSupabaseAuthClient } = await import("@/lib/account/supabase-auth-client");
      const client = createSupabaseAuthClient();
      if (!client) {
        throw new EmailOtpProviderError("misconfigured", "Email sign-in is not configured.");
      }
      const { data, error } = await client.auth.verifyOtp({
        email,
        token,
        type: "email",
      });
      if (error || !data.user?.email) {
        throw new EmailOtpProviderError(
          "invalid_or_expired",
          "That code is invalid or has expired.",
        );
      }
      // Discard Supabase session tokens — ELCAMOSO issues its own HttpOnly cookie session.
      try {
        await client.auth.signOut({ scope: "local" });
      } catch {
        /* best-effort cleanup */
      }
      return {
        ok: true as const,
        email: data.user.email.toLowerCase(),
        providerUserId: data.user.id ?? null,
      };
    },
  };
}
