import { createServerFn } from "@tanstack/react-start";

import { readSupabaseAuthConfig } from "@/lib/account/supabase-config";

/**
 * Hands the browser the public Supabase URL + publishable (anon) key so it can join
 * a Realtime broadcast channel. Only public values; the service key is never sent.
 */
export const getPhoneSyncConfigFn = createServerFn({ method: "GET" }).handler(async () => {
  const cfg = readSupabaseAuthConfig();
  return cfg ? { ok: true as const, url: cfg.url, anonKey: cfg.anonKey } : { ok: false as const };
});
