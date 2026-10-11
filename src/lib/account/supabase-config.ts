/**
 * Supabase Auth configuration (env names only — never hardcode secrets).
 *
 * Server-only values:
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY (publishable / anon key for Auth OTP API)
 *
 * Optional feature gate:
 * - ELCAMOSO_EMAIL_OTP_ENABLED=1 forces enable when URL+key present (default: enable when both set)
 * - ELCAMOSO_EMAIL_OTP_ENABLED=0 disables even if credentials exist
 */

export interface SupabaseAuthConfig {
  url: string;
  anonKey: string;
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function readSupabaseAuthConfig(): SupabaseAuthConfig | null {
  const url = readEnv("SUPABASE_URL");
  const anonKey = readEnv("SUPABASE_ANON_KEY") ?? readEnv("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/**
 * Email OTP is available when Supabase is configured and not explicitly disabled.
 * First-time users may sign up (`shouldCreateUser: true`) — see EMAIL_OTP_SETUP.md.
 */
export function isEmailOtpConfigured(): boolean {
  const forced = readEnv("ELCAMOSO_EMAIL_OTP_ENABLED");
  if (forced === "0" || forced === "false") return false;
  return readSupabaseAuthConfig() != null;
}

/** Intentional product choice: first-time email OTP users may create an account. */
export const EMAIL_OTP_SHOULD_CREATE_USER = true as const;

/**
 * Documented provider OTP lifetime recommendation (seconds).
 * Actual expiry is configured in the Supabase project (Email OTP Expiration).
 * UI countdowns do not change backend expiry.
 */
export const EMAIL_OTP_PROVIDER_EXPIRY_SECONDS_RECOMMENDED = 600;
