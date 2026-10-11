import { isSoundAssetCatalogEmpty } from "@/lib/sound-assets/catalog";
import {
  buildRecordingRequestManifest,
  COMBUSTION_SAMPLE_PROFILE_IDS,
  type CombustionSampleProfileId,
  missingRequiredAssetIds,
} from "@/lib/sound/realism/samples/recording-requests";
import { validateHybridRecordingEntry } from "@/lib/sound/realism/samples/validate";
import type { HybridRecordingManifest } from "@/lib/sound/realism/samples/types";
import { missingPilotRecordingRequirements } from "@/lib/sound/realism/v2/american-v8-pilot-manifest";

/**
 * Honest sample-asset status for a Sound Profile.
 * Never treat empty slots or synthetic placeholders as recordings.
 */
export type SampleAssetProfileStatus =
  | "not-combustion"
  | "awaiting-assets"
  | "partial"
  | "ready";

export function isCombustionSampleProfileId(id: string): id is CombustionSampleProfileId {
  return (COMBUSTION_SAMPLE_PROFILE_IDS as readonly string[]).includes(id);
}

export function sampleAssetStatusForProfile(profileId: string): {
  status: SampleAssetProfileStatus;
  missingRequiredIds: string[];
  runtimeReadyCount: number;
  catalogEmpty: boolean;
} {
  if (!isCombustionSampleProfileId(profileId)) {
    return {
      status: "not-combustion",
      missingRequiredIds: [],
      runtimeReadyCount: 0,
      catalogEmpty: isSoundAssetCatalogEmpty(),
    };
  }

  const manifest = buildRecordingRequestManifest(profileId);
  const missing = new Set(missingRequiredAssetIds(manifest));
  if (profileId === "american-muscle-v8") {
    for (const id of missingPilotRecordingRequirements()) missing.add(id);
  }

  const runtimeReadyCount = manifest.entries.filter(
    (entry) => validateHybridRecordingEntry(entry).runtimeReady,
  ).length;
  const requiredMissing = missingRequiredAssetIds(manifest);
  const catalogEmpty = isSoundAssetCatalogEmpty();

  if (catalogEmpty || runtimeReadyCount === 0) {
    return {
      status: "awaiting-assets",
      missingRequiredIds: [...missing],
      runtimeReadyCount: 0,
      catalogEmpty,
    };
  }

  if (requiredMissing.length > 0) {
    return {
      status: "partial",
      missingRequiredIds: requiredMissing,
      runtimeReadyCount,
      catalogEmpty,
    };
  }

  return {
    status: "ready",
    missingRequiredIds: [],
    runtimeReadyCount,
    catalogEmpty,
  };
}

export function summarizeAllCombustionSampleStatuses(): Array<{
  profileId: CombustionSampleProfileId;
  status: SampleAssetProfileStatus;
  missingRequiredCount: number;
}> {
  return COMBUSTION_SAMPLE_PROFILE_IDS.map((profileId) => {
    const snap = sampleAssetStatusForProfile(profileId);
    return {
      profileId,
      status: snap.status,
      missingRequiredCount: snap.missingRequiredIds.length,
    };
  });
}

export function acquisitionManifestForProfile(
  profileId: CombustionSampleProfileId,
): HybridRecordingManifest {
  return buildRecordingRequestManifest(profileId);
}
