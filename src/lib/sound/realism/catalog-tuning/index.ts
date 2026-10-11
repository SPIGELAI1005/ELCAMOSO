export type {
  AcousticTuningOverlay,
  CatalogAutomatedCheck,
  CatalogDeviceStatus,
  CatalogListeningStatus,
  CatalogOutcome,
  CatalogRendererKind,
  CatalogSampleStatus,
  CatalogTuningEntry,
  ExperienceTuningOverlay,
  ListeningRubricScores,
} from "@/lib/sound/realism/catalog-tuning/types";

export {
  FAMILY_DEFAULTS,
  type DesignFamilyHint,
  type FamilyDefaultBundle,
} from "@/lib/sound/realism/catalog-tuning/family-defaults";

export {
  CATALOG_TUNING_BY_PROFILE,
  allCatalogTuningEntries,
  catalogTuningForProfile,
  setCatalogAutomatedCheck,
  type CatalogTuningRecord,
} from "@/lib/sound/realism/catalog-tuning/by-profile";

export {
  applyAcousticCatalogTuning,
  applyExperienceCatalogTuning,
  mergeAcousticOverlay,
  mergeExperienceOverlay,
} from "@/lib/sound/realism/catalog-tuning/apply";

export { emptyListeningRubric } from "@/lib/sound/realism/catalog-tuning/listening-rubric";
