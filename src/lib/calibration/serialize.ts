import {
  CALIBRATION_TRACE_KIND,
  CALIBRATION_TRACE_VERSION,
  createEmptySample,
  type CalibrationMarker,
  type CalibrationTrace,
  type CalibrationTraceMeta,
  type CalibrationTraceSample,
} from "@/lib/calibration/types";
import type { DriveDiagnosticsFrame } from "@/lib/diagnostics/types";
import type { DriveState } from "@/lib/drive/model";
import type { VehicleMotionState } from "@/lib/motion/types";

const LOCATION_KEYS = new Set([
  "latitude",
  "longitude",
  "lat",
  "lng",
  "heading",
  "altitude",
  "coordinates",
]);

function stripLocation(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stripLocation);
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (LOCATION_KEYS.has(key)) continue;
    out[key] = stripLocation(child);
  }
  return out;
}

export function sampleFromLive(
  tMs: number,
  motion: VehicleMotionState,
  drive: DriveState,
  opts?: { braking?: number; prevAccel?: number; dt?: number },
): CalibrationTraceSample {
  const pt = drive.powertrain;
  const diag = pt?.diagnostics;
  const dt = Math.max(0.001, opts?.dt ?? 0.05);
  const prevAccel = opts?.prevAccel ?? motion.accelerationFiltered;
  const jerk = (motion.accelerationFiltered - prevAccel) / dt;
  const base = createEmptySample(tMs);
  return {
    ...base,
    speedKmh: motion.speedKmh,
    rawSpeedKmh: diag?.rawSpeedKmh ?? motion.speedKmh,
    fusedSpeedKmh: diag?.displaySpeedKmh ?? motion.speedKmh,
    mechanicalSpeedKmh: diag?.mechanicalSpeedKmh ?? null,
    shiftDecisionSpeedKmh: diag?.shiftDecisionSpeedKmh ?? null,
    accelerationMs2: motion.accelerationMs2,
    accelerationFilteredMs2: motion.accelerationFiltered,
    jerk,
    driverDemand: pt?.driverDemand ?? drive.throttle,
    engineLoad: pt?.engineLoad ?? drive.load,
    braking: opts?.braking ?? Math.max(0, drive.regen),
    motionSource: motion.primarySource,
    motionConfidence: motion.motionConfidence,
    fallbackTier: motion.fallbackTier,
    transitioning: motion.transitioning,
    gear: pt?.gear ?? drive.gear,
    targetGear: pt?.targetGear ?? drive.gear,
    queuedTargetGear: pt?.queuedTargetGear ?? drive.gear,
    rpm: pt?.rpm ?? drive.rpm,
    mechanicalRpm: pt?.mechanicalRpm ?? drive.rpm,
    shifting: pt?.shifting ?? drive.isShifting,
    shiftPhase: pt?.shiftPhase ?? "idle",
    shiftProgress: pt?.shiftProgress ?? 0,
    shiftDirection: pt?.shiftDirection ?? null,
    lastShiftReason: pt?.lastShiftReason ?? "none",
    overrun: pt?.overrun ?? false,
    powertrainBackend: drive.powertrainBackend ?? diag?.powertrainBackend ?? "unknown",
  };
}

export function sampleFromDiagnosticsFrame(
  tMs: number,
  frame: DriveDiagnosticsFrame,
): CalibrationTraceSample {
  const p = frame.powertrain;
  const f = frame.fusion;
  return {
    ...createEmptySample(tMs),
    speedKmh: f.speedKmh,
    rawSpeedKmh: p.rawSpeedKmh,
    fusedSpeedKmh: p.displaySpeedKmh ?? f.speedKmh,
    mechanicalSpeedKmh: p.mechanicalSpeedKmh,
    shiftDecisionSpeedKmh: p.shiftDecisionSpeedKmh,
    accelerationMs2: frame.motion.accelerationRawMs2,
    accelerationFilteredMs2: f.accelerationMs2,
    jerk: 0,
    driverDemand: p.driverDemand ?? p.throttle,
    engineLoad: p.engineLoad ?? p.load,
    braking: p.braking ?? 0,
    motionSource: f.primarySource,
    motionConfidence: f.confidence,
    fallbackTier: f.fallbackTier,
    transitioning: f.transitioning,
    gear: p.gear,
    targetGear: p.targetGear ?? p.gear,
    queuedTargetGear: p.queuedTargetGear ?? p.gear,
    rpm: p.rpm,
    mechanicalRpm: p.mechanicalRpm ?? p.rpm,
    shifting: p.shifting,
    shiftPhase: p.shiftPhase ?? "idle",
    shiftProgress: p.shiftProgress ?? 0,
    shiftDirection: (p.shiftDirection as "up" | "down" | null) ?? null,
    lastShiftReason: p.lastShiftReason ?? "none",
    overrun: false,
    powertrainBackend: p.powertrainBackend,
  };
}

export function buildCalibrationTrace(
  samples: CalibrationTraceSample[],
  meta: CalibrationTraceMeta,
  markers: CalibrationMarker[] = [],
  id = `cal-${Date.now().toString(36)}`,
): CalibrationTrace {
  const durationMs = samples.length
    ? Math.max(0, samples[samples.length - 1]!.tMs - samples[0]!.tMs)
    : 0;
  return {
    kind: CALIBRATION_TRACE_KIND,
    version: CALIBRATION_TRACE_VERSION,
    id,
    meta,
    samples: samples.map((s) => stripLocation(s) as CalibrationTraceSample),
    markers: markers.map((m) => ({ ...m })),
    durationMs,
  };
}

export function parseCalibrationTrace(raw: unknown): CalibrationTrace {
  if (!raw || typeof raw !== "object") throw new Error("Not a calibration trace.");
  const o = raw as Record<string, unknown>;
  if (o["kind"] !== CALIBRATION_TRACE_KIND) {
    throw new Error("Wrong file kind — expected elcamoso.calibration.trace.");
  }
  const version = Number(o["version"] ?? 0);
  if (version !== CALIBRATION_TRACE_VERSION) {
    throw new Error(`Unsupported calibration trace version ${version}.`);
  }
  if (!Array.isArray(o["samples"])) throw new Error("Trace has no samples.");
  const meta = o["meta"] as CalibrationTraceMeta;
  if (!meta || typeof meta.profileId !== "string") throw new Error("Trace meta incomplete.");
  return stripLocation(o) as CalibrationTrace;
}

export function downloadCalibrationTrace(trace: CalibrationTrace) {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(trace, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  a.download = `elcamoso-calibration-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Strip location keys and keep only fields needed for gearbox regression. */
export function sanitizeTraceForFixture(
  trace: CalibrationTrace,
  maxSamples = 2500,
): CalibrationTrace {
  const step = Math.max(1, Math.ceil(trace.samples.length / maxSamples));
  const samples = trace.samples
    .filter((_, i) => i % step === 0)
    .map((s) => ({
      tMs: s.tMs,
      speedKmh: round3(s.speedKmh),
      rawSpeedKmh: s.rawSpeedKmh == null ? null : round3(s.rawSpeedKmh),
      fusedSpeedKmh: round3(s.fusedSpeedKmh),
      mechanicalSpeedKmh: s.mechanicalSpeedKmh == null ? null : round3(s.mechanicalSpeedKmh),
      shiftDecisionSpeedKmh:
        s.shiftDecisionSpeedKmh == null ? null : round3(s.shiftDecisionSpeedKmh),
      accelerationMs2: round3(s.accelerationMs2),
      accelerationFilteredMs2: round3(s.accelerationFilteredMs2),
      jerk: round3(s.jerk),
      driverDemand: round3(s.driverDemand),
      engineLoad: round3(s.engineLoad),
      braking: round3(s.braking),
      motionSource: s.motionSource,
      motionConfidence: round3(s.motionConfidence),
      fallbackTier: s.fallbackTier,
      transitioning: s.transitioning,
      gear: s.gear,
      targetGear: s.targetGear,
      queuedTargetGear: s.queuedTargetGear,
      rpm: round3(s.rpm),
      mechanicalRpm: round3(s.mechanicalRpm),
      shifting: s.shifting,
      shiftPhase: s.shiftPhase,
      shiftProgress: round3(s.shiftProgress),
      shiftDirection: s.shiftDirection,
      lastShiftReason: s.lastShiftReason,
      overrun: s.overrun,
      powertrainBackend: s.powertrainBackend,
    }));
  return buildCalibrationTrace(
    samples,
    { ...trace.meta, origin: "import", recordedAt: "fixture" },
    [],
    trace.id,
  );
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

export function driveStateFromCalibrationSample(
  sample: CalibrationTraceSample,
  previous?: DriveState,
): DriveState {
  const speedMps = sample.speedKmh / 3.6;
  const backend = sample.powertrainBackend === "unknown" ? "legacy" : sample.powertrainBackend;
  return {
    speed: speedMps,
    acceleration: sample.accelerationFilteredMs2,
    throttle: sample.driverDemand,
    regen: sample.braking,
    rpm: sample.rpm,
    gear: sample.gear,
    load: sample.engineLoad,
    timestamp: sample.tMs,
    jerk: sample.jerk,
    isShifting: sample.shifting,
    speedNormalized: Math.min(1, sample.speedKmh / 160),
    accelerationNormalized: Math.min(1, Math.abs(sample.accelerationFilteredMs2) / 4.5),
    powertrainBackend: backend,
    powertrain: {
      timestamp: sample.tMs,
      engineRunning: sample.gear > 0 || sample.rpm > 0,
      rpm: sample.rpm,
      mechanicalRpm: sample.mechanicalRpm,
      normalizedRpm: Math.min(1, sample.rpm / 8000),
      gear: sample.gear,
      targetGear: sample.targetGear,
      queuedTargetGear: sample.queuedTargetGear,
      driverDemand: sample.driverDemand,
      engineLoad: sample.engineLoad,
      throttle: sample.driverDemand,
      load: sample.engineLoad,
      shifting: sample.shifting,
      shiftPhase: sample.shiftPhase as never,
      shiftProgress: sample.shiftProgress,
      ...(sample.shiftDirection ? { shiftDirection: sample.shiftDirection } : {}),
      lastShiftReason: sample.lastShiftReason,
      overrun: sample.overrun,
      revMatchActive: previous?.powertrain?.revMatchActive ?? false,
      revMatchProgress: previous?.powertrain?.revMatchProgress ?? 0,
      drivingMode: sample.overrun ? "overrun" : sample.shifting ? "shift" : "cruise",
      diagnostics: {
        powertrainBackend: backend,
        displaySpeedKmh: sample.fusedSpeedKmh,
        mechanicalSpeedKmh: sample.mechanicalSpeedKmh ?? sample.fusedSpeedKmh,
        rawSpeedKmh: sample.rawSpeedKmh ?? sample.speedKmh,
        shiftDecisionSpeedKmh: sample.shiftDecisionSpeedKmh ?? sample.fusedSpeedKmh,
        braking: sample.braking,
        motionSource: sample.motionSource,
        fallbackTier: sample.fallbackTier,
      },
    },
  };
}
