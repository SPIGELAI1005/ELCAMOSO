import { createHmac, timingSafeEqual } from "node:crypto";

export function getSoundAssetSigningSecret(): string | null {
  const secret = process.env["SOUND_ASSET_SIGNING_SECRET"]?.trim();
  return secret || null;
}

export function signAssetPath(path: string, expiresAt: number, secret: string): string {
  const payload = `${path}:${expiresAt}`;
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function buildSignedDeliveryUrl(
  origin: string,
  path: string,
  expiresAt: number,
  secret: string,
): string {
  const cdnBase = process.env["SOUND_ASSETS_CDN_BASE_URL"]?.trim();
  const signature = signAssetPath(path, expiresAt, secret);
  const params = new URLSearchParams({
    path,
    exp: String(expiresAt),
    sig: signature,
  });

  if (cdnBase) {
    const base = cdnBase.replace(/\/$/, "");
    return `${base}/${path}?${params}`;
  }

  const appOrigin = origin.replace(/\/$/, "");
  return `${appOrigin}/api/sound-assets/delivery?${params}`;
}

export function verifySignedDelivery(input: {
  path: string;
  expiresAt: number;
  signature: string;
  secret: string;
  now?: number;
}): boolean {
  const now = input.now ?? Date.now();
  if (!Number.isFinite(input.expiresAt) || input.expiresAt <= now) return false;
  if (!input.path || !input.signature) return false;

  const expected = signAssetPath(input.path, input.expiresAt, input.secret);
  const provided = Buffer.from(input.signature);
  const expectedBuf = Buffer.from(expected);

  if (provided.length !== expectedBuf.length) return false;
  return timingSafeEqual(provided, expectedBuf);
}
