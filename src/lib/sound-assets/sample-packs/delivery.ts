/**
 * Sample Pack Asset Delivery
 * Handles lazy loading of sample assets with caching and checksum verification.
 */

import type { SamplePackEntry } from "./types";
import { filterApprovedEntries, getLoadableEntries } from "./approval";
import { getProfileManifest } from "./catalog";

/**
 * Asset base URL configuration.
 * Reads from environment variable or falls back to local dev folder.
 */
export function getAssetBaseUrl(): string {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const envUrl = import.meta.env["VITE_SAMPLE_PACK_BASE_URL"];
    if (envUrl) return envUrl.replace(/\/$/, "");
  }
  
  // Dev fallback: local assets folder
  return "/sample-packs";
}

/**
 * Build full URL for an asset.
 */
export function buildAssetUrl(assetPath: string): string {
  const base = getAssetBaseUrl();
  return `${base}/${assetPath}`;
}

/**
 * Verify SHA-256 checksum of a buffer.
 */
export async function verifyChecksum(
  buffer: ArrayBuffer,
  expectedSha256: string,
): Promise<boolean> {
  if (!expectedSha256) return true;
  
  try {
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return hashHex === expectedSha256.toLowerCase();
  } catch {
    console.warn("Checksum verification failed, allowing asset");
    return true;
  }
}

/**
 * Asset load result.
 */
export interface AssetLoadResult {
  assetId: string;
  buffer: AudioBuffer | null;
  error: string | null;
  checksumValid: boolean;
  fromCache: boolean;
  loadTimeMs: number;
}

/**
 * Profile assets load result.
 */
export interface ProfileAssetsLoadResult {
  profileId: string;
  loaded: AssetLoadResult[];
  failed: AssetLoadResult[];
  totalTimeMs: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * In-memory decoded buffer cache.
 */
const decodedBufferCache = new Map<string, AudioBuffer>();
const pendingLoads = new Map<string, Promise<ArrayBuffer | null>>();

/**
 * Get a cached decoded buffer.
 */
export function getCachedBuffer(assetId: string): AudioBuffer | undefined {
  return decodedBufferCache.get(assetId);
}

/**
 * Set a cached decoded buffer.
 */
export function setCachedBuffer(assetId: string, buffer: AudioBuffer): void {
  decodedBufferCache.set(assetId, buffer);
}

/**
 * Clear the decoded buffer cache.
 */
export function clearBufferCache(): void {
  decodedBufferCache.clear();
}

/**
 * Get cache statistics.
 */
export function getCacheStats(): {
  entryCount: number;
  totalDurationSeconds: number;
} {
  let totalDuration = 0;
  for (const buffer of decodedBufferCache.values()) {
    totalDuration += buffer.duration;
  }
  return {
    entryCount: decodedBufferCache.size,
    totalDurationSeconds: totalDuration,
  };
}

/**
 * Load a single asset with checksum verification.
 */
export async function loadAsset(
  audioContext: BaseAudioContext,
  entry: SamplePackEntry,
  options: {
    signal?: AbortSignal | null;
    skipCache?: boolean;
    skipChecksum?: boolean;
  } = {},
): Promise<AssetLoadResult> {
  const startTime = performance.now();
  
  // Check cache first
  if (!options.skipCache) {
    const cached = getCachedBuffer(entry.assetId);
    if (cached) {
      return {
        assetId: entry.assetId,
        buffer: cached,
        error: null,
        checksumValid: true,
        fromCache: true,
        loadTimeMs: performance.now() - startTime,
      };
    }
  }
  
  try {
    const url = buildAssetUrl(entry.assetPath);
    
    // Dedupe concurrent fetches for the same asset
    let fetchPromise = pendingLoads.get(entry.assetId);
    if (!fetchPromise) {
      fetchPromise = (async () => {
        const response = await fetch(url, {
          mode: "cors",
          credentials: "omit",
          ...(options.signal ? { signal: options.signal } : {}),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.arrayBuffer();
      })();
      pendingLoads.set(entry.assetId, fetchPromise);
    }
    
    const arrayBuffer = await fetchPromise;
    pendingLoads.delete(entry.assetId);
    
    if (!arrayBuffer) {
      return {
        assetId: entry.assetId,
        buffer: null,
        error: "Empty response",
        checksumValid: false,
        fromCache: false,
        loadTimeMs: performance.now() - startTime,
      };
    }
    
    // Verify checksum
    let checksumValid = true;
    if (!options.skipChecksum && entry.checksumSha256) {
      checksumValid = await verifyChecksum(arrayBuffer, entry.checksumSha256);
      if (!checksumValid) {
        return {
          assetId: entry.assetId,
          buffer: null,
          error: "Checksum mismatch",
          checksumValid: false,
          fromCache: false,
          loadTimeMs: performance.now() - startTime,
        };
      }
    }
    
    // Decode audio
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    
    // Cache the decoded buffer
    if (!options.skipCache) {
      setCachedBuffer(entry.assetId, decoded);
    }
    
    return {
      assetId: entry.assetId,
      buffer: decoded,
      error: null,
      checksumValid,
      fromCache: false,
      loadTimeMs: performance.now() - startTime,
    };
  } catch (error) {
    pendingLoads.delete(entry.assetId);
    const message = error instanceof Error ? error.message : String(error);
    
    return {
      assetId: entry.assetId,
      buffer: null,
      error: message,
      checksumValid: false,
      fromCache: false,
      loadTimeMs: performance.now() - startTime,
    };
  }
}

/**
 * Load all assets for a profile with concurrent loading.
 */
export async function loadProfileAssets(
  audioContext: BaseAudioContext,
  profileId: string,
  options: {
    signal?: AbortSignal | null;
    concurrency?: number;
    onProgress?: (loaded: number, total: number) => void;
  } = {},
): Promise<ProfileAssetsLoadResult> {
  const startTime = performance.now();
  const entries = getLoadableEntries(profileId);
  const concurrency = Math.max(1, options.concurrency ?? 4);
  
  const results: AssetLoadResult[] = [];
  let index = 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  
  const worker = async () => {
    while (index < entries.length) {
      if (options.signal?.aborted) break;
      
      const currentIndex = index;
      index += 1;
      const entry = entries[currentIndex]!;
      
      const result = await loadAsset(audioContext, entry, { signal: options.signal ?? null });
      results.push(result);
      
      if (result.fromCache) {
        cacheHits += 1;
      } else {
        cacheMisses += 1;
      }
      
      options.onProgress?.(results.length, entries.length);
    }
  };
  
  await Promise.all(
    Array.from({ length: Math.min(concurrency, entries.length) }, worker),
  );
  
  const loaded = results.filter((r) => r.buffer !== null);
  const failed = results.filter((r) => r.buffer === null);
  
  return {
    profileId,
    loaded,
    failed,
    totalTimeMs: performance.now() - startTime,
    cacheHits,
    cacheMisses,
  };
}

/**
 * Preload entries for faster playback.
 */
export async function preloadEntries(
  audioContext: BaseAudioContext,
  entries: SamplePackEntry[],
  options: {
    signal?: AbortSignal | null;
    concurrency?: number;
  } = {},
): Promise<Map<string, AudioBuffer>> {
  const buffers = new Map<string, AudioBuffer>();
  const concurrency = Math.max(1, options.concurrency ?? 4);
  
  let index = 0;
  
  const worker = async () => {
    while (index < entries.length) {
      if (options.signal?.aborted) break;
      
      const currentIndex = index;
      index += 1;
      const entry = entries[currentIndex]!;
      
      const result = await loadAsset(audioContext, entry, { signal: options.signal ?? null });
      if (result.buffer) {
        buffers.set(entry.assetId, result.buffer);
      }
    }
  };
  
  await Promise.all(
    Array.from({ length: Math.min(concurrency, entries.length) }, worker),
  );
  
  return buffers;
}

/**
 * Check if assets are available locally (dev mode).
 */
export async function checkLocalAssets(profileId: string): Promise<{
  available: boolean;
  missing: string[];
  checked: number;
}> {
  const entries = getLoadableEntries(profileId);
  const missing: string[] = [];
  
  for (const entry of entries.slice(0, 5)) {
    try {
      const url = buildAssetUrl(entry.assetPath);
      const response = await fetch(url, { method: "HEAD", mode: "cors" });
      if (!response.ok) {
        missing.push(entry.assetPath);
      }
    } catch {
      missing.push(entry.assetPath);
    }
  }
  
  return {
    available: missing.length === 0,
    missing,
    checked: Math.min(5, entries.length),
  };
}
