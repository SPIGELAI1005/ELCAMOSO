import type { SoundAssetManifest } from "@/lib/sound-assets/types";
import {
  BoundedDecodedBufferCache,
  getSharedSampleCache,
} from "@/lib/sound/realism/samples/cache";
import type { HybridSampleCacheStats } from "@/lib/sound/realism/samples/types";

export type HybridSampleLoadFailureReason =
  | "aborted"
  | "network"
  | "cors"
  | "http"
  | "decode"
  | "codec"
  | "empty"
  | "stale"
  | "channels";

export interface HybridSampleLoadResult {
  buffers: Map<string, AudioBuffer>;
  failures: { assetId: string; reason: HybridSampleLoadFailureReason; detail?: string }[];
  generation: number;
  stale: boolean;
  cache: HybridSampleCacheStats;
}

export interface HybridSampleLoaderOptions {
  cache?: BoundedDecodedBufferCache;
  /** Max concurrent fetches. */
  concurrency?: number;
}

/**
 * Loads only requested signed assets into a bounded decoded-buffer cache.
 * Generation tokens ignore stale completions after rapid profile changes.
 */
export class HybridSampleLoader {
  private generation = 0;
  private readonly cache: BoundedDecodedBufferCache;
  private readonly concurrency: number;

  constructor(options: HybridSampleLoaderOptions = {}) {
    this.cache = options.cache ?? getSharedSampleCache();
    this.concurrency = Math.max(1, options.concurrency ?? 3);
  }

  /** Bump generation so in-flight loads become stale. */
  invalidate(): number {
    this.generation += 1;
    return this.generation;
  }

  currentGeneration(): number {
    return this.generation;
  }

  measureCache(): HybridSampleCacheStats {
    return this.cache.measure();
  }

  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Preload the active selection. Does not invent assets — empty manifests yield empty maps.
   * Never lets an older generation replace a newer selection.
   */
  async loadManifestAssets(
    audioContext: BaseAudioContext,
    manifest: SoundAssetManifest,
    options: {
      signal?: AbortSignal;
      /** When set, only these asset ids are fetched (active/favourites). */
      onlyIds?: readonly string[];
      generation?: number;
    } = {},
  ): Promise<HybridSampleLoadResult> {
    const generation = options.generation ?? this.invalidate();
    const failures: HybridSampleLoadResult["failures"] = [];
    const buffers = new Map<string, AudioBuffer>();

    if (options.signal?.aborted) {
      return {
        buffers,
        failures: [{ assetId: "*", reason: "aborted" }],
        generation,
        stale: true,
        cache: this.cache.measure(),
      };
    }

    if (manifest.deliveryMode === "procedural_only" || manifest.assets.length === 0) {
      return {
        buffers,
        failures: [{ assetId: "*", reason: "empty", detail: "procedural_only or no assets" }],
        generation,
        stale: generation !== this.generation,
        cache: this.cache.measure(),
      };
    }

    const wanted = manifest.assets.filter((asset) =>
      options.onlyIds ? options.onlyIds.includes(asset.id) : true,
    );

    // Serve cache hits first.
    const pending = wanted.filter((asset) => {
      const hit = this.cache.get(asset.id);
      if (hit) {
        buffers.set(asset.id, hit);
        return false;
      }
      return true;
    });

    await runPool(pending, this.concurrency, async (asset) => {
      if (options.signal?.aborted || generation !== this.generation) return;
      try {
        const response = await fetch(asset.url, {
          mode: "cors",
          credentials: "omit",
          ...(options.signal ? { signal: options.signal } : {}),
        });
        if (!response.ok) {
          failures.push({
            assetId: asset.id,
            reason: "http",
            detail: `status ${response.status}`,
          });
          return;
        }
        const arrayBuffer = await response.arrayBuffer();
        if (options.signal?.aborted || generation !== this.generation) return;
        let decoded: AudioBuffer;
        try {
          decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        } catch (error) {
          const detail = error instanceof Error ? error.message : "decodeAudioData failed";
          failures.push({
            assetId: asset.id,
            reason: /codec|unsupported|encoding/i.test(detail) ? "codec" : "decode",
            detail,
          });
          return;
        }
        if (decoded.numberOfChannels < 1 || decoded.numberOfChannels > 2) {
          failures.push({
            assetId: asset.id,
            reason: "channels",
            detail: `unsupported channel count ${decoded.numberOfChannels}`,
          });
          return;
        }
        if (generation !== this.generation) {
          failures.push({ assetId: asset.id, reason: "stale" });
          return;
        }
        this.cache.set(asset.id, decoded);
        buffers.set(asset.id, decoded);
      } catch (error) {
        if (options.signal?.aborted) {
          failures.push({ assetId: asset.id, reason: "aborted" });
          return;
        }
        const detail = error instanceof Error ? error.message : String(error);
        const reason: HybridSampleLoadFailureReason = /cors|cross-origin|NetworkError/i.test(detail)
          ? "cors"
          : "network";
        failures.push({ assetId: asset.id, reason, detail });
      }
    });

    const stale = generation !== this.generation;
    if (stale) {
      // Do not hand stale buffers to the caller as authoritative.
      return {
        buffers: new Map(),
        failures: [...failures, { assetId: "*", reason: "stale" }],
        generation,
        stale: true,
        cache: this.cache.measure(),
      };
    }

    return {
      buffers,
      failures,
      generation,
      stale: false,
      cache: this.cache.measure(),
    };
  }
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index]!;
      index += 1;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

let sharedLoader: HybridSampleLoader | null = null;

export function getSharedSampleLoader(): HybridSampleLoader {
  if (!sharedLoader) sharedLoader = new HybridSampleLoader();
  return sharedLoader;
}

export function resetSharedSampleLoaderForTests(): void {
  sharedLoader = null;
}
