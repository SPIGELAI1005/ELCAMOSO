export type {
  HybridChannelFormat,
  HybridLicenseApproval,
  HybridLicenseRecord,
  HybridMicPerspective,
  HybridRecordingManifest,
  HybridRecordingManifestEntry,
  HybridSampleBlendMode,
  HybridSampleCacheStats,
  HybridSampleRegime,
} from "@/lib/sound/realism/samples/types";

export {
  COMBUSTION_SAMPLE_PROFILE_IDS,
  allCombustionRecordingRequests,
  buildRecordingRequestManifest,
  familyIdForSampleProfile,
  missingRequiredAssetIds,
  type CombustionSampleProfileId,
} from "@/lib/sound/realism/samples/recording-requests";

export {
  validateHybridRecordingEntry,
  boundedPlaybackRate,
  type ManifestValidationResult,
} from "@/lib/sound/realism/samples/validate";

export {
  crossfadeWeights,
  normalizeWeights,
  applyEqualPowerShape,
} from "@/lib/sound/realism/samples/blend";

export {
  BoundedDecodedBufferCache,
  DEFAULT_SAMPLE_CACHE_MAX_BYTES,
  estimateAudioBufferBytes,
  getSharedSampleCache,
  resetSharedSampleCacheForTests,
} from "@/lib/sound/realism/samples/cache";

export {
  HybridSampleLoader,
  getSharedSampleLoader,
  resetSharedSampleLoaderForTests,
  type HybridSampleLoadFailureReason,
  type HybridSampleLoadResult,
} from "@/lib/sound/realism/samples/loader";

export {
  sampleAssetStatusForProfile,
  summarizeAllCombustionSampleStatuses,
  acquisitionManifestForProfile,
  isCombustionSampleProfileId,
  type SampleAssetProfileStatus,
} from "@/lib/sound/realism/samples/status";
