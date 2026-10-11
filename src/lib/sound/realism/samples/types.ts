/**
 * Prompt 05 — typed hybrid recording manifest (acquisition + runtime readiness).
 * Delivery URLs stay in `sound-assets`; this describes recording identity and rights.
 */

export type HybridSampleRegime =
  | "idle"
  | "on-load-low"
  | "on-load-mid"
  | "on-load-high"
  | "off-load-low"
  | "off-load-mid"
  | "off-load-high"
  | "overrun-low"
  | "overrun-high"
  | "intake"
  | "mechanical-engagement"
  | "lift-off";

export type HybridMicPerspective =
  | "exhaust-near"
  | "engine-bay"
  | "cabin"
  | "intake"
  | "trackside"
  | "unknown";

export type HybridLicenseApproval = "unknown" | "approved" | "rejected";

export type HybridChannelFormat = "mono" | "stereo" | "unknown";

export type HybridSampleBlendMode = "linear" | "equal-power";

export interface HybridLicenseRecord {
  /** Human-readable source (studio session, library SKU, commission invoice id). */
  sourceRecord: string | null;
  /** License / rights instrument id or path in legal archive. */
  licenseRecord: string | null;
  approval: HybridLicenseApproval;
  /**
   * Whether the license allows commercial interactive web redistribution
   * of browser-delivered samples (client audio can always be extracted).
   */
  commercialWebInteractive: boolean | null;
  /** Explicit note that DRM cannot make client audio impossible to extract. */
  clientExtractableAcknowledged: true;
}

/**
 * Stable recording slot / asset descriptor.
 * Missing files keep null paths and approval "unknown" — never invent WAVs.
 */
export interface HybridRecordingManifestEntry {
  /** Stable asset ID (never rename once published). */
  assetId: string;
  /** Catalog Sound Profile id (e.g. american-muscle-v8). */
  profileId: string;
  /** Technical combustion family / personality key. */
  familyId: string;
  regime: HybridSampleRegime;
  /** Source RPM of the steady recording; null until measured. */
  sourceRpm: number | null;
  /** Normalized load 0..1 for on-load anchors; null for idle/optional one-shots. */
  loadAnchor: number | null;
  micPerspective: HybridMicPerspective;
  loopStartSeconds: number | null;
  loopEndSeconds: number | null;
  gainTrimDb: number | null;
  sampleRateHz: number | null;
  channelFormat: HybridChannelFormat;
  /** Storage-relative path when a licensed file exists; null = awaiting assets. */
  assetPath: string | null;
  license: HybridLicenseRecord;
  /** Optional SHA-256 hex of the file bytes. */
  checksumSha256: string | null;
  /** Bounded playbackRate = targetRpm/sourceRpm window for this asset. */
  permittedPlaybackRate: { min: number; max: number };
  /** Steady-state loop required for RPM beds; one-shots may be false. */
  steadyState: boolean | "unknown";
  /** Priority for acquisition (1 = highest). */
  acquisitionPriority: number;
  notes: string;
}

export interface HybridRecordingManifest {
  version: 1;
  profileId: string;
  familyId: string;
  entries: HybridRecordingManifestEntry[];
  /** Honest status — never claim recordings when slots are empty. */
  status: "awaiting-assets" | "partial" | "ready";
}

export interface HybridSampleCacheStats {
  entryCount: number;
  approxBytes: number;
  maxBytes: number;
  hits: number;
  misses: number;
  evictions: number;
}
