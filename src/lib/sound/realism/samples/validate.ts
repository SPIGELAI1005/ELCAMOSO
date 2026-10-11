import type { HybridRecordingManifestEntry } from "@/lib/sound/realism/samples/types";

export interface ManifestValidationResult {
  ok: boolean;
  errors: string[];
  /** True only when the entry may feed the hybrid sample layer. */
  runtimeReady: boolean;
}

/**
 * Validate a recording manifest entry.
 * Empty / awaiting slots are valid acquisition records but not runtime-ready.
 */
export function validateHybridRecordingEntry(
  entry: HybridRecordingManifestEntry,
): ManifestValidationResult {
  const errors: string[] = [];
  if (!entry.assetId?.trim()) errors.push("assetId required");
  if (!entry.profileId?.trim()) errors.push("profileId required");
  if (!entry.familyId?.trim()) errors.push("familyId required");
  if (!entry.regime) errors.push("regime required");
  if (!entry.permittedPlaybackRate) {
    errors.push("permittedPlaybackRate required");
  } else {
    if (!(entry.permittedPlaybackRate.min > 0)) errors.push("permittedPlaybackRate.min must be > 0");
    if (!(entry.permittedPlaybackRate.max >= entry.permittedPlaybackRate.min)) {
      errors.push("permittedPlaybackRate.max must be >= min");
    }
    if (entry.permittedPlaybackRate.max > 2.5) {
      errors.push("permittedPlaybackRate.max > 2.5 is too wide for a single free-rev substitute");
    }
  }
  if (!entry.license?.clientExtractableAcknowledged) {
    errors.push("license.clientExtractableAcknowledged must be true");
  }

  const awaiting =
    entry.assetPath == null ||
    entry.license.approval !== "approved" ||
    entry.sourceRpm == null ||
    entry.loopStartSeconds == null ||
    entry.loopEndSeconds == null;

  if (!awaiting) {
    if (!(entry.sourceRpm! > 0 && entry.sourceRpm! < 20_000)) {
      errors.push("sourceRpm out of range");
    }
    if (!(entry.loopEndSeconds! > entry.loopStartSeconds!)) {
      errors.push("loopEndSeconds must be > loopStartSeconds");
    }
    if (entry.sampleRateHz != null && !(entry.sampleRateHz >= 22_050 && entry.sampleRateHz <= 192_000)) {
      errors.push("sampleRateHz out of supported range");
    }
    if (entry.channelFormat === "unknown") {
      errors.push("channelFormat must be mono or stereo for runtime assets");
    }
    if (!entry.license.sourceRecord || !entry.license.licenseRecord) {
      errors.push("approved assets require sourceRecord and licenseRecord");
    }
    if (entry.license.commercialWebInteractive !== true) {
      errors.push("commercialWebInteractive must be true for browser-delivered samples");
    }
    if (entry.steadyState !== true && entry.regime !== "mechanical-engagement" && entry.regime !== "lift-off") {
      errors.push("steady beds require steadyState === true");
    }
    if (entry.gainTrimDb == null || !Number.isFinite(entry.gainTrimDb)) {
      errors.push("gainTrimDb required for runtime assets");
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    runtimeReady: errors.length === 0 && !awaiting,
  };
}

/** Bounded stretch: playbackRate = targetRpm / sourceRpm within per-asset window. */
export function boundedPlaybackRate(
  targetRpm: number,
  sourceRpm: number,
  permitted: { min: number; max: number },
): number | null {
  if (!(targetRpm > 0) || !(sourceRpm > 0)) return null;
  const rate = targetRpm / sourceRpm;
  if (rate < permitted.min || rate > permitted.max) return null;
  return rate;
}
