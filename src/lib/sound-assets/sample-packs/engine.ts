/**
 * Per-Profile Sample Engine
 * Builds sample banks from manifest entries for both combustion and non-combustion profiles.
 * Integrates with the existing sample-bank.ts interfaces.
 */

import type {
  CombustionSampleBank,
  CombustionSampleEntry,
  SampleLoadRegion,
} from "@/lib/sound/realism/v2/sample-bank";
import type {
  CombustionLoopEntry,
  NonCombustionLoopEntry,
  SamplePackEntry,
  TransientEntry,
} from "./types";
import {
  isCombustionLoop,
  isNonCombustionLoop,
  isTransient,
} from "./types";
import { getLoadableEntries, filterApprovedEntries } from "./approval";
import { isCombustionProfile, getProfileManifest } from "./catalog";

/**
 * Speed-keyed loop entry for non-combustion profiles.
 */
export interface SpeedKeyedLoopEntry {
  assetId: string;
  profileId: string;
  speedKmh: number;
  demand: number;
  state: "idle" | "cruise" | "pull" | "ambient";
  loopSeconds: { start: number; end: number };
  gain: number;
  gait?: "walk" | "trot" | "canter" | "gallop" | undefined;
  surface?: string | undefined;
  bpm?: number | undefined;
}

/**
 * Speed-keyed sample bank for non-combustion profiles.
 */
export interface SpeedKeyedSampleBank {
  profileId: string;
  entries: SpeedKeyedLoopEntry[];
}

/**
 * Transient variant pool entry.
 */
export interface TransientPoolEntry {
  assetId: string;
  profileId: string;
  transientKind: string;
  gain: number;
  /** RPM context for combustion transients. */
  rpmFrom?: number | undefined;
  rpmTo?: number | undefined;
  rpmPeak?: number | undefined;
  /** Variant index for round-robin selection. */
  variantIndex: number;
}

/**
 * Transient scheduler pools by kind.
 */
export interface TransientSchedulerPools {
  profileId: string;
  pools: Map<string, TransientPoolEntry[]>;
}

/**
 * Convert manifest load anchor to SampleLoadRegion.
 */
function loadRegionFromManifest(
  regime: string,
  loadAnchor: number,
  sourceRpm: number,
): SampleLoadRegion {
  if (regime === "idle") return "idle";
  if (regime === "reverse") return "idle";
  if (regime.startsWith("overrun")) return "overrun";
  if (regime.startsWith("off-load")) return "off-load";
  
  // On-load regions based on load anchor
  if (loadAnchor < 0.35) return "low";
  if (loadAnchor < 0.65) return "medium";
  return "high";
}

/**
 * Convert dB trim to linear gain.
 */
function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

/**
 * Build a CombustionSampleBank from manifest entries.
 * This integrates with the existing v2/sample-bank.ts interface.
 */
export function buildCombustionSampleBank(
  profileId: string,
  entries?: SamplePackEntry[],
): CombustionSampleBank {
  const manifestEntries = entries ?? getLoadableEntries(profileId);
  const loops = manifestEntries.filter(isCombustionLoop);
  
  if (loops.length === 0) {
    return { personalityId: profileId, entries: [] };
  }
  
  // Check for mixed perspectives
  const perspectives = new Set(loops.map((e) => e.micPerspective));
  if (perspectives.size > 1 && !perspectives.has("unknown")) {
    console.warn(`Mixed mic perspectives in ${profileId} sample bank`);
  }
  
  const bankEntries: CombustionSampleEntry[] = loops
    .filter((entry) => entry.sourceRpm !== undefined) // Only include loops with valid sourceRpm
    .map((entry) => {
      const base = {
        assetId: entry.assetId,
        personalityId: profileId,
        rpmRef: entry.sourceRpm!,
        load: loadRegionFromManifest(entry.regime, entry.loadAnchor, entry.sourceRpm ?? 0),
        loadAnchor: entry.loadAnchor,
        character: entry.regime.startsWith("on-load")
          ? "on-load" as const
          : entry.regime.startsWith("off-load")
            ? "off-load" as const
            : entry.regime.startsWith("overrun")
              ? "overrun" as const
              : "idle" as const,
        loopSeconds: { start: entry.loopStartSeconds, end: entry.loopEndSeconds },
        gain: dbToGain(entry.gainTrimDb),
      };
      if (entry.permittedPlaybackRate) {
        return { ...base, permittedPlaybackRate: entry.permittedPlaybackRate };
      }
      return base;
    });
  
  return {
    personalityId: profileId,
    entries: bankEntries,
  };
}

/**
 * Build a SpeedKeyedSampleBank from manifest entries.
 * For non-combustion profiles that use speed/demand keying.
 */
export function buildSpeedKeyedSampleBank(
  profileId: string,
  entries?: SamplePackEntry[],
): SpeedKeyedSampleBank {
  const manifestEntries = entries ?? getLoadableEntries(profileId);
  const loops = manifestEntries.filter(isNonCombustionLoop);
  
  if (loops.length === 0) {
    return { profileId, entries: [] };
  }
  
  const bankEntries: SpeedKeyedLoopEntry[] = loops.map((entry) => ({
    assetId: entry.assetId,
    profileId,
    speedKmh: entry.speedKmh ?? 0,
    demand: entry.demand ?? 0.5,
    state: entry.state ?? "cruise",
    loopSeconds: { start: entry.loopStartSeconds, end: entry.loopEndSeconds },
    gain: dbToGain(entry.gainTrimDb),
    gait: entry.gait,
    surface: entry.surface,
    bpm: entry.bpm,
  }));
  
  return {
    profileId,
    entries: bankEntries,
  };
}

/**
 * Build transient scheduler pools from manifest entries.
 */
export function buildTransientPools(
  profileId: string,
  entries?: SamplePackEntry[],
): TransientSchedulerPools {
  const manifestEntries = entries ?? getLoadableEntries(profileId);
  const transients = manifestEntries.filter(isTransient);
  
  const pools = new Map<string, TransientPoolEntry[]>();
  
  for (const entry of transients) {
    const kind = entry.transientKind;
    if (!pools.has(kind)) {
      pools.set(kind, []);
    }
    
    const pool = pools.get(kind)!;
    pool.push({
      assetId: entry.assetId,
      profileId,
      transientKind: kind,
      gain: dbToGain(entry.gainTrimDb),
      rpmFrom: entry.rpmFrom,
      rpmTo: entry.rpmTo,
      rpmPeak: entry.rpmPeak,
      variantIndex: pool.length,
    });
  }
  
  return { profileId, pools };
}

/**
 * Unified sample bank that works for both combustion and non-combustion profiles.
 */
export interface UnifiedSampleBank {
  profileId: string;
  type: "combustion" | "speed-keyed" | "empty";
  combustion: CombustionSampleBank | null;
  speedKeyed: SpeedKeyedSampleBank | null;
  transients: TransientSchedulerPools;
  entryCount: number;
  loopCount: number;
  transientCount: number;
}

/**
 * Build a unified sample bank for any profile.
 */
export function buildUnifiedSampleBank(profileId: string): UnifiedSampleBank {
  const entries = getLoadableEntries(profileId);
  const loops = entries.filter((e) => e.kind === "loop");
  const transients = entries.filter((e) => e.kind === "one-shot");
  
  const transientPools = buildTransientPools(profileId, entries);
  
  if (isCombustionProfile(profileId)) {
    const combustion = buildCombustionSampleBank(profileId, entries);
    return {
      profileId,
      type: combustion.entries.length > 0 ? "combustion" : "empty",
      combustion,
      speedKeyed: null,
      transients: transientPools,
      entryCount: entries.length,
      loopCount: loops.length,
      transientCount: transients.length,
    };
  }
  
  const speedKeyed = buildSpeedKeyedSampleBank(profileId, entries);
  return {
    profileId,
    type: speedKeyed.entries.length > 0 ? "speed-keyed" : "empty",
    combustion: null,
    speedKeyed,
    transients: transientPools,
    entryCount: entries.length,
    loopCount: loops.length,
    transientCount: transients.length,
  };
}

/**
 * Speed-keyed loop selection for crossfading.
 */
export interface SpeedKeyedLoopSelection {
  a: SpeedKeyedLoopEntry | null;
  b: SpeedKeyedLoopEntry | null;
  blend: number;
  playbackRate: number;
}

/**
 * Select loops for crossfade at a given speed/demand.
 */
export function selectSpeedKeyedLoops(
  bank: SpeedKeyedSampleBank,
  speedKmh: number,
  demand: number,
): SpeedKeyedLoopSelection {
  if (bank.entries.length === 0) {
    return { a: null, b: null, blend: 0, playbackRate: 1 };
  }
  
  // Filter by demand state
  const state = demand < 0.2 ? "idle" : demand > 0.7 ? "pull" : "cruise";
  let pool = bank.entries.filter((e) => e.state === state);
  if (pool.length === 0) pool = bank.entries;
  
  // Sort by speed
  pool = [...pool].sort((a, b) => a.speedKmh - b.speedKmh);
  
  if (speedKmh <= pool[0]!.speedKmh) {
    return { a: pool[0]!, b: null, blend: 0, playbackRate: 1 };
  }
  
  const last = pool[pool.length - 1]!;
  if (speedKmh >= last.speedKmh) {
    return { a: last, b: null, blend: 0, playbackRate: 1 };
  }
  
  // Find crossfade pair
  for (let i = 0; i < pool.length - 1; i += 1) {
    const lo = pool[i]!;
    const hi = pool[i + 1]!;
    if (speedKmh >= lo.speedKmh && speedKmh <= hi.speedKmh) {
      const span = Math.max(1, hi.speedKmh - lo.speedKmh);
      const blend = (speedKmh - lo.speedKmh) / span;
      return { a: lo, b: hi, blend, playbackRate: 1 };
    }
  }
  
  return { a: pool[0]!, b: null, blend: 0, playbackRate: 1 };
}

/**
 * Select a transient variant from a pool using round-robin.
 */
export function selectTransientVariant(
  pools: TransientSchedulerPools,
  kind: string,
  lastIndex: Map<string, number>,
): TransientPoolEntry | null {
  const pool = pools.pools.get(kind);
  if (!pool || pool.length === 0) return null;
  
  const lastUsed = lastIndex.get(kind) ?? -1;
  const nextIndex = (lastUsed + 1) % pool.length;
  lastIndex.set(kind, nextIndex);
  
  return pool[nextIndex] ?? null;
}

/**
 * Get all transient kinds available for a profile.
 */
export function getAvailableTransientKinds(profileId: string): string[] {
  const pools = buildTransientPools(profileId);
  return [...pools.pools.keys()];
}

/**
 * Sample engine diagnostics for a profile.
 */
export interface SampleEngineDiagnostics {
  profileId: string;
  bankType: "combustion" | "speed-keyed" | "empty";
  loopCount: number;
  transientKinds: string[];
  transientVariantCounts: Record<string, number>;
  hasApprovedEntries: boolean;
  hasLoadableEntries: boolean;
  manifestStatus: string;
}

/**
 * Get diagnostics for a profile's sample engine.
 */
export function getSampleEngineDiagnostics(profileId: string): SampleEngineDiagnostics {
  const manifest = getProfileManifest(profileId);
  const bank = buildUnifiedSampleBank(profileId);
  const transientCounts: Record<string, number> = {};
  
  for (const [kind, pool] of bank.transients.pools) {
    transientCounts[kind] = pool.length;
  }
  
  return {
    profileId,
    bankType: bank.type,
    loopCount: bank.loopCount,
    transientKinds: [...bank.transients.pools.keys()],
    transientVariantCounts: transientCounts,
    hasApprovedEntries: bank.entryCount > 0,
    hasLoadableEntries: bank.entryCount > 0,
    manifestStatus: manifest?.status ?? "unknown",
  };
}
