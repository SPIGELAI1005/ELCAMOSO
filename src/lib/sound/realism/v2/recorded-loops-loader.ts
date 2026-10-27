import { fetchBytesWithRetry } from "@/lib/sound/fetch-bytes";
import type { RecordedLoopBank } from "./recorded-loops";

const cache = new Map<string, Promise<ArrayBuffer>>();

function fetchBytes(url: string): Promise<ArrayBuffer> {
  let p = cache.get(url);
  if (!p) {
    // No abort signal: the shared cache must survive a profile rebuild.
    p = fetchBytesWithRetry(url, "Recorded loop");
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

/** Fetch (same-origin, SW-cached) and decode a recorded loop bank. Missing loops are skipped. */
export async function loadRecordedLoopBuffers(
  ctx: BaseAudioContext,
  bank: RecordedLoopBank,
  signal?: AbortSignal,
): Promise<Map<string, AudioBuffer>> {
  const out = new Map<string, AudioBuffer>();
  await Promise.all(
    bank.sources.map(async (loop) => {
      try {
        const bytes = await fetchBytes(loop.url);
        if (signal?.aborted) return;
        // decodeAudioData detaches the buffer; decode a copy so the cache stays reusable.
        out.set(loop.id, await ctx.decodeAudioData(bytes.slice(0)));
      } catch (error) {
        console.warn("[elcamoso] recorded loop unavailable", loop.id, error);
      }
    }),
  );
  return out;
}
