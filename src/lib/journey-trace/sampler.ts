import type {
  JourneyTraceGapV1,
  JourneyTraceSampleV1,
  JourneyTraceSemanticEventV1,
  JourneyTraceSummaryV1,
  JourneyTraceV1,
  TraceSensorSource,
} from "./types";
import type { VehicleMotionState } from "@/lib/motion/types";

const MIN_INTERVAL_MS = 70; // ~14 Hz ceiling
const MAX_INTERVAL_MS = 200; // ~5 Hz floor during steady cruise
const TARGET_DYNAMIC_MS = 85; // ~12 Hz when dynamic
const CHUNK_FLUSH_MS = 4000;
const STATIONARY_SUGGEST_MS = 180_000; // 3 minutes

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function mapSource(s: VehicleMotionState["primarySource"] | "none"): TraceSensorSource {
  if (s === "tesla-browser" || s === "phone" || s === "vehicle-telemetry" || s === "simulator")
    return s;
  return "none";
}

export interface AdaptiveSamplerOptions {
  journeyId: string;
  startedAt: number;
  outputMode: JourneyTraceV1["outputMode"];
  captureProfileId: string | null;
  onChunk?: (chunkIndex: number, samples: JourneyTraceSampleV1[]) => void;
}

/**
 * Adaptive 8–15 Hz motion sampler. Personality-independent raw motion only.
 */
export class AdaptiveTraceSampler {
  private journeyId: string;
  private startedAt: number;
  private outputMode: JourneyTraceV1["outputMode"];
  private captureProfileId: string | null;
  private samples: JourneyTraceSampleV1[] = [];
  private events: JourneyTraceSemanticEventV1[] = [];
  private gaps: JourneyTraceGapV1[] = [];
  private lastSampleAt = 0;
  private lastFlushAt = 0;
  private chunkIndex = 0;
  private prevAccel = 0;
  private prevSpeed = 0;
  private cruiseActive = false;
  private moving = false;
  private gapOpen: JourneyTraceGapV1 | null = null;
  private stationarySince: number | null = null;
  private browserPaused = false;
  private endedUnexpectedly = false;
  private onChunk?: AdaptiveSamplerOptions["onChunk"];
  private distanceM = 0;

  constructor(opts: AdaptiveSamplerOptions) {
    this.journeyId = opts.journeyId;
    this.startedAt = opts.startedAt;
    this.outputMode = opts.outputMode;
    this.captureProfileId = opts.captureProfileId;
    this.onChunk = opts.onChunk;
    this.lastFlushAt = performance.now();
  }

  getJourneyId() {
    return this.journeyId;
  }

  getSampleCount() {
    return this.samples.length;
  }

  getDistanceM() {
    return this.distanceM;
  }

  markBrowserPaused(reason: JourneyTraceGapV1["reason"] = "visibility") {
    if (this.gapOpen) return;
    const t = Date.now() - this.startedAt;
    this.browserPaused = true;
    this.gapOpen = { startT: t, endT: t, reason };
    this.events.push({ t, type: "capture_paused" });
  }

  markBrowserResumed() {
    const t = Date.now() - this.startedAt;
    if (this.gapOpen) {
      this.gapOpen.endT = t;
      this.gaps.push(this.gapOpen);
      this.gapOpen = null;
    }
    this.events.push({ t, type: "capture_resumed" });
  }

  markSensorGap() {
    this.markBrowserPaused("sensor_loss");
  }

  /** Push fused motion; may skip based on adaptive interval. */
  pushMotion(motion: VehicleMotionState, wallDtSec: number, nowMs = performance.now()) {
    const speedKmh = motion.speedKmh;
    const accel = motion.accelerationFiltered || motion.accelerationMs2;
    const dynamic =
      Math.abs(accel) > 0.6 || Math.abs(speedKmh - this.prevSpeed) > 2.5 || motion.transitioning;
    const interval = dynamic ? TARGET_DYNAMIC_MS : MAX_INTERVAL_MS;
    const minInterval = dynamic ? MIN_INTERVAL_MS : Math.max(MIN_INTERVAL_MS, interval * 0.7);
    if (this.lastSampleAt > 0 && nowMs - this.lastSampleAt < minInterval) return;
    this.lastSampleAt = nowMs;

    const t = Math.max(0, Date.now() - this.startedAt);
    const jerk = clamp01(Math.abs(accel - this.prevAccel) / Math.max(0.008, wallDtSec) / 28);
    const sample: JourneyTraceSampleV1 = {
      t,
      speedKmh: Math.round(speedKmh * 10) / 10,
      acceleration: Math.round(accel * 100) / 100,
      longitudinalAccel: Math.round(accel * 100) / 100,
      jerk: Math.round((accel >= this.prevAccel ? jerk : -jerk) * 100) / 100,
      driverDemandEstimate: clamp01(motion.inferredThrottle),
      regenEstimate: clamp01(motion.decelerationMs2 / 3.5),
      movementConfidence: clamp01(motion.motionConfidence),
      sourceQuality: clamp01(motion.motionConfidence),
      primarySource: mapSource(motion.primarySource),
    };
    this.samples.push(sample);
    this.distanceM += (speedKmh / 3.6) * Math.max(0, wallDtSec);
    this.detectSemantics(sample, Date.now());
    this.prevAccel = accel;
    this.prevSpeed = speedKmh;

    if (nowMs - this.lastFlushAt >= CHUNK_FLUSH_MS) {
      this.flushChunk();
      this.lastFlushAt = nowMs;
    }
  }

  /** True when stationary long enough to ask "Still driving?" */
  shouldSuggestFinish(now = Date.now()): boolean {
    if (this.stationarySince == null) return false;
    return now - this.stationarySince >= STATIONARY_SUGGEST_MS;
  }

  clearStationarySuggestion() {
    this.stationarySince = null;
  }

  private detectSemantics(sample: JourneyTraceSampleV1, wallNow: number) {
    const moving = sample.speedKmh > 4;
    if (moving && !this.moving) {
      this.events.push({ t: sample.t, type: "movement_start" });
      this.stationarySince = null;
    }
    if (!moving && this.moving) {
      this.events.push({ t: sample.t, type: "stop" });
      this.stationarySince = wallNow;
    }
    if (!moving && this.stationarySince == null) this.stationarySince = wallNow;
    if (moving) this.stationarySince = null;
    this.moving = moving;

    if (sample.acceleration > 1.8) {
      this.events.push({
        t: sample.t,
        type: "strong_acceleration",
        intensity: clamp01(sample.acceleration / 4),
      });
    }
    if (sample.regenEstimate > 0.35) {
      this.events.push({
        t: sample.t,
        type: "regen",
        intensity: sample.regenEstimate,
      });
    }
    if (sample.acceleration < -0.4 && sample.driverDemandEstimate < 0.12) {
      this.events.push({ t: sample.t, type: "lift" });
    }

    const cruising = moving && Math.abs(sample.acceleration) < 0.35 && sample.speedKmh > 25;
    if (cruising && !this.cruiseActive) {
      this.cruiseActive = true;
      this.events.push({ t: sample.t, type: "cruise_start" });
    } else if (!cruising && this.cruiseActive) {
      this.cruiseActive = false;
      this.events.push({ t: sample.t, type: "cruise_end" });
    }
  }

  flushChunk() {
    if (!this.samples.length) return;
    const start = this.chunkIndex === 0 ? 0 : Math.max(0, this.samples.length - 48);
    // Only notify about new tail for incremental persist
    const slice = this.samples.slice(start);
    this.onChunk?.(this.chunkIndex, slice);
    this.chunkIndex += 1;
  }

  finalize(opts?: { unexpected?: boolean }): JourneyTraceV1 {
    if (this.gapOpen) {
      this.gapOpen.endT = Date.now() - this.startedAt;
      this.gaps.push(this.gapOpen);
      this.gapOpen = null;
    }
    this.flushChunk();
    this.endedUnexpectedly = Boolean(opts?.unexpected);
    const durationMs = Date.now() - this.startedAt;
    return {
      version: 1,
      journeyId: this.journeyId,
      startedAt: this.startedAt,
      endedAt: Date.now(),
      durationMs,
      outputMode: this.outputMode,
      captureProfileId: this.captureProfileId,
      status: this.endedUnexpectedly ? "incomplete" : "complete",
      samples: this.samples,
      semanticEvents: this.dedupeEvents(this.events),
      gaps: this.gaps,
      summary: this.buildSummary(durationMs),
    };
  }

  snapshotIncomplete(): JourneyTraceV1 {
    return this.finalize({ unexpected: true });
  }

  private dedupeEvents(events: JourneyTraceSemanticEventV1[]) {
    const out: JourneyTraceSemanticEventV1[] = [];
    let lastType = "";
    let lastT = -1e9;
    for (const e of events) {
      if (e.type === lastType && e.t - lastT < 800) continue;
      out.push(e);
      lastType = e.type;
      lastT = e.t;
    }
    return out.slice(0, 400);
  }

  private buildSummary(durationMs: number): JourneyTraceSummaryV1 {
    const n = this.samples.length;
    if (!n) {
      return {
        sampleCount: 0,
        durationMs,
        distanceM: 0,
        meanSpeedKmh: 0,
        maxSpeedKmh: 0,
        movingShare: 0,
        gapCount: this.gaps.length,
        gapMs: this.gaps.reduce((a, g) => a + Math.max(0, g.endT - g.startT), 0),
        primarySource: "none",
        endedUnexpectedly: this.endedUnexpectedly,
        browserPaused: this.browserPaused,
      };
    }
    let sum = 0;
    let max = 0;
    let moving = 0;
    const sources = new Map<TraceSensorSource, number>();
    for (const s of this.samples) {
      sum += s.speedKmh;
      if (s.speedKmh > max) max = s.speedKmh;
      if (s.speedKmh > 4) moving += 1;
      sources.set(s.primarySource, (sources.get(s.primarySource) || 0) + 1);
    }
    let primary: TraceSensorSource = "none";
    let best = 0;
    for (const [k, v] of sources) {
      if (v > best) {
        best = v;
        primary = k;
      }
    }
    return {
      sampleCount: n,
      durationMs,
      distanceM: Math.round(this.distanceM),
      meanSpeedKmh: Math.round((sum / n) * 10) / 10,
      maxSpeedKmh: Math.round(max * 10) / 10,
      movingShare: moving / n,
      gapCount: this.gaps.length,
      gapMs: this.gaps.reduce((a, g) => a + Math.max(0, g.endT - g.startT), 0),
      primarySource: primary,
      endedUnexpectedly: this.endedUnexpectedly,
      browserPaused: this.browserPaused,
    };
  }
}

/** Reject traces that smuggle coordinates. */
export function assertTracePrivacy(trace: JourneyTraceV1): boolean {
  const blob = JSON.stringify(trace);
  return !/latitude|longitude|"lat"|"lon"|polyline|routePath|street|destination/i.test(blob);
}

/** Rough storage estimate bytes for samples. */
export function estimateTraceBytes(sampleCount: number): number {
  // ~11 numbers + source string ≈ 90–120 bytes JSON per sample
  return sampleCount * 110;
}
