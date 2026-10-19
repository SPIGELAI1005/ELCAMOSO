/**
 * Sample-bank schema for Realism V2 sample-assisted combustion.
 * Assets are optional - procedural fallback always works without them.
 */
import { applyEqualPowerShape } from "@/lib/sound/realism/samples/blend";
import type { HybridSampleBlendMode } from "@/lib/sound/realism/samples/types";
import {
  AMERICAN_V8_PILOT_MANIFEST,
  isPilotEntryApproved,
} from "@/lib/sound/realism/v2/american-v8-pilot-manifest";

export type SampleLoadRegion = "idle" | "low" | "medium" | "high" | "off-load" | "overrun";

export interface CombustionSampleEntry {
  /** Catalog / manifest asset id. */
  assetId: string;
  /** Personality or profile key this bank belongs to. */
  personalityId: string;
  /** Reference RPM of the recording. */
  rpmRef: number;
  load: SampleLoadRegion;
  character?: "idle" | "on-load" | "off-load" | "overrun";
  /** Optional explicit loop points (samples). */
  loopStart?: number;
  loopEnd?: number;
  /** Peak-normalized gain trim 0..1. */
  gain?: number;
  /** Explicit coverage window; outside it the procedural renderer takes over. */
  permittedPlaybackRate?: { min: number; max: number };
  /** 0..1 anchor used to interpolate adjacent load recordings. */
  loadAnchor?: number;
  /** Linear-amplitude overlap correction derived during asset preparation. */
  overlapGain?: number;
  /** Loop points in seconds. Preferred over legacy sample-index points. */
  loopSeconds?: { start: number; end: number };
}

export interface CombustionSampleBank {
  personalityId: string;
  entries: CombustionSampleEntry[];
}

function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

export function buildAmericanV8PilotBank(): CombustionSampleBank {
  const approved = AMERICAN_V8_PILOT_MANIFEST.filter(isPilotEntryApproved);
  const perspectives = new Set(approved.map((entry) => entry.recordingPerspective));
  // A mixed-perspective bank is rejected until an explicit normalization plan exists.
  if (perspectives.size > 1) return { personalityId: "american-v8", entries: [] };
  return {
    personalityId: "american-v8",
    entries: approved.map((entry) => ({
      assetId: entry.id,
      personalityId: "american-v8",
      rpmRef: entry.rpmAnchor,
      load:
        entry.loadState === "idle"
          ? "idle"
          : entry.loadState === "overrun"
            ? "overrun"
            : entry.loadState === "off-load"
              ? "off-load"
            : entry.loadAnchor < 0.35
              ? "low"
              : entry.loadAnchor < 0.65
                ? "medium"
                : "high",
      loadAnchor: entry.loadAnchor,
      character:
        entry.loadState === "on-load"
          ? "on-load"
          : entry.loadState === "off-load"
            ? "off-load"
            : entry.loadState,
      loopSeconds: { start: entry.loop.startSeconds, end: entry.loop.endSeconds },
      gain: dbToGain(entry.trimDb),
      overlapGain: dbToGain(entry.overlapTrimDb),
      permittedPlaybackRate: entry.permittedPlaybackRate,
    })),
  };
}

/** Useful playback-rate window before switching to a neighbor region. */
export const SAMPLE_RATE_MIN = 0.85;
export const SAMPLE_RATE_MAX = 1.18;

export function loadRegionFromDemand(
  demand: number,
  overrun: boolean,
  rpm = 0,
): SampleLoadRegion {
  if (overrun) return "overrun";
  if (demand < 0.12 && rpm > 1100) return "off-load";
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

export function playbackRateWithinCoverage(
  entry: CombustionSampleEntry,
  rpm: number,
): number | null {
  const rate = rpm / Math.max(1, entry.rpmRef);
  const permitted = entry.permittedPlaybackRate ?? { min: SAMPLE_RATE_MIN, max: SAMPLE_RATE_MAX };
  return rate >= permitted.min && rate <= permitted.max ? rate : null;
}

export interface SampleMixTarget {
  entry: CombustionSampleEntry;
  /** Linear-amplitude weight. The sum never exceeds one for correlated material. */
  weight: number;
  playbackRate: number;
}

export interface SampleMixSelection {
  targets: SampleMixTarget[];
  fallbackReason: "none" | "no-load-bank" | "rate-out-of-range";
}

function requestedLoadAnchor(load: SampleLoadRegion, demand: number): number {
  if (load === "idle" || load === "off-load" || load === "overrun") return 0;
  if (load === "low") return Math.min(0.34, Math.max(0.12, demand));
  if (load === "medium") return Math.min(0.64, Math.max(0.35, demand));
  return Math.min(1, Math.max(0.65, demand));
}

/**
 * Select up to four adjacent RPM/load anchors.
 * Default linear-amplitude weights; equal-power is optional and does not guarantee
 * absence of comb filtering for correlated loops.
 */
export function selectSampleMix(
  bank: CombustionSampleBank,
  rpm: number,
  load: SampleLoadRegion,
  demand: number,
  blendMode: HybridSampleBlendMode = "linear",
): SampleMixSelection {
  const requestedCharacter =
    load === "idle" ? "idle" : load === "off-load" ? "off-load" : load === "overrun" ? "overrun" : "on-load";
  const sameState = bank.entries.filter((entry) => {
    const character = entry.character ??
      (entry.load === "idle" ? "idle" : entry.load === "off-load" ? "off-load" : entry.load === "overrun" ? "overrun" : "on-load");
    return character === requestedCharacter;
  });
  if (!sameState.length) return { targets: [], fallbackReason: "no-load-bank" };

  const wantedLoad = requestedLoadAnchor(load, demand);
  const loadAnchors = [...new Set(sameState.map((e) => e.loadAnchor ?? wantedLoad))].sort(
    (a, b) => a - b,
  );
  const lowerLoad = [...loadAnchors].reverse().find((anchor) => anchor <= wantedLoad) ?? loadAnchors[0]!;
  const upperLoad = loadAnchors.find((anchor) => anchor >= wantedLoad) ?? loadAnchors.at(-1)!;
  const loadSpan = Math.max(0.0001, upperLoad - lowerLoad);
  const upperLoadWeight = lowerLoad === upperLoad ? 0 : (wantedLoad - lowerLoad) / loadSpan;
  const chosenLoads = lowerLoad === upperLoad
    ? [{ anchor: lowerLoad, weight: 1 }]
    : [
        { anchor: lowerLoad, weight: 1 - upperLoadWeight },
        { anchor: upperLoad, weight: upperLoadWeight },
      ];

  const targets: SampleMixTarget[] = [];
  let hadRateMiss = false;
  for (const loadChoice of chosenLoads) {
    const row = sameState
      .filter((entry) => (entry.loadAnchor ?? wantedLoad) === loadChoice.anchor)
      .sort((a, b) => a.rpmRef - b.rpmRef);
    const covered = row
      .map((entry) => ({ entry, rate: playbackRateWithinCoverage(entry, rpm) }))
      .filter((candidate): candidate is { entry: CombustionSampleEntry; rate: number } => candidate.rate != null);
    if (!covered.length) {
      hadRateMiss = true;
      continue;
    }
    const below = [...covered].reverse().find((c) => c.entry.rpmRef <= rpm) ?? covered[0]!;
    const above = covered.find((c) => c.entry.rpmRef >= rpm) ?? covered.at(-1)!;
    if (below.entry.assetId === above.entry.assetId) {
      targets.push({ entry: below.entry, playbackRate: below.rate, weight: loadChoice.weight });
      continue;
    }
    const span = Math.max(1, above.entry.rpmRef - below.entry.rpmRef);
    const hiWeight = Math.min(1, Math.max(0, (rpm - below.entry.rpmRef) / span));
    targets.push(
      { entry: below.entry, playbackRate: below.rate, weight: loadChoice.weight * (1 - hiWeight) },
      { entry: above.entry, playbackRate: above.rate, weight: loadChoice.weight * hiWeight },
    );
  }
  const total = targets.reduce((sum, target) => sum + target.weight, 0);
  if (total <= 0) {
    return { targets: [], fallbackReason: hadRateMiss ? "rate-out-of-range" : "no-load-bank" };
  }
  let normalized = targets.map((target) => ({
    ...target,
    weight: target.weight / Math.max(1, total),
  }));
  if (blendMode === "equal-power") {
    const shaped = applyEqualPowerShape(normalized.map((t) => t.weight));
    normalized = normalized.map((target, i) => ({ ...target, weight: shaped[i] ?? 0 }));
  }
  return {
    targets: normalized,
    fallbackReason: "none",
  };
}

/** Empty banks - ready for licensed assets via sound-assets catalog. */
export const EMPTY_COMBUSTION_SAMPLE_BANKS: Record<string, CombustionSampleBank> = {
  "gt-v8": { personalityId: "gt-v8", entries: [] },
  "american-v8": buildAmericanV8PilotBank(),
  "flat-six-sport": { personalityId: "flat-six-sport", entries: [] },
  "high-rev-v10": { personalityId: "high-rev-v10", entries: [] },
  "f1-v10": { personalityId: "f1-v10", entries: [] },
  "flat-plane-v8-track": { personalityId: "flat-plane-v8-track", entries: [] },
  "rally-turbo-3": { personalityId: "rally-turbo-3", entries: [] },
  "turbo-inline-6": { personalityId: "turbo-inline-6", entries: [] },
  "motorcycle-inline-4": { personalityId: "motorcycle-inline-4", entries: [] },
  "v-twin-cruiser": { personalityId: "v-twin-cruiser", entries: [] },
};

/** Operating regions the American Muscle V8 pilot must cover before sample realism can be claimed. */
export const AMERICAN_V8_REQUIRED_REGIONS = [
  "idle",
  "on-load-low",
  "on-load-mid",
  "on-load-high",
  "off-load-low",
  "off-load-mid",
  "off-load-high",
  "overrun-low",
  "overrun-high",
] as const;

export type AmericanV8RequiredRegion = (typeof AMERICAN_V8_REQUIRED_REGIONS)[number];

function regionForPilotEntry(entry: CombustionSampleEntry): AmericanV8RequiredRegion | null {
  if (entry.character === "idle" || entry.load === "idle") return "idle";
  if (entry.character === "overrun" || entry.load === "overrun") {
    return (entry.rpmRef ?? 0) < 2800 ? "overrun-low" : "overrun-high";
  }
  if (entry.character === "off-load" || entry.load === "off-load") {
    if ((entry.loadAnchor ?? 0) < 0.35 && entry.rpmRef < 2200) return "off-load-low";
    if (entry.rpmRef < 3800) return "off-load-mid";
    return "off-load-high";
  }
  const anchor = entry.loadAnchor ?? (entry.load === "low" ? 0.25 : entry.load === "medium" ? 0.5 : 0.8);
  if (anchor < 0.35) return "on-load-low";
  if (anchor < 0.65) return "on-load-mid";
  return "on-load-high";
}

/**
 * Report which required Muscle pilot regions have at least one approved bank entry.
 * Empty / unapproved banks report every region uncovered - procedural stays authoritative.
 */
export function reportAmericanV8SampleCoverage(bank: CombustionSampleBank | null | undefined): {
  covered: AmericanV8RequiredRegion[];
  uncovered: AmericanV8RequiredRegion[];
} {
  const covered = new Set<AmericanV8RequiredRegion>();
  for (const entry of bank?.entries ?? []) {
    const region = regionForPilotEntry(entry);
    if (region) covered.add(region);
  }
  const uncovered = AMERICAN_V8_REQUIRED_REGIONS.filter((region) => !covered.has(region));
  return { covered: [...covered], uncovered: [...uncovered] };
}

/**
 * Whether a target RPM sits inside any entry's permitted transposition window.
 * Used by diagnostics when the bank is partial so uncovered RPM bands stay visible.
 */
export function sampleCoverageAtRpm(
  bank: CombustionSampleBank,
  rpm: number,
  load: SampleLoadRegion,
  demand: number,
): { covered: boolean; reason: SampleMixSelection["fallbackReason"]; activeIds: string[] } {
  const selection = selectSampleMix(bank, rpm, load, demand);
  return {
    covered: selection.targets.length > 0,
    reason: selection.fallbackReason,
    activeIds: selection.targets.map((t) => t.entry.assetId),
  };
}
