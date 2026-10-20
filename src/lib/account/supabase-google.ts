/**
 * Google sign-in through Supabase Auth (PKCE). Used when no direct GOOGLE_CLIENT_ID is set
 * but SUPABASE_URL + SUPABASE_ANON_KEY are. Server-only: only the publishable key is used,
 * Supabase tokens are discarded after we read the verified email.
 */
import { readSupabaseAuthConfig } from "@/lib/account/supabase-config";

export const SUPABASE_GOOGLE_CALLBACK_PATH = "/auth/account/google/callback";

export function buildSupabaseGoogleAuthorizeUrl(
  origin: string,
  state: string,
  codeChallenge: string,
): string {
  const config = readSupabaseAuthConfig();
  if (!config) throw new Error("Google sign-in is not configured on this server.");
  const redirect = new URL(SUPABASE_GOOGLE_CALLBACK_PATH, origin);
  redirect.searchParams.set("state", state);
  const params = new URLSearchParams({
    provider: "google",
    redirect_to: redirect.toString(),
    code_challenge: codeChallenge,
    code_challenge_method: "s256",
  });
  return `${config.url.replace(/\/+$/, "")}/auth/v1/authorize?${params.toString()}`;
}

/** Exchange the Supabase auth code; returns the verified email. */
export async function exchangeSupabasePkceCode(code: string, codeVerifier: string): Promise<string> {
  const config = readSupabaseAuthConfig();
  if (!config) throw new Error("Google sign-in is not configured on this server.");
  const res = await fetch(`${config.url.replace(/\/+$/, "")}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: { apikey: config.anonKey, "content-type": "application/json" },
    body: JSON.stringify({ auth_code: code, code_verifier: codeVerifier }),
  });
  if (!res.ok) throw new Error(`Supabase token exchange failed (${res.status})`);
  const body = (await res.json()) as {
    user?: { email?: string; email_confirmed_at?: string | null; app_metadata?: { provider?: string } };
  };
  const email = body.user?.email?.trim();
  if (!email) throw new Error("Supabase token response missing email");
  if (!body.user?.email_confirmed_at && body.user?.app_metadata?.provider !== "google") {
    throw new Error("Supabase email not verified");
  }
  return email;
}
