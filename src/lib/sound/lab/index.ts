export {
  LAB_FIXTURES,
  SPEED_DRIVEN_FIXTURE_IDS,
  DIAGNOSTIC_FIXTURE_IDS,
  getLabFixture,
  materializeFixture,
  fixtureFingerprint,
  type LabFixture,
  type LabFixtureKind,
  type LabTelemetrySample,
} from "@/lib/sound/lab/fixtures";

export {
  analyseLabSignal,
  magnitudeSpectrumDb,
  LAB_BANDS_HZ,
  type LabSignalMetrics,
  type LabBandEnergy,
} from "@/lib/sound/lab/metrics";

export {
  LAB_HARNESS_REVISION,
  LAB_RENDERER_FAMILY,
  DEFAULT_LAB_LIMITATIONS,
  buildLabCaptureMetadata,
  assertLabCaptureMetadata,
  type LabCaptureMetadata,
  type LabCaptureResult,
  type LabCaptureSettings,
  type LabCapturePath,
} from "@/lib/sound/lab/capture-metadata";

export {
  LAB_SAMPLE_RATE,
  LAB_MEASUREMENT_VOLUME,
  LAB_DEFAULT_SEED,
  renderLabCapture,
  renderLabOffline,
  renderLabRealtime,
  levelMatchGainDb,
  type LabRenderOptions,
} from "@/lib/sound/lab/render-harness";

export {
  buildPendingBaselineReport,
  allPendingBaselineReports,
  attachCaptureToReport,
  type ProfileBaselineReport,
} from "@/lib/sound/lab/baseline-report";
