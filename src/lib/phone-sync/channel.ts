import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import { getPhoneSyncConfigFn } from "./supabase-fns";
import { channelNameForCode } from "./protocol";

let clientPromise: Promise<SupabaseClient | null> | null = null;

async function getClient(): Promise<SupabaseClient | null> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const cfg = await getPhoneSyncConfigFn();
      if (!cfg.ok) return null;
      const { createClient } = await import("@supabase/supabase-js");
      return createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        realtime: { params: { eventsPerSecond: 20 } },
      });
    })().catch(() => null);
  }
  return clientPromise;
}

export interface SyncChannel {
  send: (event: string, payload: unknown) => void;
  close: () => void;
}

/** Joins the ephemeral broadcast channel for a pair code (no DB, no presence storage). */
export async function openSyncChannel(
  code: string,
  handlers: Record<string, (payload: unknown) => void>,
  onStatus?: (status: string) => void,
): Promise<SyncChannel | null> {
  const client = await getClient();
  if (!client) return null;
  const ch: RealtimeChannel = client.channel(channelNameForCode(code), {
    config: { broadcast: { self: false, ack: false } },
  });
  for (const [event, fn] of Object.entries(handlers)) {
    ch.on("broadcast", { event }, (msg) => fn(msg["payload"]));
  }
  ch.subscribe((status) => onStatus?.(status));
  return {
    send: (event, payload) => void ch.send({ type: "broadcast", event, payload }),
    close: () => void client.removeChannel(ch),
  };
}
