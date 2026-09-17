export {
  acousticEngineForProfile,
  isCombustionRealismV2Profile,
  firingHzFromRpm,
  ACOUSTIC_ENGINE_BY_PROFILE,
  type AcousticEngineConfig,
  type FiringOrderArchetype,
} from "@/lib/sound/realism/v2/acoustic-engine";
export {
  HybridCombustionSynth,
  type HybridCombustionDiagnostics,
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
