/**
 * Generate static OG PNG fallbacks into public/og/
 * Run: npx tsx scripts/generate-og-fallbacks.ts
 */
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { renderOgCardResponse } from "../src/lib/og/render";
import { normalizeOgCardData, SOCIAL_CARD_TEMPLATES, type OgCardVariant } from "../src/lib/og";

const OUTPUT: {
  file: string;
  variant: OgCardVariant;
  experienceName?: string;
  subtitle?: string;
  archetype?: string;
  seed?: string;
  energySamples?: number[];
}[] = [
  { file: "elcamoso-default.png", variant: "brand" },
  { file: "engine.png", variant: "engine", experienceName: "GT V8" },
  { file: "symphony.png", variant: "symphony", experienceName: "CINEMATIC ROCK" },
  { file: "worlds.png", variant: "world", experienceName: "SPACE DRIVE" },
  {
    file: "fusion.png",
    variant: "fusion",
    experienceName: "GT V8 × CINEMATIC ROCK",
  },
  {
    file: "drive-song.png",
    variant: "drive-song",
    subtitle: "NIGHT MOTION",
    archetype: "Progressive Cruiser",
    experienceName: "Cinematic Rock",
    seed: "night-motion-static",
    energySamples: [
      0.22, 0.28, 0.35, 0.48, 0.62, 0.55, 0.7, 0.82, 0.75, 0.88, 0.7, 0.58, 0.45, 0.38, 0.5, 0.66,
      0.72, 0.6, 0.42, 0.3,
    ],
  },
];

async function main() {
  const outDir = join(process.cwd(), "public", "og");
  await mkdir(outDir, { recursive: true });

  for (const item of OUTPUT) {
    const data = normalizeOgCardData({
      variant: item.variant,
      title: SOCIAL_CARD_TEMPLATES[item.variant].defaultTitle,
      ...(item.subtitle ? { subtitle: item.subtitle } : {}),
      ...(item.experienceName ? { experienceName: item.experienceName } : {}),
      ...(item.archetype ? { archetype: item.archetype } : {}),
      imageSeed: item.seed || `static-${item.variant}`,
      ...(item.energySamples ? { energySamples: item.energySamples } : {}),
    });
    const res = await renderOgCardResponse(data, {
      cacheControl: "public, max-age=31536000, immutable",
    });
    if (!res.ok || res.status === 302) {
      throw new Error(`Failed to render ${item.file}: status ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const dest = join(outDir, item.file);
    await writeFile(dest, buf);
    console.log(`wrote ${item.file} (${buf.length} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
