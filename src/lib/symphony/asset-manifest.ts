import type { StemId, SymphonyPack, SymphonyPackStemDef } from "./types";

export type SymphonyAssetSource =
  "procedural_placeholder" | "original" | "commissioned" | "licensed";

export type CommercialUseStatus = "approved" | "pending" | "development_only" | "rejected";

export interface SymphonyAssetManifestEntry {
  assetId: string;
  pack: string;
  instrument: StemId;
  variation: string;
  bpm: number;
  key: string;
  bars: number;
  version: string;
  copyrightOwner: string;
  license: string;
  source: SymphonyAssetSource;
  commercialUseStatus: CommercialUseStatus;
  assetPath: string | null;
  sampleRate: number | null;
  durationSeconds: number | null;
  peakDb: number | null;
  rmsDb: number | null;
}

export interface SymphonyAssetAudit {
  entries: SymphonyAssetManifestEntry[];
  errors: string[];
  warnings: string[];
  productionReady: boolean;
}

export function developmentSymphonyStem(
  packId: string,
  id: StemId,
  label: string,
  procedural: SymphonyPackStemDef["procedural"],
): SymphonyPackStemDef {
  return {
    id,
    label,
    procedural,
    manifest: {
      assetId: `${packId}.${id}.development`,
      variation: "development",
      version: "0.1.0-dev",
      copyrightOwner: "ELCAMOSO project",
      license: "Development use only",
      source: "procedural_placeholder",
      commercialUseStatus: "development_only",
      sampleRate: null,
      durationSeconds: null,
      peakDb: null,
      rmsDb: null,
    },
  };
}

export function createSymphonyAssetManifest(pack: SymphonyPack): SymphonyAssetManifestEntry[] {
  return pack.stems.map((stem) => ({
    assetId: stem.manifest.assetId,
    pack: pack.id,
    instrument: stem.id,
    variation: stem.manifest.variation,
    bpm: pack.bpm,
    key: pack.key,
    bars: pack.barsPerLoop,
    version: stem.manifest.version,
    copyrightOwner: stem.manifest.copyrightOwner,
    license: stem.manifest.license,
    source: stem.manifest.source,
    commercialUseStatus: stem.manifest.commercialUseStatus,
    assetPath: stem.assetPath ?? null,
    sampleRate: stem.manifest.sampleRate,
    durationSeconds: stem.manifest.durationSeconds,
    peakDb: stem.manifest.peakDb,
    rmsDb: stem.manifest.rmsDb,
  }));
}

export function auditSymphonyAssets(pack: SymphonyPack): SymphonyAssetAudit {
  const entries = createSymphonyAssetManifest(pack);
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set<string>();
  const expectedDuration = (pack.barsPerLoop * pack.beatsPerBar * 60) / pack.bpm;

  for (const entry of entries) {
    const prefix = `${pack.id}/${entry.instrument}`;
    if (!entry.assetId.trim()) errors.push(`${prefix}: missing asset id`);
    if (ids.has(entry.assetId)) errors.push(`${prefix}: duplicate asset id ${entry.assetId}`);
    ids.add(entry.assetId);
    if (!entry.variation.trim()) errors.push(`${prefix}: missing variation`);
    if (!entry.version.trim()) errors.push(`${prefix}: missing version`);
    if (!entry.copyrightOwner.trim()) errors.push(`${prefix}: missing copyright owner`);
    if (!entry.license.trim()) errors.push(`${prefix}: missing license`);

    if (!entry.assetPath) errors.push(`${prefix}: no production asset path`);
    if (entry.source === "procedural_placeholder") {
      errors.push(`${prefix}: procedural placeholder is development-only`);
    }
    if (entry.commercialUseStatus !== "approved") {
      errors.push(`${prefix}: commercial-use status is ${entry.commercialUseStatus}`);
    }
    if (entry.sampleRate !== 48_000) {
      errors.push(`${prefix}: sample rate must be 48000 Hz`);
    }
    if (entry.durationSeconds === null) {
      errors.push(`${prefix}: duration analysis is missing`);
    } else if (Math.abs(entry.durationSeconds - expectedDuration) > 0.02) {
      errors.push(
        `${prefix}: duration ${entry.durationSeconds.toFixed(3)}s is not aligned to ${expectedDuration.toFixed(3)}s`,
      );
    }
    if (entry.peakDb === null || entry.rmsDb === null) {
      errors.push(`${prefix}: peak/RMS analysis is missing`);
    } else {
      if (entry.peakDb > -1) warnings.push(`${prefix}: less than 1 dB peak headroom`);
      if (entry.rmsDb > -8) warnings.push(`${prefix}: unusually high RMS level`);
    }
  }

  if (entries.length !== pack.stems.length) {
    errors.push(`${pack.id}: manifest does not cover every stem`);
  }

  return { entries, errors, warnings, productionReady: errors.length === 0 };
}

export function isSymphonyPackProductionReady(pack: SymphonyPack): boolean {
  return auditSymphonyAssets(pack).productionReady;
}
