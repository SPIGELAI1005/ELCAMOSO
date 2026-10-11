export { isDriveAudioV3Enabled } from "@/lib/sound/realism/v3/flag";
export {
  RAW_MECHANICAL_PILOT_IDS,
  isRawMechanicalPilotId,
  rawMechanicalPresetFor,
  extendRawMechanicalPreset,
  type RawMechanicalPilotId,
  type RawMechanicalPreset,
} from "@/lib/sound/realism/v3/raw-mechanical-presets";
export {
  firingHzFourStroke,
  firingHzTwoStroke,
  crankHzFromRpm,
  belowNyquist,
  pulseWidthSeconds,
  seededUnit,
  cycleVariation,
  mildSaturationCurve,
  shouldPreferOversampling,
  resolveRawMechanicalQualityTier,
  RAW_DIAGNOSTIC_BANDS_HZ,
  type RawMechanicalQualityTier,
} from "@/lib/sound/realism/v3/pulse-primitives";
