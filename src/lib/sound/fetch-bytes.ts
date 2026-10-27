/**
 * Fetch an audio file with a few retries so one network blip at drive start (tunnel, weak LTE)
 * does not leave the session on the synth-only fallback for its whole length.
 * Same-origin sample files are normally served from the service-worker cache.
 */
const RETRY_DELAYS_MS = [400, 1200, 2800];

export async function fetchBytesWithRetry(
  url: string,
  label: string,
  retryDelaysMs: readonly number[] = RETRY_DELAYS_MS,
): Promise<ArrayBuffer> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${label} ${url} failed (${res.status})`);
      return await res.arrayBuffer();
    } catch (error) {
      lastError = error;
      const delay = retryDelaysMs[attempt];
      if (delay === undefined) break;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${label} ${url} failed`);
}
