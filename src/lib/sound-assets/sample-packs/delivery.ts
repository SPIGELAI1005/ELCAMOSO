/**
 * Sample Pack Asset Delivery
 * Handles lazy loading of sample assets with caching and checksum verification.
 * Supports both WAV and AAC (m4a) formats with gapless loop handling.
 */

import type { SamplePackEntry, DeliveryFormat, DeliveryInfo } from "./types";
import { getLoadableEntries } from "./approval";

/**
 * Get the configured delivery format.
 * Reads from VITE_SAMPLE_PACK_FORMAT (default: m4a).
 */
export function getDeliveryFormat(): DeliveryFormat {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const format = import.meta.env["VITE_SAMPLE_PACK_FORMAT"];
    if (format === "wav" || format === "m4a") return format;
  }
  return "m4a";
}

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
 * Gapless loop point adjustment for AAC-encoded audio.
 * 
 * AAC encoders add 1024 samples of priming delay. The MP4 edit list can tell
 * decoders to skip it, but some don't. This function detects which case we're
 * in and adjusts loop points accordingly.
 * 
 * Loops are encoded with 2048 samples of padding on each side:
 * - Pre-roll: last 2048 samples of the loop body prepended
 * - Tail: first 2048 samples of the loop body appended
 * 
 * The manifest's loopStartSeconds/loopEndSeconds already include the 2048-sample
 * pre-roll offset. If the decoder didn't strip the encoder priming, we need to
 * add another 1024/48000 seconds.
 */
export interface GaplessAdjustment {
  /** Start offset in seconds (0 for WAV, adjusted for AAC if needed). */
  startOffsetSeconds: number;
  /** Loop start in seconds (manifest value, possibly adjusted for AAC). */
  loopStartSeconds: number;
  /** Loop end in seconds (computed from loopStart + sourceSamples/sampleRate). */
  loopEndSeconds: number;
  /** Whether encoder priming offset was applied. */
  primingAdjusted: boolean;
}

/**
 * Detect if the decoder applied the MP4 edit list (stripped encoder priming).
 * Per gaplessRule: if buffer.length >= decodedSamplesReference + encoderDelaySamples,
 * the decoder did NOT apply the MP4 edit list, so priming is present.
 */
export function detectEncoderPrimingPresent(
  buffer: AudioBuffer,
  delivery: DeliveryInfo,
): boolean {
  // decodedSamplesReference is the expected length when priming IS stripped
  // If buffer is ~1024 samples longer, priming wasn't stripped
  const threshold = delivery.decodedSamplesReference + delivery.encoderDelaySamples;
  return buffer.length >= threshold;
}

/**
 * Calculate gapless loop adjustment for an entry.
 * 
 * For WAV: returns the manifest values unchanged.
 * For AAC: checks if encoder priming needs to be added, computes correct loopEnd.
 */
export function calculateGaplessAdjustment(
  entry: SamplePackEntry,
  buffer: AudioBuffer,
): GaplessAdjustment {
  const delivery = entry.delivery;
  const sampleRate = entry.sampleRateHz || 48000;
  
  // WAV or no delivery info: use manifest values directly
  if (!delivery) {
    const loopStart =
      entry.kind === "loop" && "loopStartSeconds" in entry
        ? (entry.loopStartSeconds ?? 0)
        : 0;
    const loopEnd =
      entry.kind === "loop" && "loopEndSeconds" in entry
        ? (entry.loopEndSeconds ?? buffer.duration)
        : buffer.duration;
    
    return {
      startOffsetSeconds: 0,
      loopStartSeconds: loopStart,
      loopEndSeconds: loopEnd,
      primingAdjusted: false,
    };
  }
  
  // AAC: detect if priming needs adjustment
  const primingPresent = detectEncoderPrimingPresent(buffer, delivery);
  const primingOffsetSeconds = primingPresent
    ? delivery.encoderDelaySamples / sampleRate
    : 0;
  
  // Get manifest loop points
  let loopStart =
    entry.kind === "loop" && "loopStartSeconds" in entry
      ? (entry.loopStartSeconds ?? 0)
      : 0;
  
  // For one-shots, start is 0 unless priming adjustment needed
  const startOffset = entry.kind === "one-shot" ? primingOffsetSeconds : 0;
  
  // Adjust loop start if priming present
  if (primingPresent && entry.kind === "loop") {
    loopStart += primingOffsetSeconds;
  }
  
  // Calculate loopEnd from sourceSamples (never from buffer.duration)
  const loopDurationSeconds = delivery.sourceSamples / sampleRate;
  const loopEnd = loopStart + loopDurationSeconds;
  
  return {
    startOffsetSeconds: startOffset,
    loopStartSeconds: loopStart,
    loopEndSeconds: loopEnd,
    primingAdjusted: primingPresent,
  };
}

/**
 * Apply gapless adjustment to get final playback loop points.
 * Returns times in samples for Web Audio scheduling.
 */
export function getLoopPointsSamples(
  entry: SamplePackEntry,
  buffer: AudioBuffer,
): { loopStart: number; loopEnd: number; startOffset: number } {
  const adjustment = calculateGaplessAdjustment(entry, buffer);
  const sampleRate = buffer.sampleRate;
  
  return {
    loopStart: Math.round(adjustment.loopStartSeconds * sampleRate),
    loopEnd: Math.round(adjustment.loopEndSeconds * sampleRate),
    startOffset: Math.round(adjustment.startOffsetSeconds * sampleRate),
  };
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
  /** Gapless adjustment info (present for AAC assets). */
  gaplessAdjustment?: GaplessAdjustment | undefined;
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
      // Recalculate gapless adjustment from cached buffer
      const gaplessAdjustment = entry.delivery
        ? calculateGaplessAdjustment(entry, cached)
        : undefined;
      return {
        assetId: entry.assetId,
        buffer: cached,
        error: null,
        checksumValid: true,
        fromCache: true,
        loadTimeMs: performance.now() - startTime,
        gaplessAdjustment,
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
    
    // Calculate gapless adjustment for AAC assets
    const gaplessAdjustment = entry.delivery
      ? calculateGaplessAdjustment(entry, decoded)
      : undefined;
    
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
      gaplessAdjustment,
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
 * @param audioContext - Web Audio context for decoding.
 * @param profileId - Profile ID to load assets for.
 * @param options - Loading options including format selection.
 */
export async function loadProfileAssets(
  audioContext: BaseAudioContext,
  profileId: string,
  options: {
    signal?: AbortSignal | null;
    concurrency?: number;
    onProgress?: (loaded: number, total: number) => void;
    /** Delivery format - uses m4a manifests when available. */
    format?: DeliveryFormat;
  } = {},
): Promise<ProfileAssetsLoadResult> {
  const startTime = performance.now();
  const format = options.format ?? getDeliveryFormat();
  const entries = getLoadableEntries(profileId, format);
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
 * @param profileId - Profile ID to check.
 * @param format - Optional delivery format for manifest selection.
 */
export async function checkLocalAssets(
  profileId: string,
  format?: DeliveryFormat,
): Promise<{
  available: boolean;
  missing: string[];
  checked: number;
}> {
  const entries = getLoadableEntries(profileId, format ?? getDeliveryFormat());
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
