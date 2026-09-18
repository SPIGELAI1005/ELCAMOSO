import { describe, expect, it } from "vitest";
import {
  SOCIAL_CARD_TEMPLATES,
  buildDriveSongOgUrl,
  buildOgApiUrl,
  clampLines,
  hashSeed,
  normalizeOgCardData,
  sanitizeOgText,
  toPublicDriveShareMetadata,
  ogCardFromPublicShare,
} from "@/lib/og";
import {
  resolveOgImage,
  driveSongSocialMeta,
  absoluteSeoUrl,
  createSeoHeadFromPath,
} from "@/lib/seo";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("OG social card system", () => {
  it("canonical OG URLs use www.elcamoso.com", () => {
    expect(buildOgApiUrl("symphony")).toBe("https://www.elcamoso.com/api/og?v=symphony");
    expect(buildDriveSongOgUrl("abc123")).toContain("https://www.elcamoso.com/api/og/drive-song/");
  });

  it("static fallback files exist", () => {
    for (const name of [
      "elcamoso-default.png",
      "engine.png",
      "symphony.png",
      "worlds.png",
      "fusion.png",
      "drive-song.png",
    ]) {
      expect(existsSync(join(process.cwd(), "public", "og", name))).toBe(true);
    }
  });

  it("clamps long titles and preserves newlines", () => {
    const data = normalizeOgCardData({
      variant: "brand",
      title: "TURN MOTION\nINTO SOUND.",
    });
    expect(data.title).toContain("\n");
    const long = normalizeOgCardData({
      variant: "drive-song",
      title: "A".repeat(200),
    });
    expect(long.title.length).toBeLessThanOrEqual(72);
    expect(long.title).toMatch(/…/);
  });

  it("renders PNG at 1200x630", async () => {
    const { renderOgCardPng } = await import("./render");
    const png = await renderOgCardPng(
      normalizeOgCardData({ variant: "brand", title: "TURN MOTION\nINTO SOUND." }),
    );
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50); // P
    expect(png[2]).toBe(0x4e); // N
    expect(png[3]).toBe(0x47); // G
    // IHDR width/height big-endian at bytes 16-23
    const width = (png[16]! << 24) | (png[17]! << 16) | (png[18]! << 8) | png[19]!;
    const height = (png[20]! << 24) | (png[21]! << 16) | (png[22]! << 8) | png[23]!;
    expect(width).toBe(1200);
    expect(height).toBe(630);
  }, 30_000);

  it("handles emoji and diacritics without crashing", () => {
    expect(sanitizeOgText("Night 🎵 Motion", 40)).toContain("Night");
    expect(sanitizeOgText("Șoseaua București - pădure", 80)).toContain("București");
    expect(sanitizeOgText("Größe über Straße", 40)).toContain("über");
    expect(clampLines("ă â î ș ț ä ö ü ß", 40, 2).length).toBeGreaterThan(0);
  });

  it("rejects private journey fields from public OG metadata", () => {
    expect(
      toPublicDriveShareMetadata({
        songTitle: "Night",
        experienceName: "Rock",
        latitude: 48.1,
        seed: "1",
      }),
    ).toBeNull();
    expect(
      toPublicDriveShareMetadata({
        songTitle: "Night",
        experienceName: "Rock",
        route: "home to work",
        seed: "1",
      }),
    ).toBeNull();
    const ok = toPublicDriveShareMetadata({
      songTitle: "Night Motion",
      experienceName: "Cinematic Rock",
      driveDnaArchetype: "Progressive Cruiser",
      durationCategory: "24 min",
      seed: "seed-1",
      publicDriveDnaValues: { energy: 82, flow: 74, rhythm: 69, variation: 61, regen: 88 },
    });
    expect(ok).not.toBeNull();
    expect(JSON.stringify(ok)).not.toMatch(/lat|gps|route|home/i);
    const card = ogCardFromPublicShare(ok!);
    expect(card.variant).toBe("drive-song");
    expect(card.title).toContain("THIS DRIVE");
  });

  it("seed is deterministic", () => {
    expect(hashSeed("a")).toBe(hashSeed("a"));
    expect(hashSeed("a")).not.toBe(hashSeed("b"));
  });

  it("SEO marketing routes resolve dynamic OG images", () => {
    const head = createSeoHeadFromPath("/symphony");
    const img = head.meta.find((m) => m.property === "og:image")?.content;
    expect(img).toBe("https://www.elcamoso.com/api/og?v=symphony");
    expect(head.meta.some((m) => m.property === "og:image:alt")).toBe(true);
    expect(head.meta.some((m) => m.name === "twitter:image:alt")).toBe(true);
  });

  it("resolveOgImage keeps absolute share URLs", () => {
    const share = absoluteSeoUrl("/api/og/drive-song/xyz");
    const og = resolveOgImage(share, { variant: "drive-song" });
    expect(og.url).toBe(share);
    expect(og.width).toBe(1200);
    expect(og.height).toBe(630);
  });

  it("driveSongSocialMeta strips GPS and builds share OG URL", () => {
    const safe = driveSongSocialMeta({
      title: "Night",
      description: "latitude 48.1 home",
    });
    expect(safe.image).toBe("https://www.elcamoso.com/og/drive-song.png");
    const withShare = driveSongSocialMeta({
      title: "Night Motion",
      sharePayload: "abc",
    });
    expect(withShare.image).toContain("/api/og/drive-song/");
  });

  it("manifest covers all variants", () => {
    const keys = Object.keys(SOCIAL_CARD_TEMPLATES);
    expect(keys).toEqual(
      expect.arrayContaining([
        "brand",
        "engine",
        "symphony",
        "world",
        "fusion",
        "drive-song",
        "journey",
        "pricing",
      ]),
    );
  });
});
