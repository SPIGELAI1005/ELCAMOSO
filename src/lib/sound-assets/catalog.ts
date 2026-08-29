import type { SoundAssetDescriptor } from "@/lib/sound-assets/types";

/** Bump when catalog entries or signing policy changes. */
export const SOUND_ASSET_MANIFEST_VERSION = 1;

/** Default signed URL lifetime (30 minutes). */
export const DEFAULT_SIGNED_URL_TTL_MS = 30 * 60 * 1000;

/**
 * Registered sound files. Empty until recorded samples ship.
 * Never place premium entries under public/.
 */
export const SOUND_ASSET_CATALOG: readonly SoundAssetDescriptor[] = [];

export function isSoundAssetCatalogEmpty(): boolean {
  return SOUND_ASSET_CATALOG.length === 0;
}

export function findSoundAssetByPath(path: string): SoundAssetDescriptor | undefined {
  return SOUND_ASSET_CATALOG.find((asset) => asset.path === path);
}

export function filterSoundAssetCatalog(
  catalog: readonly SoundAssetDescriptor[],
  input: {
    hasPremiumAccess: boolean;
    personality?: string;
  },
): SoundAssetDescriptor[] {
  return catalog.filter((asset) => {
    if (asset.tier === "drive_plus" && !input.hasPremiumAccess) return false;
    if (input.personality && asset.personality !== input.personality) return false;
    return true;
  });
}
