import { IDLE_STATE, type DriveState } from "@/lib/drive/model";
import type { DriveTrace } from "@/lib/drive/traces";
import { summarise } from "@/lib/drive/traces";
import type { JourneyTraceV1 } from "@/lib/journey-trace";
import { experienceForProfileId } from "@/lib/experiences";
import { getSymphonyPack, isSymphonyProfileId } from "@/lib/symphony";
import { isFusionProfileId, getFusionPreset } from "@/lib/fusion";
import { isWorldProfileId } from "@/lib/worlds";
import { computeDriveDna } from "./drive-dna";
import type {
  ArrangementMarker,
  GearMarker,
  JourneyExperienceKind,
  JourneySummary,
  SemanticMarker,
  TimelinePoint,
} from "./types";

const MAX_ENERGY_POINTS = 120;

function experienceKindFor(profileId: string): JourneyExperienceKind {
  if (isFusionProfileId(profileId)) return "fusion";
  if (isSymphonyProfileId(profileId)) return "symphony";
  if (isWorldProfileId(profileId) || profileId.startsWith("world-")) return "world";
  return "engine";
}

function resolveSymphonyPack(profileId: string): string | null {
  if (isSymphonyProfileId(profileId)) return getSymphonyPack(profileId)?.id ?? profileId;
  if (isFusionProfileId(profileId)) {
    const p = getFusionPreset(profileId);
    return p?.symphonyProfileId ?? "symphony-cinematic-rock";
  }
  return null;
}

function roughEnergy(s: DriveState): number {
  return Math.min(
    1,
    s.load * 0.45 +
      s.throttle * 0.4 +
      s.speedNormalized * 0.25 +
      Math.max(0, s.accelerationNormalized) * 0.2,
  );
}

/**
 * Build a privacy-first JourneySummary from a local DriveTrace.
 * Trace samples are motion-only (no lat/lon in DriveState).
 * This function never copies coordinates even if a future trace adds them.
 */
export function summariseJourneyFromTrace(
  trace: DriveTrace,
  opts?: { seed?: number },
): JourneySummary {
  const samples = trace.samples;
  const durationMs = trace.durationMs;
  const durationSec = Math.max(1, durationMs / 1000);
  const seed = opts?.seed ?? trace.startedAt & 0xffff;

  // Downsample energy - never store raw GPS fields
  const step = Math.max(1, Math.floor(samples.length / MAX_ENERGY_POINTS));
  const energyTimeline: TimelinePoint[] = [];
  const arrangementTimeline: ArrangementMarker[] = [];
  const gearChanges: GearMarker[] = [];
  const semanticEvents: SemanticMarker[] = [];
  const energyPeaks: number[] = [];
  const cruisePeriods: { startSec: number; endSec: number }[] = [];
  const regenPeriods: { startSec: number; endSec: number }[] = [];

  let cruiseStart: number | null = null;
  let regenStart: number | null = null;
  let prevGear = samples[0]?.gear ?? 0;
  let peakCandidate = 0;

  for (let i = 0; i < samples.length; i += step) {
    const s = samples[i]!;
    const t =
      samples[0] && s.timestamp && samples[0].timestamp
        ? (s.timestamp - samples[0].timestamp) / 1000
        : (i / Math.max(1, samples.length - 1)) * durationSec;
    const e = roughEnergy(s);
    energyTimeline.push({ t: Math.round(t * 10) / 10, energy: Math.round(e * 1000) / 1000 });

    const movement =
      s.speed < 0.5
        ? "stopped"
        : s.regen > 0.35
          ? "decelerating"
          : e > 0.72
            ? "peak"
            : e > 0.55
              ? "energetic"
              : e > 0.35
                ? "building"
                : e > 0.18
                  ? "cruise"
                  : "calm";
    arrangementTimeline.push({ t: Math.round(t * 10) / 10, movementState: movement });

    if (e > 0.75) {
      if (e >= peakCandidate) {
        peakCandidate = e;
        energyPeaks.push(Math.round(t * 10) / 10);
      }
    } else {
      peakCandidate = 0;
    }

    const cruising =
      s.speed > 5 && s.throttle < 0.35 && s.regen < 0.2 && Math.abs(s.acceleration) < 0.8;
    if (cruising && cruiseStart === null) cruiseStart = t;
    if (!cruising && cruiseStart !== null) {
      cruisePeriods.push({ startSec: cruiseStart, endSec: t });
      cruiseStart = null;
    }

    if (s.regen > 0.25 && regenStart === null) regenStart = t;
    if (s.regen <= 0.2 && regenStart !== null) {
      regenPeriods.push({ startSec: regenStart, endSec: t });
      regenStart = null;
    }

    if (s.gear && prevGear && s.gear !== prevGear) {
      gearChanges.push({
        t: Math.round(t * 10) / 10,
        gear: s.gear,
        direction: s.gear > prevGear ? "up" : "down",
      });
      semanticEvents.push({
        t: Math.round(t * 10) / 10,
        type: s.gear > prevGear ? "upshift" : "downshift",
      });
    }
    prevGear = s.gear || prevGear;
  }

  if (cruiseStart !== null) cruisePeriods.push({ startSec: cruiseStart, endSec: durationSec });
  if (regenStart !== null) regenPeriods.push({ startSec: regenStart, endSec: durationSec });

  // Cap peaks / periods for storage
  const peaks = energyPeaks
    .filter((_, i) => i % Math.max(1, Math.floor(energyPeaks.length / 8)) === 0)
    .slice(0, 8);

  let distanceM: number | null = null;
  if (samples.length > 1) {
    let d = 0;
    for (let i = 1; i < samples.length; i++) {
      const dt =
        Math.max(0, (samples[i]!.timestamp - samples[i - 1]!.timestamp) / 1000) ||
        durationSec / samples.length;
      d += samples[i]!.speed * Math.min(dt, 1);
    }
    distanceM = Math.round(d);
  }

  const exp = experienceForProfileId(trace.profileId);
  const dna = computeDriveDna({
    energyTimeline,
    throttleShare: trace.aggregates.throttleShare,
    regenShare: trace.aggregates.regenShare,
    durationMs,
    meanSpeedMps: trace.aggregates.meanSpeedMps,
  });

  return {
    id: `journey-${trace.startedAt}`,
    createdAt: trace.startedAt,
    durationMs,
    distanceM,
    profileId: trace.profileId,
    experienceKind: experienceKindFor(trace.profileId),
    experienceName: exp.name,
    symphonyPackId: resolveSymphonyPack(trace.profileId),
    seed,
    energyTimeline,
    semanticEvents: semanticEvents.slice(0, 80),
    gearChanges: gearChanges.slice(0, 60),
    energyPeaks: peaks,
    cruisePeriods: cruisePeriods.slice(0, 24),
    regenPeriods: regenPeriods.slice(0, 24),
    arrangementTimeline: arrangementTimeline.slice(0, MAX_ENERGY_POINTS),
    dna,
    song: null,
    reel: null,
    shareId: null,
  };
}

/**
 * Adapt a Silent Capture JourneyTrace into the existing Journey Composer input.
 * The resulting summary keeps the trace's id, so Drive Song enriches the same
 * Journey rather than creating a second one.
 */
export function summariseJourneyFromJourneyTrace(
  trace: JourneyTraceV1,
  opts?: { profileId?: string; seed?: number },
): JourneySummary {
  const profileId = opts?.profileId ?? trace.captureProfileId ?? "gt-v8";
  const samples: DriveState[] = trace.samples.map((sample) => {
    const speed = sample.speedKmh / 3.6;
    const load = Math.min(1, sample.driverDemandEstimate * 0.65 + Math.min(1, speed / 45) * 0.25);
    return {
      ...IDLE_STATE,
      speed,
      acceleration: sample.acceleration,
      throttle: sample.driverDemandEstimate,
      regen: sample.regenEstimate,
      load,
      timestamp: trace.startedAt + sample.t,
      jerk: sample.jerk,
      speedNormalized: Math.min(1, sample.speedKmh / 160),
      accelerationNormalized: Math.min(1, Math.abs(sample.acceleration) / 4.5),
    };
  });
  const driveTrace: DriveTrace = {
    id: trace.journeyId,
    startedAt: trace.startedAt,
    durationMs: trace.durationMs,
    profileId,
    samples,
    aggregates: summarise(samples, trace.durationMs),
  };
  const summary = summariseJourneyFromTrace(driveTrace, {
    seed: opts?.seed ?? trace.startedAt & 0xffff,
  });
  return {
    ...summary,
    id: trace.journeyId,
    distanceM: Math.round(trace.summary.distanceM),
    semanticEvents: trace.semanticEvents.slice(0, 80).map((event) => ({
      t: Math.round((event.t / 1000) * 10) / 10,
      type: event.type,
    })),
  };
}

/** Guard: fail tests if any coordinate-like keys sneak into a summary JSON. */
export function journeyContainsCoordinates(summary: JourneySummary): boolean {
  const json = JSON.stringify(summary);
  return /latitude|longitude|"lat"|"lon"|"lng"|gps|routePath|polyline/i.test(json);
}
