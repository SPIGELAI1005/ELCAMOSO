/**
 * Per combustion Sound Profile recording requests (Prompt 05).
 * Slots list missing licensed assets — no invented files or competitor audio.
 */

import type {
  HybridMicPerspective,
  HybridRecordingManifest,
  HybridRecordingManifestEntry,
  HybridSampleRegime,
} from "@/lib/sound/realism/samples/types";

/** Realism V2 combustion Sound Profile IDs (catalog, not invented). */
export const COMBUSTION_SAMPLE_PROFILE_IDS = [
  "american-muscle-v8",
  "flat-six-sport",
  "gt-v8",
  "racing-v10",
  "race-car",
  "rally-car",
  "turbo-inline-6",
  "motorcycle-superbike",
  "big-twin",
] as const;

export type CombustionSampleProfileId = (typeof COMBUSTION_SAMPLE_PROFILE_IDS)[number];

const FAMILY_BY_PROFILE: Record<CombustionSampleProfileId, string> = {
  "american-muscle-v8": "american-v8",
  "flat-six-sport": "flat-six-sport",
  "gt-v8": "gt-v8",
  "racing-v10": "high-rev-v10",
  "race-car": "flat-plane-v8-track",
  "rally-car": "rally-turbo-3",
  "turbo-inline-6": "turbo-inline-6",
  "motorcycle-superbike": "motorcycle-inline-4",
  "big-twin": "v-twin-cruiser",
};

/** Acquisition priority: 1 = record first. */
const PRIORITY_BY_PROFILE: Record<CombustionSampleProfileId, number> = {
  "american-muscle-v8": 1,
  "flat-six-sport": 1,
  "gt-v8": 2,
  "racing-v10": 2,
  "race-car": 2,
  "rally-car": 3,
  "turbo-inline-6": 3,
  "motorcycle-superbike": 3,
  "big-twin": 3,
};

interface SlotSpec {
  regime: HybridSampleRegime;
  /** Suggested target RPM for the steady recording (design request, not a claim of capture). */
  targetRpm: number | null;
  loadAnchor: number | null;
  optional?: boolean;
  perspective?: HybridMicPerspective;
}

const CORE_BED_SLOTS: SlotSpec[] = [
  { regime: "idle", targetRpm: 750, loadAnchor: 0.05, perspective: "exhaust-near" },
  { regime: "on-load-low", targetRpm: 1800, loadAnchor: 0.3, perspective: "exhaust-near" },
  { regime: "on-load-mid", targetRpm: 3200, loadAnchor: 0.55, perspective: "exhaust-near" },
  { regime: "on-load-high", targetRpm: 4800, loadAnchor: 0.85, perspective: "exhaust-near" },
  { regime: "off-load-low", targetRpm: 1800, loadAnchor: 0.1, perspective: "exhaust-near" },
  { regime: "off-load-mid", targetRpm: 3200, loadAnchor: 0.1, perspective: "exhaust-near" },
  { regime: "off-load-high", targetRpm: 4800, loadAnchor: 0.1, perspective: "exhaust-near" },
];

const OPTIONAL_SLOTS: SlotSpec[] = [
  { regime: "intake", targetRpm: 3200, loadAnchor: 0.7, optional: true, perspective: "intake" },
  {
    regime: "mechanical-engagement",
    targetRpm: null,
    loadAnchor: null,
    optional: true,
    perspective: "engine-bay",
  },
  {
    regime: "lift-off",
    targetRpm: 3500,
    loadAnchor: 0.05,
    optional: true,
    perspective: "exhaust-near",
  },
  { regime: "overrun-low", targetRpm: 2200, loadAnchor: 0, optional: true, perspective: "exhaust-near" },
  { regime: "overrun-high", targetRpm: 4200, loadAnchor: 0, optional: true, perspective: "exhaust-near" },
];

function emptyEntry(
  profileId: CombustionSampleProfileId,
  slot: SlotSpec,
  priority: number,
): HybridRecordingManifestEntry {
  const familyId = FAMILY_BY_PROFILE[profileId];
  const optional = Boolean(slot.optional);
  return {
    assetId: `${profileId}__${slot.regime}`,
    profileId,
    familyId,
    regime: slot.regime,
    sourceRpm: null,
    loadAnchor: slot.loadAnchor,
    micPerspective: "unknown",
    loopStartSeconds: null,
    loopEndSeconds: null,
    gainTrimDb: null,
    sampleRateHz: null,
    channelFormat: "unknown",
    assetPath: null,
    license: {
      sourceRecord: null,
      licenseRecord: null,
      approval: "unknown",
      commercialWebInteractive: null,
      clientExtractableAcknowledged: true,
    },
    checksumSha256: null,
    permittedPlaybackRate: { min: 0.88, max: 1.14 },
    steadyState: optional && (slot.regime === "mechanical-engagement" || slot.regime === "lift-off")
      ? "unknown"
      : "unknown",
    acquisitionPriority: optional ? priority + 2 : priority,
    notes: optional
      ? `Optional ${slot.regime}. Suggested capture ~${slot.targetRpm ?? "event"} RPM. Awaiting licensed asset.`
      : `Required steady ${slot.regime} bed. Prefer measured ~${slot.targetRpm} RPM (not a free-rev sweep). Awaiting licensed asset.`,
  };
}

export function buildRecordingRequestManifest(
  profileId: CombustionSampleProfileId,
): HybridRecordingManifest {
  const priority = PRIORITY_BY_PROFILE[profileId];
  const entries = [...CORE_BED_SLOTS, ...OPTIONAL_SLOTS].map((slot) =>
    emptyEntry(profileId, slot, priority),
  );
  return {
    version: 1,
    profileId,
    familyId: FAMILY_BY_PROFILE[profileId],
    entries,
    status: "awaiting-assets",
  };
}

export function allCombustionRecordingRequests(): HybridRecordingManifest[] {
  return COMBUSTION_SAMPLE_PROFILE_IDS.map(buildRecordingRequestManifest);
}

/** Required (non-optional) asset IDs still missing for a profile. */
export function missingRequiredAssetIds(manifest: HybridRecordingManifest): string[] {
  const optional = new Set(OPTIONAL_SLOTS.map((s) => s.regime));
  return manifest.entries
    .filter((e) => !optional.has(e.regime) && e.assetPath == null)
    .map((e) => e.assetId);
}

export function familyIdForSampleProfile(profileId: CombustionSampleProfileId): string {
  return FAMILY_BY_PROFILE[profileId];
}
