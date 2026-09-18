import type { FusionStudioParams, SymphonyStudioParams } from "./types";

/** Runtime Studio overlays applied while auditioning / driving a pack profile. */
const symphonyByProfile = new Map<string, SymphonyStudioParams>();
const fusionByProfile = new Map<string, FusionStudioParams>();

export function setRuntimeSymphonyParams(profileId: string, params: SymphonyStudioParams | null) {
  if (!params) symphonyByProfile.delete(profileId);
  else symphonyByProfile.set(profileId, params);
}

export function getRuntimeSymphonyParams(profileId: string): SymphonyStudioParams | null {
  return symphonyByProfile.get(profileId) ?? null;
}

export function setRuntimeFusionParams(profileId: string, params: FusionStudioParams | null) {
  if (!params) fusionByProfile.delete(profileId);
  else fusionByProfile.set(profileId, params);
}

export function getRuntimeFusionParams(profileId: string): FusionStudioParams | null {
  return fusionByProfile.get(profileId) ?? null;
}

export function clearStudioRuntime() {
  symphonyByProfile.clear();
  fusionByProfile.clear();
}
