/**
 * Sample-bank schema for Realism V2 sample-assisted combustion.
 * Assets are optional — procedural fallback always works without them.
 */

export type SampleLoadRegion = "idle" | "low" | "medium" | "high" | "overrun";

export interface CombustionSampleEntry {
  /** Catalog / manifest asset id. */
  assetId: string;
  /** Personality or profile key this bank belongs to. */
  personalityId: string;
  /** Reference RPM of the recording. */
  rpmRef: number;
  load: SampleLoadRegion;
  /** Optional explicit loop points (samples). */
  loopStart?: number;
  loopEnd?: number;
  /** Peak-normalized gain trim 0..1. */
  gain?: number;
}

export interface CombustionSampleBank {
  personalityId: string;
  entries: CombustionSampleEntry[];
}

/** Useful playback-rate window before switching to a neighbor region. */
export const SAMPLE_RATE_MIN = 0.85;
export const SAMPLE_RATE_MAX = 1.18;

export function loadRegionFromDemand(demand: number, overrun: boolean): SampleLoadRegion {
  if (overrun) return "overrun";
  if (demand < 0.12) return "idle";
  if (demand < 0.35) return "low";
  if (demand < 0.65) return "medium";
  return "high";
}

/**
 * Pick nearest entries for crossfade at a given RPM/load.
 * Returns up to two neighbors for RPM blend within the same load family.
 */
export function selectSampleNeighbors(
  bank: CombustionSampleBank,
  rpm: number,
  load: SampleLoadRegion,
): { a: CombustionSampleEntry | null; b: CombustionSampleEntry | null; blend: number } {
  const pool = bank.entries
    .filter(
      (e) => e.load === load || (load !== "overrun" && e.load === "medium" && load === "high"),
    )
    .sort((x, y) => x.rpmRef - y.rpmRef);
  if (!pool.length) {
    const any = [...bank.entries].sort(
      (x, y) => Math.abs(x.rpmRef - rpm) - Math.abs(y.rpmRef - rpm),
    );
    return { a: any[0] ?? null, b: null, blend: 0 };
  }
  if (rpm <= pool[0]!.rpmRef) return { a: pool[0]!, b: null, blend: 0 };
  const last = pool[pool.length - 1]!;
  if (rpm >= last.rpmRef) return { a: last, b: null, blend: 0 };
  for (let i = 0; i < pool.length - 1; i += 1) {
    const lo = pool[i]!;
    const hi = pool[i + 1]!;
    if (rpm >= lo.rpmRef && rpm <= hi.rpmRef) {
      const span = Math.max(1, hi.rpmRef - lo.rpmRef);
      return { a: lo, b: hi, blend: (rpm - lo.rpmRef) / span };
    }
  }
  return { a: pool[0]!, b: null, blend: 0 };
}

export function playbackRateForRpm(rpm: number, rpmRef: number): number {
  const raw = rpm / Math.max(1, rpmRef);
  return Math.min(SAMPLE_RATE_MAX, Math.max(SAMPLE_RATE_MIN, raw));
}

/** Empty banks — ready for licensed assets via sound-assets catalog. */
export const EMPTY_COMBUSTION_SAMPLE_BANKS: Record<string, CombustionSampleBank> = {
  "gt-v8": { personalityId: "gt-v8", entries: [] },
  "american-v8": { personalityId: "american-v8", entries: [] },
  "flat-six-sport": { personalityId: "flat-six-sport", entries: [] },
  "turbo-inline-6": { personalityId: "turbo-inline-6", entries: [] },
};
