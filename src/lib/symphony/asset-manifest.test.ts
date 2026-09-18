import { describe, expect, it } from "vitest";
import { listSymphonyPacks } from "./experience-pack";
import { auditSymphonyAssets, createSymphonyAssetManifest } from "./asset-manifest";

describe("Symphony per-asset governance", () => {
  it("creates a complete manifest entry for every declared stem", () => {
    for (const pack of listSymphonyPacks()) {
      const manifest = createSymphonyAssetManifest(pack);
      expect(manifest).toHaveLength(pack.stems.length);
      expect(new Set(manifest.map((asset) => asset.assetId)).size).toBe(manifest.length);
      for (const asset of manifest) {
        expect(asset.pack).toBe(pack.id);
        expect(asset.bpm).toBe(pack.bpm);
        expect(asset.key).toBe(pack.key);
        expect(asset.bars).toBe(pack.barsPerLoop);
        expect(asset.copyrightOwner).not.toBe("");
        expect(asset.license).not.toBe("");
      }
    }
  });

  it("blocks all current development placeholders from production", () => {
    for (const pack of listSymphonyPacks()) {
      const audit = auditSymphonyAssets(pack);
      expect(audit.productionReady).toBe(false);
      expect(audit.errors.some((error) => error.includes("development-only"))).toBe(true);
      expect(audit.errors.some((error) => error.includes("no production asset path"))).toBe(true);
    }
  });

  it("accepts a pack only after every asset has approved provenance and analysis", () => {
    const source = listSymphonyPacks()[0]!;
    const durationSeconds = (source.barsPerLoop * source.beatsPerBar * 60) / source.bpm;
    const productionPack = {
      ...source,
      licensing: {
        source: "original" as const,
        notes: "Original ELCAMOSO pack with reviewed per-asset records.",
        version: "1.0.0",
      },
      stems: source.stems.map((stem, index) => ({
        ...stem,
        assetPath: `/audio/symphony/${source.id}/${stem.id}.wav`,
        manifest: {
          ...stem.manifest,
          assetId: `${source.id}.${stem.id}.main`,
          variation: index === 0 ? "main" : `main-${index}`,
          version: "1.0.0",
          license: "ELCAMOSO proprietary",
          source: "original" as const,
          commercialUseStatus: "approved" as const,
          sampleRate: 48_000,
          durationSeconds,
          peakDb: -3,
          rmsDb: -16,
        },
      })),
    };

    expect(auditSymphonyAssets(productionPack)).toMatchObject({
      productionReady: true,
      errors: [],
    });
  });
});
