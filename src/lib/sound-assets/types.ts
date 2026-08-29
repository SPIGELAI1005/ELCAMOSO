export type SoundAssetTier = "free" | "drive_plus";

export interface SoundAssetDescriptor {
  id: string;
  /** Storage-relative path, e.g. personalities/flat6_shift_up_01.wav */
  path: string;
  tier: SoundAssetTier;
  personality?: string;
  event?: string;
  contentType: string;
  byteLength?: number;
}

export interface SignedSoundAssetUrl {
  id: string;
  url: string;
  expiresAt: number;
  contentType: string;
}

export type SoundAssetDeliveryMode = "procedural_only" | "hybrid";

export interface SoundAssetManifest {
  version: number;
  generatedAt: number;
  expiresAt: number;
  deliveryMode: SoundAssetDeliveryMode;
  assets: SignedSoundAssetUrl[];
}

export interface SoundAssetManifestRequest {
  personality?: string;
}
