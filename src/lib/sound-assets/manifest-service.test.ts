import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { DEFAULT_SIGNED_URL_TTL_MS, filterSoundAssetCatalog } from "@/lib/sound-assets/catalog";
import { buildSoundAssetManifest } from "@/lib/sound-assets/manifest-service";
import {
  buildSignedDeliveryUrl,
  getSoundAssetSigningSecret,
  signAssetPath,
  verifySignedDelivery,
} from "@/lib/sound-assets/signing";
import type { SoundAssetDescriptor } from "@/lib/sound-assets/types";

const NOW = Date.parse("2026-08-29T12:00:00.000Z");
const SECRET = "test-signing-secret";

const TEST_CATALOG: SoundAssetDescriptor[] = [
  {
    id: "flat6_shift_up_01",
    path: "personalities/flat6_shift_up_01.wav",
    tier: "free",
    personality: "flat-six-sport",
    event: "upshift",
    contentType: "audio/wav",
  },
  {
    id: "v8_overrun_premium_01",
    path: "personalities/v8_overrun_premium_01.wav",
    tier: "drive_plus",
    personality: "american-v8",
    event: "overrun",
    contentType: "audio/wav",
  },
];

describe("sound asset signing", () => {
  beforeEach(() => {
    process.env.SOUND_ASSET_SIGNING_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.SOUND_ASSET_SIGNING_SECRET;
    delete process.env.SOUND_ASSETS_CDN_BASE_URL;
  });

  it("signs and verifies asset paths", () => {
    const expiresAt = NOW + DEFAULT_SIGNED_URL_TTL_MS;
    const signature = signAssetPath("personalities/flat6_shift_up_01.wav", expiresAt, SECRET);

    expect(
      verifySignedDelivery({
        path: "personalities/flat6_shift_up_01.wav",
        expiresAt,
        signature,
        secret: SECRET,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("rejects expired signatures", () => {
    const expiresAt = NOW - 1;
    const signature = signAssetPath("personalities/flat6_shift_up_01.wav", expiresAt, SECRET);

    expect(
      verifySignedDelivery({
        path: "personalities/flat6_shift_up_01.wav",
        expiresAt,
        signature,
        secret: SECRET,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("builds app delivery URLs by default", () => {
    const expiresAt = NOW + DEFAULT_SIGNED_URL_TTL_MS;
    const url = buildSignedDeliveryUrl(
      "https://elcamoso.app",
      "personalities/flat6_shift_up_01.wav",
      expiresAt,
      SECRET,
    );

    expect(url).toMatch(/^https:\/\/elcamoso\.app\/api\/sound-assets\/delivery\?/);
    expect(getSoundAssetSigningSecret()).toBe(SECRET);
  });

  it("builds CDN URLs when configured", () => {
    process.env.SOUND_ASSETS_CDN_BASE_URL = "https://cdn.elcamoso.app/assets";
    const expiresAt = NOW + DEFAULT_SIGNED_URL_TTL_MS;
    const url = buildSignedDeliveryUrl(
      "https://elcamoso.app",
      "personalities/flat6_shift_up_01.wav",
      expiresAt,
      SECRET,
    );

    expect(url).toMatch(/^https:\/\/cdn\.elcamoso\.app\/assets\/personalities\//);
  });
});

describe("sound asset catalog filtering", () => {
  it("returns only free assets without premium access", () => {
    const filtered = filterSoundAssetCatalog(TEST_CATALOG, {
      hasPremiumAccess: false,
      personality: undefined,
    });
    expect(filtered.map((asset) => asset.id)).toEqual(["flat6_shift_up_01"]);
  });

  it("includes premium assets when entitled", () => {
    expect(
      filterSoundAssetCatalog(TEST_CATALOG, { hasPremiumAccess: false }).map((asset) => asset.id),
    ).toEqual(["flat6_shift_up_01"]);
    expect(
      filterSoundAssetCatalog(TEST_CATALOG, { hasPremiumAccess: true }).map((asset) => asset.id),
    ).toEqual(["flat6_shift_up_01", "v8_overrun_premium_01"]);
    expect(
      filterSoundAssetCatalog(TEST_CATALOG, {
        hasPremiumAccess: true,
        personality: "american-v8",
      }).map((asset) => asset.id),
    ).toEqual(["v8_overrun_premium_01"]);
  });
});

describe("buildSoundAssetManifest", () => {
  afterEach(() => {
    delete process.env.SOUND_ASSET_SIGNING_SECRET;
  });

  it("returns procedural_only when catalog is empty", async () => {
    const manifest = await buildSoundAssetManifest({
      sessionToken: null,
      origin: "http://localhost:5173",
      now: NOW,
    });

    expect(manifest.deliveryMode).toBe("procedural_only");
    expect(manifest.assets).toEqual([]);
  });
});
