import type { SoundAssetManifest } from "@/lib/sound-assets/types";
import { getSharedSampleLoader } from "@/lib/sound/realism/samples";

const MANIFEST_ENDPOINT = "/api/sound-assets/manifest";

export async function fetchSoundAssetManifest(input: {
  sessionToken?: string | null;
  personality?: string;
  signal?: AbortSignal;
}): Promise<SoundAssetManifest> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (input.sessionToken) {
    headers["authorization"] = `Bearer ${input.sessionToken}`;
  }

  const response = await fetch(MANIFEST_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(input.personality ? { personality: input.personality } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
  });

  if (!response.ok) {
    throw new Error(`Sound asset manifest failed (${response.status})`);
  }

  return (await response.json()) as SoundAssetManifest;
}

/**
 * Decode signed manifest assets through the bounded hybrid sample loader.
 * Empty / procedural_only manifests return an empty map (awaiting assets).
 */
export async function decodeManifestAssets(
  audioContext: BaseAudioContext,
  manifest: SoundAssetManifest,
  signal?: AbortSignal,
): Promise<Map<string, AudioBuffer>> {
  const loader = getSharedSampleLoader();
  const generation = loader.invalidate();
  const result = await loader.loadManifestAssets(audioContext, manifest, {
    ...(signal ? { signal } : {}),
    generation,
  });
  if (result.stale) return new Map();
  return result.buffers;
}
