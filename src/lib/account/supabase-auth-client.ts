import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { readSupabaseAuthConfig } from "@/lib/account/supabase-config";

/**
 * Server-side Supabase Auth client for email OTP.
 * Do not import from React client components — call only via createServerFn handlers.
 */
export function createSupabaseAuthClient(): SupabaseClient | null {
  const config = readSupabaseAuthConfig();
  if (!config) return null;
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
