import type { VirtualPowertrainState } from "@/lib/powertrain/types";
import type { ResolvedDrivetrain } from "@/lib/drive/drivetrain-resolve";
import {
  RPM_BAND_CENTERS,
  type DynamicLayerId,
  type DynamicLayerWeights,
} from "@/lib/sound/dynamic-drive/types";
import type { ScheduledTransientLayers } from "@/lib/sound/dynamic-drive/transient-scheduler";

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

function bandWeight(rpmNorm: number, center: number, halfWidth: number): number {
  const d = Math.abs(rpmNorm - center) / Math.max(0.04, halfWidth);
  return Math.max(0, 1 - d * d);
}

function mergeScheduled(
  weights: DynamicLayerWeights,
  scheduled?: ScheduledTransientLayers,
): DynamicLayerWeights {
  if (!scheduled?.layers) return weights;
  const layers = scheduled.layers;
  return {
    ...weights,
    upshiftTransient: Math.max(weights.upshiftTransient, layers["dd-upshift"] ?? 0),
    downshiftTransient: Math.max(weights.downshiftTransient, layers["dd-downshift"] ?? 0),
    revMatchTransient: Math.max(weights.revMatchTransient, layers["dd-rev-match"] ?? 0),
    overrunTransient: Math.max(weights.overrunTransient, layers["dd-overrun"] ?? 0),
    exhaustPopTransient: Math.max(weights.exhaustPopTransient, layers["dd-exhaust-pop"] ?? 0),
    turboFlutterTransient: Math.max(weights.turboFlutterTransient, layers["dd-turbo-flutter"] ?? 0),
    wastegateTransient: Math.max(weights.wastegateTransient, layers["dd-wastegate"] ?? 0),
    drivetrainThumpTransient: Math.max(
      weights.drivetrainThumpTransient,
      layers["dd-drivetrain-thump"] ?? 0,
    ),
  };
}

/**
 * Compute crossfade weights from powertrain state and drivetrain personality config.
 * Optional scheduled transients (from transient scheduler) are merged on top of bell curves.
 */
export function computeDynamicLayerWeights(
  pt: VirtualPowertrainState,
  drivetrain: ResolvedDrivetrain,
  scheduled?: ScheduledTransientLayers,
): DynamicLayerWeights {
  const { personality, transient: t, powertrain } = drivetrain;
  const idleRpm = personality.engine.idleRpm;
  const redline = personality.engine.redlineRpm;
  const span = Math.max(1, redline - idleRpm);
  const rpmNorm = pt.normalizedRpm > 0 ? clamp(pt.normalizedRpm) : clamp((pt.rpm - idleRpm) / span);

  const bw = t.bandWidth;
  const idleBoost = pt.gear === 0 || pt.drivingMode === "idle" ? 1.15 : 0.9;
  const gearLowBias = pt.gear > 0 && pt.gear <= 2 ? 1.08 : pt.gear >= 5 ? 0.92 : 1;
  const idle = bandWeight(rpmNorm, RPM_BAND_CENTERS.idle, bw.idle) * idleBoost;
  const low = bandWeight(rpmNorm, RPM_BAND_CENTERS.low, bw.low) * gearLowBias;
  const mid = bandWeight(rpmNorm, RPM_BAND_CENTERS.mid, bw.mid);
  const high = bandWeight(rpmNorm, RPM_BAND_CENTERS.high, bw.high);
  const redlineW = bandWeight(rpmNorm, RPM_BAND_CENTERS.redline, bw.redline);

  // Deeper mid-shift duck so torque cut / ratio change reads as load drop, not noise.
  const shiftDuck = pt.shifting
    ? 1 - 0.28 * Math.sin(Math.PI * clamp(pt.shiftProgress ?? 0)) * (2 - (pt.shiftLoadMultiplier ?? 1))
    : 1;

  const steadySum = idle + low + mid + high + redlineW || 1;
  const norm = Math.min(1, 0.94 / steadySum);

  const highLoad =
    clamp((pt.load - t.highLoadThreshold) / Math.max(0.01, 1 - t.highLoadThreshold)) *
    (1 - (pt.shiftProgress ?? 0) * 0.35);

  let upshiftTransient = 0;
  let downshiftTransient = 0;
  let revMatchTransient = 0;
  if (pt.shifting) {
    const p = pt.shiftProgress ?? 0;
    const phase = pt.shiftPhase;
    // Emphasize torque_cut→disengage and reengage, not a flat progress bell.
    const phaseBell =
      phase === "torque_cut" || phase === "disengage"
        ? 0.85
        : phase === "ratio_transition"
          ? Math.sin(Math.PI * clamp((p - 0.36) / 0.36, 0, 1))
          : phase === "reengage"
            ? 1
            : Math.sin(Math.PI * clamp(p, 0, 1)) * 0.65;
    if (pt.shiftDirection === "up") upshiftTransient = phaseBell * t.upshiftStrength * 0.72;
    else if (pt.shiftDirection === "down") downshiftTransient = phaseBell * t.downshiftStrength * 0.65;
  }
  if (pt.revMatchActive && powertrain.transmission.shift.revMatchEnabled) {
    revMatchTransient = Math.max(
      revMatchTransient,
      pt.revMatchProgress * t.revMatchStrength * 0.45,
    );
  }

  const overrunTransient = pt.overrun
    ? clamp(t.overrunStrength * (0.45 + pt.throttle * 0.2 + (1 - rpmNorm) * 0.08))
    : 0;

  const base: DynamicLayerWeights = {
    idle: idle * norm * shiftDuck,
    low: low * norm * shiftDuck,
    mid: mid * norm * shiftDuck,
    high: high * norm * shiftDuck,
    redline: redlineW * norm * shiftDuck,
    highLoad,
    upshiftTransient,
    downshiftTransient,
    revMatchTransient,
    overrunTransient,
    exhaustPopTransient: 0,
    turboFlutterTransient: 0,
    wastegateTransient: 0,
    drivetrainThumpTransient: 0,
  };

  return mergeScheduled(base, scheduled);
}

export function fundamentalHzForLayer(
  layerId: string,
  pt: VirtualPowertrainState,
  drivetrain: ResolvedDrivetrain,
): number {
  const { personality, transient: t } = drivetrain;
  const idleRpm = personality.engine.idleRpm;
  const redline = personality.engine.redlineRpm;
  const span = Math.max(1, redline - idleRpm);
  const rpmNorm = clamp(pt.normalizedRpm || (pt.rpm - idleRpm) / span);

  const bandRpm = (center: number) => idleRpm + span * center;
  const rpmHz = (rpm: number) => Math.max(18, rpm / 60);

  switch (layerId) {
    case "dd-idle":
      return rpmHz(idleRpm * (0.92 + pt.throttle * 0.08));
    case "dd-low":
      return rpmHz(bandRpm(0.22) * (0.85 + rpmNorm * 0.2));
    case "dd-mid":
      return rpmHz(Math.max(pt.rpm, bandRpm(0.48)));
    case "dd-high":
      return rpmHz(Math.max(pt.rpm, bandRpm(0.72)));
    case "dd-redline":
      return rpmHz(Math.max(pt.rpm, bandRpm(0.92)));
    case "dd-high-load":
      return rpmHz(pt.rpm * (1 + pt.load * 0.04));
    case "dd-upshift":
      return rpmHz(pt.rpm * (1 - (pt.shiftProgress ?? 0) * t.upshiftPitchDrop));
    case "dd-downshift":
      return rpmHz(pt.rpm * (1 + (pt.shiftProgress ?? 0) * t.downshiftPitchFlare * 0.55));
    case "dd-rev-match":
      return rpmHz(pt.rpm * (1 + pt.revMatchProgress * t.downshiftPitchFlare));
    case "dd-overrun":
      return rpmHz(pt.rpm * (0.92 + pt.throttle * t.overrunPitchBias));
    case "dd-exhaust-pop":
      return rpmHz(Math.max(idleRpm, pt.rpm * 0.88));
    case "dd-turbo-flutter":
      return rpmHz(pt.rpm * (0.95 + pt.load * 0.06));
    case "dd-wastegate":
      return rpmHz(pt.rpm * (0.98 + pt.throttle * 0.04));
    case "dd-drivetrain-thump":
      return rpmHz(Math.max(idleRpm * 0.6, pt.rpm * 0.35));
    default:
      return rpmHz(pt.rpm || idleRpm);
  }
}

export function transientLayerGainScale(layerId: DynamicLayerId): number {
  switch (layerId) {
    case "dd-exhaust-pop":
    case "dd-wastegate":
      return 0.55;
    case "dd-turbo-flutter":
      return 0.6;
    case "dd-drivetrain-thump":
      return 0.65;
    case "dd-rev-match":
      return 0.7;
    default:
      return 0.75;
  }
}
