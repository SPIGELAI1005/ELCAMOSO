/** Provenance-safe manifest for the American Muscle V8 hybrid pilot. */

export type MetadataConfidence = "unknown" | "low" | "medium" | "high";
export type LicenseApproval = "unknown" | "approved" | "rejected";
export type RecordingPerspective =
  | "exhaust-near"
  | "engine-bay"
  | "cabin"
  | "trackside"
  | "unknown";
export type EngineLoadState = "idle" | "on-load" | "off-load" | "overrun" | "unknown";

export interface EngineSampleManifestEntry {
  id: string;
  assetPath: string | null;
  sourceLicense: {
    sourceRecord: string | null;
    licenseRecord: string | null;
    approval: LicenseApproval;
  };
  engineIdentity: "american-muscle-v8" | "unknown";
  recordingPerspective: RecordingPerspective;
  rpmAnchor: number | null;
  loadState: EngineLoadState;
  /** Normalized load anchor used for adjacent-load interpolation. */
  loadAnchor: number | null;
  loop: { startSeconds: number; endSeconds: number } | null;
  trimDb: number | null;
  permittedPlaybackRate: { min: number; max: number };
  rpmConfidence: MetadataConfidence;
  loadConfidence: MetadataConfidence;
  /** Must be true; changing-RPM sweeps are not valid steady loops. */
  steadyState: true | false | "unknown";
  /** Measured overlap correction. Null means the asset is not pilot-ready. */
  overlapTrimDb: number | null;
}

function requiredSlot(
  id: string,
  loadState: Exclude<EngineLoadState, "unknown">,
): EngineSampleManifestEntry {
  return {
    id,
    assetPath: null,
    sourceLicense: { sourceRecord: null, licenseRecord: null, approval: "unknown" },
    engineIdentity: "unknown",
    recordingPerspective: "unknown",
    rpmAnchor: null,
    loadState,
    loadAnchor: null,
    loop: null,
    trimDb: null,
    permittedPlaybackRate: { min: 0.88, max: 1.14 },
    rpmConfidence: "unknown",
    loadConfidence: "unknown",
    steadyState: "unknown",
    overlapTrimDb: null,
  };
}

/**
 * Required acquisition slots. They deliberately contain no invented metadata.
 * Entries only become playable after every readiness field is supplied and approved.
 */
export const AMERICAN_V8_PILOT_MANIFEST: readonly EngineSampleManifestEntry[] = [
  requiredSlot("american-v8-idle", "idle"),
  requiredSlot("american-v8-onload-low", "on-load"),
  requiredSlot("american-v8-onload-mid", "on-load"),
  requiredSlot("american-v8-onload-high", "on-load"),
  requiredSlot("american-v8-offload-low", "off-load"),
  requiredSlot("american-v8-offload-mid", "off-load"),
  requiredSlot("american-v8-offload-high", "off-load"),
  requiredSlot("american-v8-overrun-low", "overrun"),
  requiredSlot("american-v8-overrun-high", "overrun"),
];

export function isPilotEntryApproved(
  entry: EngineSampleManifestEntry,
): entry is EngineSampleManifestEntry & {
  assetPath: string;
  engineIdentity: "american-muscle-v8";
  recordingPerspective: Exclude<RecordingPerspective, "unknown">;
  rpmAnchor: number;
  loadState: Exclude<EngineLoadState, "unknown">;
  loadAnchor: number;
  loop: { startSeconds: number; endSeconds: number };
  trimDb: number;
  overlapTrimDb: number;
  steadyState: true;
} {
  return (
    entry.sourceLicense.approval === "approved" &&
    Boolean(entry.sourceLicense.sourceRecord) &&
    Boolean(entry.sourceLicense.licenseRecord) &&
    Boolean(entry.assetPath) &&
    entry.engineIdentity === "american-muscle-v8" &&
    entry.recordingPerspective !== "unknown" &&
    entry.rpmAnchor != null &&
    entry.rpmAnchor > 0 &&
    entry.loadAnchor != null &&
    entry.loop != null &&
    entry.loop.endSeconds > entry.loop.startSeconds &&
    entry.trimDb != null &&
    entry.overlapTrimDb != null &&
    entry.steadyState === true &&
    entry.rpmConfidence !== "unknown" &&
    entry.loadConfidence !== "unknown"
  );
}

export function missingPilotRecordingRequirements(): string[] {
  return AMERICAN_V8_PILOT_MANIFEST.filter((entry) => !isPilotEntryApproved(entry)).map(
    (entry) => entry.id,
  );
}
