import type { SoundAssetManifest } from "@/lib/sound-assets/types";

const MANIFEST_ENDPOINT = "/api/sound-assets/manifest";

export async function fetchSoundAssetManifest(input: {
  sessionToken?: string | null;
  personality?: string;
}): Promise<SoundAssetManifest> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (input.sessionToken) {
    headers.authorization = `Bearer ${input.sessionToken}`;
  }

  const response = await fetch(MANIFEST_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(
      input.personality ? { personality: input.personality } : {},
    ),
  });

  if (!response.ok) {
    throw new Error(`Sound asset manifest failed (${response.status})`);
  }

  return (await response.json()) as SoundAssetManifest;
}

export async function decodeManifestAssets(
  audioContext: AudioContext,
  manifest: SoundAssetManifest,
): Promise<Map<string, AudioBuffer>> {
  const buffers = new Map<string, AudioBuffer>();
  if (manifest.deliveryMode === "procedural_only" || manifest.assets.length === 0) {
    return buffers;
  }

  await Promise.all(
    manifest.assets.map(async (asset) => {
      const response = await fetch(asset.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch sound asset ${asset.id}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      buffers.set(asset.id, decoded);
    }),
  );

  return buffers;
}
