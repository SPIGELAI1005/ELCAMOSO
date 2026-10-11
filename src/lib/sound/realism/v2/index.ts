export {
  acousticEngineForProfile,
  acousticEngineBaseForProfile,
  isCombustionRealismV2Profile,
  firingHzFromRpm,
  ACOUSTIC_ENGINE_BY_PROFILE,
  type AcousticEngineConfig,
  type ArchitectureCode,
  type FiringOrderArchetype,
} from "@/lib/sound/realism/v2/acoustic-engine";
export {
  ARCHITECTURE_CONTRACT_VERSION,
  ARCHITECTURE_CODE_MAX,
  ARCHITECTURE_LABELS_V1,
  architectureCodeForArchetype,
  halfOrderWeightForArchitectureCode,
  RALLY_TURBO_3_LOPE_SHORTCUT,
  type ArchitectureCodeV1,
  type FiringOrderArchetype as ArchitectureFiringOrderArchetype,
} from "@/lib/sound/realism/v2/architecture-contract";
export {
  buildOrderBandSpec,
  buildLegacyOrderBandSpec,
  isProfileOrderBandsEnabled,
} from "@/lib/sound/realism/v2/profile-order-bands";
export {
  isCombustionTopologyPilotEnabled,
  combustionTopologyForProfile,
  validateCombustionTopology,
  MUSCLE_V8_TOPOLOGY,
  FLAT_PLANE_V8_TOPOLOGY,
  type CombustionTopologyV1,
} from "@/lib/sound/realism/v2/combustion-topology";
export {
  HybridCombustionSynth,
  type HybridCombustionDiagnostics,
  type HybridBuildOptions,
  type RealismEngineMode,
} from "@/lib/sound/realism/v2/hybrid-combustion-synth";
export {
  ensureCombustionWorklet,
  createCombustionExcitation,
  isCombustionWorkletReady,
} from "@/lib/sound/realism/v2/combustion-excitation";
export {
  EMPTY_COMBUSTION_SAMPLE_BANKS,
  selectSampleNeighbors,
  loadRegionFromDemand,
  playbackRateForRpm,
  SAMPLE_RATE_MIN,
  SAMPLE_RATE_MAX,
  type CombustionSampleBank,
  type CombustionSampleEntry,
  type SampleLoadRegion,
} from "@/lib/sound/realism/v2/sample-bank";
