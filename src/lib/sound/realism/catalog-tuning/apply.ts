import type { AcousticEngineConfig } from "@/lib/sound/realism/v2/acoustic-engine";
import type { ProfileExperienceConfig } from "@/lib/sound/profile-experience-config";
import { catalogTuningForProfile } from "@/lib/sound/realism/catalog-tuning/by-profile";
import type { AcousticTuningOverlay, ExperienceTuningOverlay } from "@/lib/sound/realism/catalog-tuning/types";

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function clampPhase(n: number): number {
  return Math.min(2, Math.max(0, n));
}

/** Merge Prompt 07 acoustic overlays onto a base AcousticEngineConfig. */
export function applyAcousticCatalogTuning(
  profileId: string,
  base: AcousticEngineConfig,
): AcousticEngineConfig {
  const entry = catalogTuningForProfile(profileId);
  const overlay = entry?.acousticOverlay;
  if (!overlay) return base;
  return mergeAcousticOverlay(base, overlay);
}

export function mergeAcousticOverlay(
  base: AcousticEngineConfig,
  overlay: AcousticTuningOverlay,
): AcousticEngineConfig {
  const next: AcousticEngineConfig = { ...base };
  const scalarKeys = [
    "idleIrregularity",
    "exhaustPulse",
    "intakePresence",
    "mechanicalIntensity",
    "combustionSharpness",
    "highLoadEnrichment",
    "loadContrast",
    "upperRpmEnergy",
    "intakeLoadResponse",
    "overrunCharacter",
    "bodyBrightness",
  ] as const;
  for (const key of scalarKeys) {
    const v = overlay[key];
    if (typeof v === "number" && Number.isFinite(v)) next[key] = clamp01(v);
  }
  if (overlay.exhaustFormantsHz?.length) next.exhaustFormantsHz = [...overlay.exhaustFormantsHz];
  if (overlay.intakeFormantsHz?.length) next.intakeFormantsHz = [...overlay.intakeFormantsHz];
  if (overlay.bodyResonanceHz?.length) next.bodyResonanceHz = [...overlay.bodyResonanceHz];
  return next;
}

/** Merge Prompt 07 experience overlays onto a base ProfileExperienceConfig. */
export function applyExperienceCatalogTuning(
  profileId: string,
  base: ProfileExperienceConfig,
): ProfileExperienceConfig {
  const entry = catalogTuningForProfile(profileId);
  const overlay = entry?.experienceOverlay;
  if (!overlay) return base;
  return mergeExperienceOverlay(base, overlay);
}

export function mergeExperienceOverlay(
  base: ProfileExperienceConfig,
  overlay: ExperienceTuningOverlay,
): ProfileExperienceConfig {
  const phases = { ...base.phases };
  if (overlay.phases) {
    for (const [key, value] of Object.entries(overlay.phases)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        (phases as Record<string, number>)[key] = clampPhase(value);
      }
    }
  }
  const variation = { ...base.variation, ...overlay.variation };
  const aspirationDynamics = { ...base.aspirationDynamics, ...overlay.aspirationDynamics };
  return {
    ...base,
    phases,
    variation,
    aspirationDynamics,
    transitionTauSeconds:
      typeof overlay.transitionTauSeconds === "number" && Number.isFinite(overlay.transitionTauSeconds)
        ? Math.max(0.04, overlay.transitionTauSeconds)
        : base.transitionTauSeconds,
  };
}
