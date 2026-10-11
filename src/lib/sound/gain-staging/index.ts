export {
  BODY_CHARACTER_SHELF_DB,
  CHARACTER_NEUTRAL,
  DEFAULT_UI_VOLUME,
  MASTER_BUS_OUTPUT_GAIN,
  MASTER_LOAD_SCALE_FLOOR,
  MECHANICAL_CHARACTER_SCALE,
  OPTIONAL_COMPRESSOR_LOOKAHEAD_NOTE_MS,
  OUTPUT_BOOST_MAX_DB,
  PEAK_PROTECT_LOOKAHEAD_MS,
  SAMPLE_PEAK_CEILING_DBFS,
  SAMPLE_PEAK_CEILING_LINEAR,
  USER_STAGE_CEILING,
} from "@/lib/sound/gain-staging/constants";

export {
  clamp01,
  clampOutputBoostDb,
  computeUserStageLinearGain,
  dbToLinear,
  linearToDb,
  mildMasterLoadScale,
  samplePeakWithinCeiling,
  worstCasePreProtectGain,
  type UserStageGainInput,
} from "@/lib/sound/gain-staging/compute";

export {
  createPeakProtectStage,
  makeSamplePeakCeilingCurve,
  type PeakProtectStage,
} from "@/lib/sound/gain-staging/peak-protect";
