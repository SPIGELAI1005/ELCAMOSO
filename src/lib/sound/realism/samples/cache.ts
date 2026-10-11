import type { HybridSampleCacheStats } from "@/lib/sound/realism/samples/types";

export interface CacheEntry {
  buffer: AudioBuffer;
  bytes: number;
  lastUsed: number;
}

/** Default ~48 MB of float PCM — enough for a few stereo loops, not a full portfolio. */
export const DEFAULT_SAMPLE_CACHE_MAX_BYTES = 48 * 1024 * 1024;

export function estimateAudioBufferBytes(buffer: AudioBuffer): number {
  return buffer.length * buffer.numberOfChannels * 4;
}

/**
 * Bounded decoded-buffer cache with approximate memory accounting and LRU eviction.
 */
export class BoundedDecodedBufferCache {
  private readonly map = new Map<string, CacheEntry>();
  private approxBytes = 0;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(private readonly maxBytes: number = DEFAULT_SAMPLE_CACHE_MAX_BYTES) {}

  get(id: string): AudioBuffer | null {
    const entry = this.map.get(id);
    if (!entry) {
      this.misses += 1;
      return null;
    }
    entry.lastUsed = performanceNow();
    this.hits += 1;
    return entry.buffer;
  }

  has(id: string): boolean {
    return this.map.has(id);
  }

  set(id: string, buffer: AudioBuffer): void {
    const bytes = estimateAudioBufferBytes(buffer);
    if (this.map.has(id)) {
      const prev = this.map.get(id)!;
      this.approxBytes -= prev.bytes;
      this.map.delete(id);
    }
    this.evictUntil(bytes);
    this.map.set(id, { buffer, bytes, lastUsed: performanceNow() });
    this.approxBytes += bytes;
  }

  delete(id: string): void {
    const entry = this.map.get(id);
    if (!entry) return;
    this.approxBytes -= entry.bytes;
    this.map.delete(id);
  }

  /** Keep only the listed ids; drop everything else (profile switch cleanup). */
  retainOnly(ids: Iterable<string>): number {
    const keep = new Set(ids);
    let removed = 0;
    for (const id of [...this.map.keys()]) {
      if (!keep.has(id)) {
        this.delete(id);
        removed += 1;
        this.evictions += 1;
      }
    }
    return removed;
  }

  clear(): void {
    this.map.clear();
    this.approxBytes = 0;
  }

  measure(): HybridSampleCacheStats {
    return {
      entryCount: this.map.size,
      approxBytes: this.approxBytes,
      maxBytes: this.maxBytes,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
    };
  }

  private evictUntil(needed: number): void {
    if (needed > this.maxBytes) {
      // Single asset larger than budget: still accept after clearing (caller may reject).
      this.clear();
      this.evictions += 1;
      return;
    }
    while (this.approxBytes + needed > this.maxBytes && this.map.size > 0) {
      let oldestId: string | null = null;
      let oldestTime = Number.POSITIVE_INFINITY;
      for (const [id, entry] of this.map) {
        if (entry.lastUsed < oldestTime) {
          oldestTime = entry.lastUsed;
          oldestId = id;
        }
      }
      if (!oldestId) break;
      this.delete(oldestId);
      this.evictions += 1;
    }
  }
}

function performanceNow(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

/** Shared process-wide cache for hybrid samples (per tab). */
let sharedCache: BoundedDecodedBufferCache | null = null;

export function getSharedSampleCache(
  maxBytes = DEFAULT_SAMPLE_CACHE_MAX_BYTES,
): BoundedDecodedBufferCache {
  if (!sharedCache) sharedCache = new BoundedDecodedBufferCache(maxBytes);
  return sharedCache;
}

/** Test helper — reset shared cache between suites. */
export function resetSharedSampleCacheForTests(): void {
  sharedCache = null;
}
