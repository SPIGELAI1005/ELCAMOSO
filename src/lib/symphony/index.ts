export type {
  DriveEnergyState,
  DriveEnergyWeights,
  MovementState,
  MusicClockSnapshot,
  QuantizeGrid,
  StemId,
  SymphonyDiagnostics,
  SymphonyPack,
  SymphonySemanticEvent,
} from "./types";
export {
  computeRawDriveEnergy,
  createDriveEnergyTracker,
  DEFAULT_ENERGY_CONFIG,
  DEFAULT_ENERGY_WEIGHTS,
} from "./drive-energy";
export { createMusicClock, beatDurationSec, barDurationSec, loopDurationSec } from "./music-clock";
export { createSymphonyEventBus } from "./events";
export { createArrangementEngine } from "./arrangement-engine";
export { getSymphonyPack, isSymphonyProfileId, listSymphonyPacks } from "./experience-pack";
export { SymphonySynth } from "./symphony-synth";
export {
  SYMPHONY_DEMO_SEQUENCE,
  demoStateAt,
  demoStepLabel,
  demoTotalDurationSec,
} from "./demo-sequence";
export { CINEMATIC_ROCK_PACK } from "./packs/cinematic-rock";
export { MOTION_ORCHESTRA_PACK } from "./packs/motion-orchestra";
export { NEON_RUN_PACK } from "./packs/neon-run";
export {
  SYMPHONY_LOAD_FAILURE_COPY,
  clearSymphonyBufferCache,
  getCachedSymphonyBuffers,
  loadSymphonyPackBuffers,
} from "./pack-loader";
export type { PackLoadProgress, StemBufferMap } from "./pack-loader";
export {
  auditSymphonyAssets,
  createSymphonyAssetManifest,
  isSymphonyPackProductionReady,
} from "./asset-manifest";
export type {
  CommercialUseStatus,
  SymphonyAssetAudit,
  SymphonyAssetManifestEntry,
  SymphonyAssetSource,
} from "./asset-manifest";
