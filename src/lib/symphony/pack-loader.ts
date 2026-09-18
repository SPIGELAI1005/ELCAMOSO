/**
 * Symphony pack asset loader - lazy decode, preload, progress, Cache Storage.
 *
 * Does NOT register packs in the PWA service worker shell.
 * Procedural stems remain the always-available fallback.
 */

import type { SymphonyPack, SymphonyPackStemDef } from "./types";
import { getSymphonyPack } from "./experience-pack";
import { generateProceduralStemBuffer } from "./procedural-stems";
import { auditSymphonyAssets } from "./asset-manifest";

export interface PackLoadProgress {
  packId: string;
  loaded: number;
  total: number;
  failed: number;
  phase: "idle" | "loading" | "ready" | "degraded" | "failed";
}

export interface StemBufferMap {
  packId: string;
  version: string;
  buffers: Map<string, AudioBuffer>;
  /** True when at least one required WAV failed and procedural filled in. */
  degraded: boolean;
  errors: string[];
}

const memoryCache = new Map<string, StemBufferMap>();
const CACHE_NAME_PREFIX = "elcamoso-symphony-v";

function cacheKey(pack: SymphonyPack): string {
  return `${pack.id}@${pack.licensing.version}`;
}

function cacheStorageName(version: string): string {
  return `${CACHE_NAME_PREFIX}${version}`;
}

export function getCachedSymphonyBuffers(packId: string): StemBufferMap | null {
  for (const [key, value] of memoryCache) {
    if (key.startsWith(`${packId}@`)) return value;
  }
  return null;
}

export function clearSymphonyBufferCache() {
  memoryCache.clear();
}

async function fetchAndDecode(
  ctx: BaseAudioContext,
  path: string,
  packVersion: string,
): Promise<AudioBuffer> {
  if (typeof caches !== "undefined") {
    try {
      const cache = await caches.open(cacheStorageName(packVersion));
      const hit = await cache.match(path);
      if (hit) {
        const ab = await hit.arrayBuffer();
        return await ctx.decodeAudioData(ab.slice(0));
      }
    } catch {
      /* cache miss / unsupported */
    }
  }

  const res = await fetch(path, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType && !/audio|octet-stream|wav/i.test(contentType)) {
    throw new Error(`Unexpected MIME ${contentType}`);
  }
  const ab = await res.arrayBuffer();
  if (ab.byteLength > 12_000_000) throw new Error("Asset too large");

  if (typeof caches !== "undefined") {
    try {
      const cache = await caches.open(cacheStorageName(packVersion));
      await cache.put(
        path,
        new Response(ab.slice(0), { headers: { "content-type": "audio/wav" } }),
      );
      // Evict older symphony cache versions (keep current only)
      const keys = await caches.keys();
      for (const name of keys) {
        if (name.startsWith(CACHE_NAME_PREFIX) && name !== cacheStorageName(packVersion)) {
          await caches.delete(name);
        }
      }
    } catch {
      /* quota - ignore */
    }
  }

  return await ctx.decodeAudioData(ab.slice(0));
}

export type PackLoadListener = (progress: PackLoadProgress) => void;

/**
 * Load stem buffers for a pack. WAV paths decode when present; otherwise procedural.
 * Never throws for individual stem failures - marks degraded and fills procedural.
 */
export async function loadSymphonyPackBuffers(
  ctx: BaseAudioContext,
  packId: string,
  opts?: { onProgress?: PackLoadListener; signal?: AbortSignal },
): Promise<StemBufferMap> {
  const pack = getSymphonyPack(packId);
  if (!pack) {
    const failed: StemBufferMap = {
      packId,
      version: "0",
      buffers: new Map(),
      degraded: true,
      errors: ["unknown-pack"],
    };
    opts?.onProgress?.({
      packId,
      loaded: 0,
      total: 0,
      failed: 1,
      phase: "failed",
    });
    return failed;
  }

  if (import.meta.env.PROD) {
    const audit = auditSymphonyAssets(pack);
    if (!audit.productionReady) {
      const failed: StemBufferMap = {
        packId,
        version: pack.licensing.version,
        buffers: new Map(),
        degraded: true,
        errors: audit.errors.map((error) => `production-asset-gate:${error}`),
      };
      opts?.onProgress?.({
        packId,
        loaded: 0,
        total: pack.stems.length,
        failed: pack.stems.length,
        phase: "failed",
      });
      return failed;
    }
  }

  const key = cacheKey(pack);
  const hit = memoryCache.get(key);
  if (hit) {
    opts?.onProgress?.({
      packId,
      loaded: hit.buffers.size,
      total: pack.stems.length,
      failed: hit.errors.length,
      phase: hit.degraded ? "degraded" : "ready",
    });
    return hit;
  }

  const packResolved = pack;
  const total = packResolved.stems.length;
  let loaded = 0;
  let failed = 0;
  const errors: string[] = [];
  const buffers = new Map<string, AudioBuffer>();
  const clockConfig = {
    bpm: packResolved.bpm,
    beatsPerBar: packResolved.beatsPerBar,
    barsPerLoop: packResolved.barsPerLoop,
  };

  opts?.onProgress?.({ packId, loaded: 0, total, failed: 0, phase: "loading" });

  // Concurrency limit 3 - Tesla browser friendly
  const queue = [...packResolved.stems];
  async function worker() {
    while (queue.length) {
      if (opts?.signal?.aborted) return;
      const stem = queue.shift();
      if (!stem) return;
      const buffer = await loadOneStem(ctx, packResolved, stem, clockConfig, errors);
      buffers.set(stem.id, buffer);
      if (errors.some((e) => e.startsWith(`${stem.id}:`))) failed += 1;
      loaded += 1;
      opts?.onProgress?.({
        packId,
        loaded,
        total,
        failed,
        phase: "loading",
      });
    }
  }

  await Promise.all([worker(), worker(), worker()]);

  const result: StemBufferMap = {
    packId: packResolved.id,
    version: packResolved.licensing.version,
    buffers,
    degraded: failed > 0 || errors.length > 0,
    errors,
  };

  // Only cache successful-enough maps (always have buffers via procedural)
  if (buffers.size > 0) memoryCache.set(key, result);

  const phase =
    buffers.size === 0
      ? "failed"
      : result.degraded && packResolved.stems.some((s) => s.assetPath)
        ? "degraded"
        : "ready";
  opts?.onProgress?.({ packId, loaded, total, failed, phase });
  return result;
}

async function loadOneStem(
  ctx: BaseAudioContext,
  pack: SymphonyPack,
  stem: SymphonyPackStemDef,
  clockConfig: { bpm: number; beatsPerBar: number; barsPerLoop: number },
  errors: string[],
): Promise<AudioBuffer> {
  if (stem.assetPath) {
    try {
      return await fetchAndDecode(ctx, stem.assetPath, pack.licensing.version);
    } catch (err) {
      errors.push(`${stem.id}:${err instanceof Error ? err.message : "decode-failed"}`);
    }
  }
  // Procedural fallback - always available
  return generateProceduralStemBuffer(ctx, clockConfig, stem, hashSeed(pack.id + stem.id));
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** User-facing copy when music assets cannot load (Drive continues). */
export const SYMPHONY_LOAD_FAILURE_COPY = "Music couldn't load.";
