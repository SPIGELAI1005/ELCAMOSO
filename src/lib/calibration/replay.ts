import type { CalibrationTrace, CalibrationTraceSample } from "@/lib/calibration/types";
import { buildCalibrationTrace } from "@/lib/calibration/serialize";
import { IDLE_VEHICLE_MOTION, type VehicleMotionState } from "@/lib/motion/types";
import { PowertrainSimulator } from "@/lib/powertrain/simulator";
import { getPowertrainProfile } from "@/lib/powertrain/profiles";
import { powertrainProfileForSound } from "@/lib/powertrain/adapters/profile-map";
import { getProfile } from "@/lib/sound/profiles";
import { seedAudioRandom } from "@/lib/sound/rng";

export interface CalibrationReplayOptions {
  /** Sound profile id — selects powertrain personality. */
  profileId: string;
  /** Fixed dt when re-simulating (seconds). */
  dt?: number;
  /** Seed for deterministic audio variety during A/B. */
  audioSeed?: number;
  /**
   * When true, re-run PowertrainSimulator from speed/demand inputs.
   * When false, use recorded gear/RPM as-is (audio-only A/B).
   */
  resimulatePowertrain?: boolean;
}

export interface CalibrationReplayResult {
  input: CalibrationTrace;
  output: CalibrationTrace;
  samples: CalibrationTraceSample[];
}

function motionFromSample(s: CalibrationTraceSample, timestamp: number): VehicleMotionState {
  return {
    ...IDLE_VEHICLE_MOTION,
    timestamp,
    speedKmh: s.fusedSpeedKmh || s.speedKmh,
    accelerationMs2: s.accelerationMs2,
    accelerationFiltered: s.accelerationFilteredMs2,
    decelerationMs2: Math.max(0, -s.accelerationFilteredMs2),
    inferredThrottle: s.driverDemand,
    motionConfidence: s.motionConfidence || 1,
    primarySource: (s.motionSource as VehicleMotionState["primarySource"]) || "simulator",
    sourceHealth: { phone: false, browser: false, vehicleTelemetry: false },
    fallbackTier: (s.fallbackTier as VehicleMotionState["fallbackTier"]) || "decay",
    transitioning: s.transitioning,
  };
}

/**
 * Deterministic powertrain replay from a calibration trace.
 * Same trace + personality + settings → same gear/RPM/demand sequence.
 */
export function replayCalibrationTrace(
  trace: CalibrationTrace,
  opts: CalibrationReplayOptions,
): CalibrationReplayResult {
  const dt = opts.dt ?? 0.05;
  const resim = opts.resimulatePowertrain !== false;
  if (opts.audioSeed != null) seedAudioRandom(opts.audioSeed);

  const sound = getProfile(opts.profileId);
  const ptProfile = powertrainProfileForSound(sound) ?? getPowertrainProfile("gt-v8");
  const sim = new PowertrainSimulator({ profile: ptProfile });

  const outSamples: CalibrationTraceSample[] = [];

  if (!resim) {
    // Passthrough recorded states — useful for audio A/B without re-shifting.
    return {
      input: trace,
      output: buildCalibrationTrace(
        trace.samples,
        {
          ...trace.meta,
          profileId: opts.profileId,
          label: `${trace.meta.label} (playback)`,
        },
        trace.markers,
        `${trace.id}-play`,
      ),
      samples: [...trace.samples],
    };
  }

  let clock = 0;
  for (const s of trace.samples) {
    clock = s.tMs;
    const motion = motionFromSample(s, clock);
    const out = sim.tick(motion, dt, {
      directThrottle: s.driverDemand,
      braking: s.braking,
    });
    outSamples.push({
      ...s,
      tMs: s.tMs,
      gear: out.gear,
      targetGear: out.targetGear,
      queuedTargetGear: out.queuedTargetGear,
      rpm: out.rpm,
      mechanicalRpm: out.mechanicalRpm,
      shifting: out.shifting,
      shiftPhase: out.shiftPhase ?? "idle",
      shiftProgress: out.shiftProgress ?? 0,
      shiftDirection: out.shiftDirection ?? null,
      lastShiftReason: out.lastShiftReason ?? "none",
      driverDemand: out.driverDemand,
      engineLoad: out.engineLoad,
      overrun: out.overrun,
      mechanicalSpeedKmh: out.diagnostics?.mechanicalSpeedKmh ?? s.mechanicalSpeedKmh,
      shiftDecisionSpeedKmh: out.diagnostics?.shiftDecisionSpeedKmh ?? s.shiftDecisionSpeedKmh,
      fusedSpeedKmh: out.diagnostics?.displaySpeedKmh ?? s.fusedSpeedKmh,
      powertrainBackend: "dynamic",
    });
  }

  const output = buildCalibrationTrace(
    outSamples,
    {
      ...trace.meta,
      profileId: opts.profileId,
      personalityId: ptProfile.id,
      label: `${trace.meta.label} → ${opts.profileId}`,
      origin: "import",
    },
    trace.markers,
    `${trace.id}-replay`,
  );

  return { input: trace, output, samples: outSamples };
}
