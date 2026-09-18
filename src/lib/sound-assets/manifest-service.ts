import {
  DEFAULT_SIGNED_URL_TTL_MS,
  filterSoundAssetCatalog,
  isSoundAssetCatalogEmpty,
  SOUND_ASSET_CATALOG,
  SOUND_ASSET_MANIFEST_VERSION,
} from "@/lib/sound-assets/catalog";
import { buildSignedDeliveryUrl, getSoundAssetSigningSecret } from "@/lib/sound-assets/signing";
import type { SoundAssetManifest, SoundAssetManifestRequest } from "@/lib/sound-assets/types";
import { hasEntitlement } from "@/lib/entitlements/resolve";
import { resolveEntitlementUser } from "@/lib/entitlements/service";

export class SoundAssetDeliveryUnavailableError extends Error {
  constructor(message = "Sound asset delivery is not configured") {
    super(message);
    this.name = "SoundAssetDeliveryUnavailableError";
  }
}

export async function buildSoundAssetManifest(input: {
  sessionToken?: string | null;
  origin: string;
  request?: SoundAssetManifestRequest;
  now?: number;
}): Promise<SoundAssetManifest> {
  const now = input.now ?? Date.now();
  const expiresAt = now + DEFAULT_SIGNED_URL_TTL_MS;

  if (isSoundAssetCatalogEmpty()) {
    return {
      version: SOUND_ASSET_MANIFEST_VERSION,
      generatedAt: now,
      expiresAt,
      deliveryMode: "procedural_only",
      assets: [],
    };
  }

  const secret = getSoundAssetSigningSecret();
  if (!secret) {
    throw new SoundAssetDeliveryUnavailableError();
  }

  const user = await resolveEntitlementUser({
    sessionToken: input.sessionToken ?? null,
    now,
  });
  const hasPremiumAccess = hasEntitlement(user, "all_sound_profiles", now);
  const eligible = filterSoundAssetCatalog(SOUND_ASSET_CATALOG, {
    hasPremiumAccess,
    ...(input.request?.personality ? { personality: input.request.personality } : {}),
  });

  const assets = eligible.map((asset) => ({
    id: asset.id,
    url: buildSignedDeliveryUrl(input.origin, asset.path, expiresAt, secret),
    expiresAt,
    contentType: asset.contentType,
  }));

  return {
    version: SOUND_ASSET_MANIFEST_VERSION,
    generatedAt: now,
    expiresAt,
    deliveryMode: "hybrid",
    assets,
  };
}
