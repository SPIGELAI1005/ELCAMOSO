import { readFile } from "node:fs/promises";
import path from "node:path";

import { findSoundAssetByPath } from "@/lib/sound-assets/catalog";
import {
  getSoundAssetSigningSecret,
  verifySignedDelivery,
} from "@/lib/sound-assets/signing";

export class SoundAssetDeliveryError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SoundAssetDeliveryError";
    this.status = status;
  }
}

function resolveStorageRoot(): string | null {
  const root = process.env.SOUND_ASSETS_STORAGE_ROOT?.trim();
  return root || null;
}

function resolveSafeAssetPath(relativePath: string): string {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  if (!normalized || normalized.startsWith("..") || path.isAbsolute(normalized)) {
    throw new SoundAssetDeliveryError("Invalid asset path", 400);
  }
  return normalized;
}

export async function deliverSignedSoundAsset(input: {
  path: string;
  expiresAt: number;
  signature: string;
  now?: number;
}): Promise<Response> {
  const secret = getSoundAssetSigningSecret();
  if (!secret) {
    throw new SoundAssetDeliveryError("Sound asset delivery is not configured", 503);
  }

  const safePath = resolveSafeAssetPath(input.path);
  const descriptor = findSoundAssetByPath(safePath);
  if (!descriptor) {
    throw new SoundAssetDeliveryError("Asset not found", 404);
  }

  const valid = verifySignedDelivery({
    path: safePath,
    expiresAt: input.expiresAt,
    signature: input.signature,
    secret,
    now: input.now,
  });
  if (!valid) {
    throw new SoundAssetDeliveryError("Invalid or expired signature", 403);
  }

  const cdnBase = process.env.SOUND_ASSETS_CDN_BASE_URL?.trim();
  if (cdnBase) {
    const base = cdnBase.replace(/\/$/, "");
    const redirectUrl = `${base}/${safePath}?exp=${input.expiresAt}&sig=${encodeURIComponent(input.signature)}`;
    return new Response(null, {
      status: 302,
      headers: {
        location: redirectUrl,
        "cache-control": "private, no-store",
      },
    });
  }

  const storageRoot = resolveStorageRoot();
  if (!storageRoot) {
    throw new SoundAssetDeliveryError("Asset storage is not configured", 503);
  }

  const absolutePath = path.join(storageRoot, safePath);
  const resolvedRoot = path.resolve(storageRoot);
  const resolvedFile = path.resolve(absolutePath);
  if (!resolvedFile.startsWith(resolvedRoot)) {
    throw new SoundAssetDeliveryError("Invalid asset path", 400);
  }

  let fileBytes: Buffer;
  try {
    fileBytes = await readFile(resolvedFile);
  } catch {
    throw new SoundAssetDeliveryError("Asset file missing", 404);
  }

  return new Response(fileBytes, {
    status: 200,
    headers: {
      "content-type": descriptor.contentType,
      "content-length": String(fileBytes.byteLength),
      "cache-control": "private, max-age=1800",
    },
  });
}
