/**
 * Sample Pack Manifest Types
 * Extends HybridRecordingManifestEntry with sample-pack specific fields.
 */

import type {
  HybridChannelFormat,
  HybridLicenseRecord,
  HybridMicPerspective,
} from "@/lib/sound/realism/samples/types";

export type SamplePackApproval = "unknown" | "approved" | "rejected";

export type SamplePackQuality = "good" | "approximate" | "needs-recording";

export type SamplePackEntryKind = "loop" | "one-shot";

/**
 * Combustion loop regimes. Maps to existing CombustionSampleEntry load regions.
 */
export type CombustionRegime =
  | "idle"
  | "on-load-low"
  | "on-load-mid"
  | "on-load-high"
  | "off-load-low"
  | "off-load-mid"
  | "off-load-high"
  | "overrun-low"
  | "overrun-high"
  | "reverse";

/**
 * Non-combustion loop regime (speed-keyed or rhythm-based).
 */
export type NonCombustionRegime = "speed-keyed" | "rhythm" | "ambient" | "musical";

/**
 * Transient event kinds for one-shots across all profile types.
 */
export type TransientKind =
  // Combustion transients
  | "rev-match"
  | "upshift"
  | "downshift"
  | "exhaust-pop"
  | "overrun"
  | "startup"
  | "shutdown"
  | "limiter"
  | "launch"
  | "drivetrain-thump"
  | "turbo-spool"
  | "turbo-blowoff"
  | "turbo-flutter"
  | "accel-sweep"
  // Non-combustion transients
  | "accel"
  | "decel"
  | "horn"
  | "whistle"
  | "bell"
  | "thunder"
  | "splash"
  | "crash"
  | "clank"
  | "creak"
  | "snap"
  | "chime"
  // Horse/carriage transients
  | "lip_flutter"
  | "snort"
  | "blow_out"
  | "neigh"
  | "breath_stride_gallop"
  | "saddle_creak"
  | "tack_jingle"
  | "whip_crack"
  | "iron_rim_bump"
  // UI
  | "ui"
  | "indicator"
  | "reverse"
  // Generic
  | string;

export interface SamplePackLoopPoints {
  start: number;
  end: number;
}

export interface SamplePackPlaybackRate {
  min: number;
  max: number;
}

/**
 * Base entry shared by all sample types.
 */
export interface SamplePackEntryBase {
  assetId: string;
  profileId: string;
  familyId: string | null;
  kind: SamplePackEntryKind;
  assetPath: string;
  sampleRateHz: number;
  channelFormat: HybridChannelFormat;
  bitDepth: number;
  durationSeconds: number;
  checksumSha256: string;
  micPerspective: HybridMicPerspective;
  gainTrimDb: number;
  quality: SamplePackQuality;
  license: HybridLicenseRecord;
  acquisitionPriority: number;
  notes: string;
}

/**
 * Combustion engine loop entry (RPM/load keyed).
 */
export interface CombustionLoopEntry extends SamplePackEntryBase {
  kind: "loop";
  regime: CombustionRegime;
  /** Source RPM of the recording. May be undefined for special cases like reverse whine. */
  sourceRpm?: number | undefined;
  /** For speed-keyed combustion loops (e.g., reverse). */
  speedKmh?: number | undefined;
  loadAnchor: number;
  loopStartSeconds: number;
  loopEndSeconds: number;
  steadyState: boolean;
  permittedPlaybackRate?: SamplePackPlaybackRate | undefined;
}

/**
 * Non-combustion loop entry (speed/demand keyed).
 */
export interface NonCombustionLoopEntry extends SamplePackEntryBase {
  kind: "loop";
  regime: NonCombustionRegime;
  speedKmh?: number;
  demand?: number;
  state?: "idle" | "cruise" | "pull" | "ambient";
  loopStartSeconds: number;
  loopEndSeconds: number;
  steadyState: boolean;
  /** Optional gait for horse profiles. */
  gait?: "walk" | "trot" | "canter" | "gallop";
  /** Surface type for texture. */
  surface?: "dirt" | "cobble" | "snow" | "water" | "gravel";
  /** BPM for musical loops. */
  bpm?: number;
}

/**
 * Transient one-shot entry.
 */
export interface TransientEntry extends SamplePackEntryBase {
  kind: "one-shot";
  transientKind: TransientKind;
  /** RPM context for shift/rev transients. */
  rpmFrom?: number;
  rpmTo?: number;
  rpmPeak?: number;
  rpmStart?: number;
  rpmEnd?: number;
  rpmHold?: number;
  /** Pop count for exhaust pop variants. */
  popCount?: number;
}

/**
 * Union type for all sample pack entries.
 */
export type SamplePackEntry =
  | CombustionLoopEntry
  | NonCombustionLoopEntry
  | TransientEntry;

/**
 * Per-profile manifest status.
 */
export type SamplePackManifestStatus = "awaiting-assets" | "partial" | "ready";

/**
 * Per-profile manifest.
 */
export interface SamplePackProfileManifest {
  version: number;
  profileId: string;
  familyId: string | null;
  status: SamplePackManifestStatus;
  generator: string;
  entries: SamplePackEntry[];
  quality?: SamplePackQuality;
  qualityNote?: string;
}

/**
 * Profile summary in the index.
 */
export interface SamplePackProfileSummary {
  profileId: string;
  manifest: string;
  quality: SamplePackQuality;
  qualityNote: string;
  loops: number;
  oneShots: number;
  entryQuality: Record<SamplePackQuality, number>;
  demoReel: string;
}

/**
 * Top-level sample pack index.
 */
export interface SamplePackIndex {
  version: number;
  generator: string;
  sampleRateHz: number;
  bitDepth: number;
  channelFormat: HybridChannelFormat;
  profiles: SamplePackProfileSummary[];
  totals: {
    profiles: number;
    files: number;
  };
}

/**
 * Regimes that indicate a combustion loop.
 */
const COMBUSTION_REGIMES = new Set<string>([
  "idle",
  "on-load-low",
  "on-load-mid",
  "on-load-high",
  "off-load-low",
  "off-load-mid",
  "off-load-high",
  "overrun-low",
  "overrun-high",
  "reverse",
]);

/**
 * Type guards.
 */
export function isCombustionLoop(entry: SamplePackEntry): entry is CombustionLoopEntry {
  if (entry.kind !== "loop") return false;
  // Check for sourceRpm field (most combustion loops)
  if ("sourceRpm" in entry && typeof entry.sourceRpm === "number") return true;
  // Check for combustion regime (e.g., reverse whine)
  if ("regime" in entry && typeof entry.regime === "string" && COMBUSTION_REGIMES.has(entry.regime)) return true;
  return false;
}

export function isNonCombustionLoop(entry: SamplePackEntry): entry is NonCombustionLoopEntry {
  return entry.kind === "loop" && !isCombustionLoop(entry);
}

export function isTransient(entry: SamplePackEntry): entry is TransientEntry {
  return entry.kind === "one-shot";
}

/**
 * Approval helpers.
 */
export function isEntryApproved(entry: SamplePackEntry): boolean {
  return entry.license.approval === "approved";
}

export function isEntryRejected(entry: SamplePackEntry): boolean {
  return entry.license.approval === "rejected";
}

export function isEntryUnknown(entry: SamplePackEntry): boolean {
  return entry.license.approval === "unknown";
}
