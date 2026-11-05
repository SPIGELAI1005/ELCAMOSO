import { fetchBytesWithRetry } from "@/lib/sound/fetch-bytes";
import { BACKFIRE_BUFFER_ID, type RecordedLoopBank } from "./recorded-loops";

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
  const items = bank.backfire
    ? [...bank.sources, { id: BACKFIRE_BUFFER_ID, url: bank.backfire.url }]
    : bank.sources;
  // Several sources often cut regions from one file (Ge-Squared: five loads, one 106 s file).
  // Decode each file once and share the AudioBuffer: decoding it per source cost ~100 MB of
  // decoded audio and five parallel decodes on drive start, too much for a car browser.
  const byUrl = new Map<string, string[]>();
  for (const loop of items) byUrl.set(loop.url, [...(byUrl.get(loop.url) ?? []), loop.id]);
  await Promise.all(
    [...byUrl].map(async ([url, ids]) => {
      try {
        const bytes = await fetchBytes(url);
        if (signal?.aborted) return;
        // decodeAudioData detaches the buffer; decode a copy so the cache stays reusable.
        const buffer = await ctx.decodeAudioData(bytes.slice(0));
        for (const id of ids) out.set(id, buffer);
      } catch (error) {
        console.warn("[elcamoso] recorded loop unavailable", ids.join(","), error);
      }
    }),
  );
  return out;
}
