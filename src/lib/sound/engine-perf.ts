import type { HybridPerfOptions } from "@/lib/sound/realism/v2";

/**
 * Engine sounds tuned for car browsers (Tesla) after glitch reports on 11 Nov 2026.
 * Only these primaries (and the layers mixed under them) get the cheaper graph; every
 * other engine keeps building exactly as before.
 */
export const PERF_TUNED_ENGINE_PROFILE_IDS: ReadonlySet<string> = new Set([
  "american-muscle-v8",
  "racing-v10",
  "f1-v10",
]);

/** Grain look-ahead on low-power devices: rides out ~0.6 s main-thread stalls. */
export const LOW_POWER_GRAIN_LOOKAHEAD_S = 0.6;

const LITE_STORAGE_KEY = "elcamoso.audioLite";

type LiteOverride = "on" | "off" | null;

function readLiteOverride(): LiteOverride {
  const forced = (globalThis as { __ELC_AUDIO_LITE?: unknown }).__ELC_AUDIO_LITE;
  if (forced === true) return "on";
  if (forced === false) return "off";
  try {
    if (typeof location !== "undefined") {
      const q = new URLSearchParams(location.search).get("audioLite");
      if (q === "1") return "on";
      if (q === "0") return "off";
    }
    if (typeof localStorage !== "undefined") {
      const v = localStorage.getItem(LITE_STORAGE_KEY);
      if (v === "1") return "on";
      if (v === "0") return "off";
    }
  } catch {
    /* storage / location unavailable */
  }
  return null;
}

/** Tesla's in-car browser identifies itself with a "Tesla/<version>" token. */
export function isTeslaUserAgent(ua: string | null | undefined): boolean {
  return typeof ua === "string" && /\bTesla\/\S+/i.test(ua);
}

export interface LowPowerSignals {
  userAgent?: string | null | undefined;
  hardwareConcurrency?: number | null | undefined;
  deviceMemory?: number | null | undefined;
}

/** Pure decision (tests): Tesla browser, ≤4 logical cores, or ≤4 GB device memory. */
export function isLowPowerFromSignals(signals: LowPowerSignals): boolean {
  if (isTeslaUserAgent(signals.userAgent)) return true;
  const cores = signals.hardwareConcurrency;
  if (typeof cores === "number" && cores > 0 && cores <= 4) return true;
  const mem = signals.deviceMemory;
  if (typeof mem === "number" && mem > 0 && mem <= 4) return true;
  return false;
}

/**
 * Low-power audio path for this device. Offline renders (lab / tests) stay full quality
 * unless forced with `globalThis.__ELC_AUDIO_LITE = true`, `?audioLite=1`, or
 * localStorage `elcamoso.audioLite = "1"` ("0" forces it off).
 */
export function isLowPowerAudioDevice(ctx?: BaseAudioContext | null): boolean {
  const override = readLiteOverride();
  if (override) return override === "on";
  if (ctx && typeof OfflineAudioContext !== "undefined" && ctx instanceof OfflineAudioContext) {
    return false;
  }
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  return isLowPowerFromSignals({
    userAgent: nav.userAgent,
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
  });
}

/**
 * Perf options for a hybrid synth. `primaryId` is the profile whose sound is playing
 * (the layer's host for a secondary layer). Returns null for untouched profiles.
 */
export function hybridPerfOptionsFor(
  primaryId: string | null | undefined,
  ctx: BaseAudioContext | null | undefined,
  role: "primary" | "layer" = "primary",
): HybridPerfOptions | null {
  if (!primaryId || !PERF_TUNED_ENGINE_PROFILE_IDS.has(primaryId)) return null;
  const lowPower = isLowPowerAudioDevice(ctx);
  return {
    kRateFilters: true,
    layerLite: role === "layer",
    lowPower,
    ...(lowPower ? { grainLookaheadS: LOW_POWER_GRAIN_LOOKAHEAD_S } : {}),
  };
}

/* ------------------------------------------------------------ start-up robustness */

/** How long start() waits for AudioContext.resume() before building anyway. */
export const START_RESUME_TIMEOUT_MS = 1500;
/** How long start() waits for the combustion worklet module before using the fallback. */
export const WORKLET_START_TIMEOUT_MS = 5000;
/** Minimum gap between automatic resume() retries while suspended unexpectedly. */
export const RESUME_RETRY_INTERVAL_MS = 1000;

/** Resolves with the promise's value, or null once `ms` passes first. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), Math.max(0, ms));
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/** resume() that never hangs the caller: true when the context is running afterwards. */
export async function resumeWithTimeout(
  ctx: Pick<AudioContext, "resume" | "state">,
  ms: number,
): Promise<boolean> {
  try {
    await withTimeout(ctx.resume(), ms);
  } catch {
    /* rejected (not allowed yet / closed) */
  }
  return ctx.state === "running";
}
