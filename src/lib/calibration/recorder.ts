import {
  type CalibrationMarker,
  type CalibrationTrace,
  type CalibrationTraceMeta,
  type CalibrationTraceSample,
} from "@/lib/calibration/types";
import { buildCalibrationTrace, sampleFromLive } from "@/lib/calibration/serialize";
import type { DriveState } from "@/lib/drive/model";
import type { VehicleMotionState } from "@/lib/motion/types";

const DEFAULT_INTERVAL_MS = 50; // 20 Hz - outside audio rAF critical path when polled
const MAX_SAMPLES = 36_000; // ~30 min @ 20 Hz

/**
 * Buffers calibration samples without synchronous JSON work on the hot path.
 * Call `tick` from a throttled timer (not necessarily every animation frame).
 */
export class CalibrationRecorder {
  private samples: CalibrationTraceSample[] = [];
  private markers: CalibrationMarker[] = [];
  private startedAt = 0;
  private lastSampleAt = 0;
  private prevAccel = 0;
  private recording = false;
  private meta: CalibrationTraceMeta | null = null;
  private intervalMs: number;

  constructor(intervalMs = DEFAULT_INTERVAL_MS) {
    this.intervalMs = intervalMs;
  }

  get isRecording() {
    return this.recording;
  }

  get sampleCount() {
    return this.samples.length;
  }

  get markerCount() {
    return this.markers.length;
  }

  get elapsedMs() {
    if (!this.recording || !this.startedAt) return 0;
    return performance.now() - this.startedAt;
  }

  start(
    meta: Omit<CalibrationTraceMeta, "recordedAt" | "origin"> & {
      origin?: CalibrationTraceMeta["origin"];
    },
  ) {
    this.samples = [];
    this.markers = [];
    this.startedAt = performance.now();
    this.lastSampleAt = 0;
    this.prevAccel = 0;
    this.recording = true;
    this.meta = {
      ...meta,
      origin: meta.origin ?? "road",
      recordedAt: new Date().toISOString(),
    };
  }

  /**
   * Append a sample if the interval has elapsed.
   * Safe to call from rAF - work is O(1) push, no stringify.
   */
  tick(motion: VehicleMotionState, drive: DriveState, opts?: { braking?: number }) {
    if (!this.recording) return;
    const now = performance.now();
    if (this.lastSampleAt && now - this.lastSampleAt < this.intervalMs) return;
    const dt = this.lastSampleAt ? (now - this.lastSampleAt) / 1000 : this.intervalMs / 1000;
    const tMs = Math.round(now - this.startedAt);
    const sample = sampleFromLive(tMs, motion, drive, {
      ...(opts?.braking !== undefined ? { braking: opts.braking } : {}),
      prevAccel: this.prevAccel,
      dt,
    });
    this.prevAccel = motion.accelerationFiltered;
    this.lastSampleAt = now;
    this.samples.push(sample);
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
  }

  /** Passenger-safe one-tap problem mark (no text while driving). */
  markProblem() {
    if (!this.recording) return null;
    const marker: CalibrationMarker = {
      id: `m-${Date.now().toString(36)}`,
      tMs: Math.round(performance.now() - this.startedAt),
      label: "",
      note: "",
    };
    this.markers.push(marker);
    return marker;
  }

  updateMarker(id: string, patch: Partial<Pick<CalibrationMarker, "label" | "note">>) {
    const m = this.markers.find((x) => x.id === id);
    if (!m) return;
    if (patch.label !== undefined) m.label = patch.label;
    if (patch.note !== undefined) m.note = patch.note;
  }

  stop(): CalibrationTrace | null {
    if (!this.recording || !this.meta) return null;
    this.recording = false;
    const trace = buildCalibrationTrace(this.samples, this.meta, this.markers);
    return trace;
  }

  discard() {
    this.recording = false;
    this.samples = [];
    this.markers = [];
    this.meta = null;
  }
}
