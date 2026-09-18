import type { DriveState } from "@/lib/drive/model";
import { IDLE_STATE } from "@/lib/drive/model";
import type { DriveTrace } from "@/lib/drive/traces";
import type { JourneyTraceSampleV1, JourneyTraceV1 } from "./types";
import type { VehicleMotionState } from "@/lib/motion/types";
import { IDLE_VEHICLE_MOTION } from "@/lib/motion/types";
import { PowertrainSimulator } from "@/lib/powertrain/simulator";
import { driveStateFromPowertrain } from "@/lib/powertrain/adapters/drive-state";
import { powertrainProfileForSound } from "@/lib/powertrain";
import { getProfile } from "@/lib/sound/profiles";

export interface JourneyReplaySource {
  readonly id: string;
  readonly durationMs: number;
  readonly sampleCount: number;
  /** Rate multiplier - consumer default 1; 0.5 / 2 allowed in DEV */
  rate: number;
  /** Active interpretation profile (Engine / Symphony / World / Fusion id) */
  readonly profileId: string | null;
  reset(): void;
  /** Seek to journey time in ms without advancing audio scheduler corruptly */
  seekTo(ms: number): void;
  getPlayheadMs(): number;
  /** Advance and return next DriveState, or null at end */
  next(dtSec: number): DriveState | null;
  peek(): DriveState | null;
  /** Switch Engine/experience personality; preserve playhead */
  setInterpretation(profileId: string | null): void;
}

function sampleToMotion(
  s: JourneyTraceSampleV1,
  startedAt: number,
  playheadMs = s.t,
): VehicleMotionState {
  return {
    ...IDLE_VEHICLE_MOTION,
    // Replay time keeps advancing between sparse recorded samples so shift
    // cooldowns and throttle smoothing do not freeze.
    timestamp: startedAt + playheadMs,
    speedKmh: s.speedKmh,
    accelerationMs2: s.acceleration,
    accelerationFiltered: s.longitudinalAccel,
    decelerationMs2: Math.max(0, -s.acceleration),
    inferredThrottle: s.driverDemandEstimate,
    motionConfidence: s.movementConfidence,
    primarySource:
      s.primarySource === "none"
        ? "simulator"
        : (s.primarySource as VehicleMotionState["primarySource"]),
    sourceHealth: {
      phone: s.primarySource === "phone",
      browser: s.primarySource === "tesla-browser",
      vehicleTelemetry: s.primarySource === "vehicle-telemetry",
    },
    fallbackTier:
      s.primarySource === "vehicle-telemetry"
        ? "vehicle-telemetry"
        : s.primarySource === "phone"
          ? "phone"
          : s.primarySource === "tesla-browser"
            ? "browser"
            : "hold",
    transitioning: false,
  };
}

function sampleToDriveState(s: JourneyTraceSampleV1, startedAt: number): DriveState {
  const speed = s.speedKmh / 3.6;
  return {
    ...IDLE_STATE,
    speed,
    acceleration: s.acceleration,
    throttle: s.driverDemandEstimate,
    regen: s.regenEstimate,
    load: Math.min(1, s.driverDemandEstimate * 0.7 + speed / 50),
    timestamp: startedAt + s.t,
    jerk: s.jerk,
    speedNormalized: Math.min(1, speed / (160 / 3.6)),
    accelerationNormalized: Math.min(1, Math.abs(s.acceleration) / 4.5),
    powertrainBackend: "legacy",
  };
}

/**
 * Replay JourneyTraceV1 as DriveState timeline.
 * Optional profileId re-runs Powertrain against raw motion (reinterpretation).
 */
export class JourneyTraceReplaySource implements JourneyReplaySource {
  readonly id: string;
  readonly durationMs: number;
  readonly sampleCount: number;
  rate = 1;
  private samples: JourneyTraceSampleV1[];
  private startedAt: number;
  private index = 0;
  private cursorMs = 0;
  private powertrain: PowertrainSimulator | null = null;
  private prev: DriveState = IDLE_STATE;
  private current: DriveState | null = null;
  private _profileId: string | null;
  private ended = false;

  constructor(trace: JourneyTraceV1, opts?: { profileId?: string; rate?: number }) {
    this.id = trace.journeyId;
    this.durationMs = Math.max(trace.durationMs, trace.samples[trace.samples.length - 1]?.t ?? 0);
    this.samples = trace.samples;
    this.sampleCount = trace.samples.length;
    this.startedAt = trace.startedAt;
    this._profileId = opts?.profileId ?? trace.captureProfileId;
    if (opts?.rate) this.rate = opts.rate;
    this.bindPowertrain(this._profileId);
  }

  get profileId() {
    return this._profileId;
  }

  private bindPowertrain(profileId: string | null) {
    this.powertrain = null;
    if (!profileId) return;
    try {
      const sound = getProfile(profileId);
      if (sound.drivetrainMode !== "virtual-transmission") return;
      const pt = powertrainProfileForSound(sound);
      this.powertrain = new PowertrainSimulator({ profile: pt });
    } catch {
      this.powertrain = null;
    }
  }

  reset() {
    this.index = 0;
    this.cursorMs = 0;
    this.prev = IDLE_STATE;
    this.current = null;
    this.ended = false;
    this.powertrain?.reset();
  }

  seekTo(ms: number) {
    const target = Math.max(0, Math.min(this.durationMs, ms));
    this.cursorMs = target;
    this.ended = false;
    this.index = 0;
    if (!this.samples.length) {
      this.current = null;
      this.ended = true;
      return;
    }
    while (this.index < this.samples.length - 1 && this.samples[this.index + 1]!.t <= target) {
      this.index += 1;
    }
    // Rebuild powertrain from start→seek so gears/RPM are coherent for this personality
    this.powertrain?.reset();
    this.prev = IDLE_STATE;
    this.current = null;
    if (this.powertrain) {
      let previousT = 0;
      for (let i = 0; i <= this.index; i += 1) {
        const s = this.samples[i]!;
        const dt = i === 0 ? 1 / 60 : Math.max(0.008, (s.t - previousT) / 1000);
        const motion = sampleToMotion(s, this.startedAt, s.t);
        const pt = this.powertrain.tick(motion, dt);
        this.prev = driveStateFromPowertrain(pt, motion, this.prev, undefined, dt);
        previousT = s.t;
      }
      this.current = this.prev;
    } else {
      const s = this.samples[this.index];
      this.current = s ? sampleToDriveState(s, this.startedAt) : null;
      if (this.current) this.prev = this.current;
    }
  }

  getPlayheadMs() {
    return this.cursorMs;
  }

  setInterpretation(profileId: string | null) {
    const ms = this.cursorMs;
    this._profileId = profileId;
    this.bindPowertrain(profileId);
    this.seekTo(ms);
  }

  peek(): DriveState | null {
    if (this.ended) return null;
    if (this.current) return this.current;
    const s = this.samples[this.index];
    return s ? sampleToDriveState(s, this.startedAt) : null;
  }

  next(dtSec: number): DriveState | null {
    if (!this.samples.length || this.ended) return null;
    this.cursorMs += dtSec * 1000 * this.rate;
    while (
      this.index < this.samples.length - 1 &&
      this.samples[this.index + 1]!.t <= this.cursorMs
    ) {
      this.index += 1;
    }
    const s = this.samples[this.index];
    if (!s) {
      this.ended = true;
      return null;
    }
    if (this.cursorMs > this.durationMs + 250 && this.index >= this.samples.length - 1) {
      this.ended = true;
      return null;
    }
    const state = this.interpret(s, dtSec, this.cursorMs);
    this.prev = state;
    this.current = state;
    return state;
  }

  private interpret(s: JourneyTraceSampleV1, dt: number, playheadMs: number): DriveState {
    if (this.powertrain && this._profileId) {
      const motion = sampleToMotion(s, this.startedAt, playheadMs);
      const pt = this.powertrain.tick(motion, Math.max(0.008, dt));
      return driveStateFromPowertrain(pt, motion, this.prev, undefined, dt);
    }
    return sampleToDriveState(s, this.startedAt);
  }
}

/** Stable default seed for replayable musical and world interpretations. */
export function journeyReplaySeed(journeyId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < journeyId.length; i += 1) {
    hash ^= journeyId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Adapter over legacy DriveTrace for existing replay UI. */
export class DriveTraceReplaySource implements JourneyReplaySource {
  readonly id: string;
  readonly durationMs: number;
  readonly sampleCount: number;
  rate = 1;
  readonly profileId: string | null;
  private samples: DriveState[];
  private index = 0;

  constructor(trace: DriveTrace, rate = 1) {
    this.id = trace.id;
    this.durationMs = trace.durationMs;
    this.samples = trace.samples;
    this.sampleCount = trace.samples.length;
    this.rate = rate;
    this.profileId = trace.profileId;
  }

  reset() {
    this.index = 0;
  }

  seekTo(ms: number) {
    if (!this.samples.length) return;
    const t0 = this.samples[0]!.timestamp;
    const target = t0 + ms;
    this.index = 0;
    while (
      this.index < this.samples.length - 1 &&
      this.samples[this.index + 1]!.timestamp <= target
    ) {
      this.index += 1;
    }
  }

  getPlayheadMs() {
    if (!this.samples.length) return 0;
    return Math.max(0, this.samples[this.index]!.timestamp - this.samples[0]!.timestamp);
  }

  setInterpretation(_profileId: string | null) {
    /* legacy traces already baked DriveState */
  }

  peek() {
    return this.samples[this.index] ?? null;
  }

  next(_dtSec: number): DriveState | null {
    const step = Math.max(1, Math.round(this.rate));
    this.index += step;
    return this.samples[this.index] ?? null;
  }
}

/** Energy 0..1 series for Motion Signature from JourneyTrace. */
export function energySamplesFromJourneyTrace(trace: JourneyTraceV1, max = 24): number[] {
  if (!trace.samples.length) return [];
  const values = trace.samples.map((s) => {
    const speed = Math.min(1, s.speedKmh / 120);
    const demand = s.driverDemandEstimate;
    const regen = s.regenEstimate * 0.5;
    return Math.max(
      0,
      Math.min(1, speed * 0.45 + demand * 0.4 + regen * 0.2 + Math.abs(s.jerk) * 0.15),
    );
  });
  if (values.length <= max) return values;
  const out: number[] = [];
  for (let i = 0; i < max; i++) {
    const idx = Math.round((i / (max - 1)) * (values.length - 1));
    out.push(values[idx]!);
  }
  return out;
}

/** Compare two personalities at the same playhead (DEV / premium A/B). */
export function compareInterpretationsAt(
  trace: JourneyTraceV1,
  profileA: string,
  profileB: string,
  playheadMs: number,
): { a: DriveState; b: DriveState } {
  const srcA = new JourneyTraceReplaySource(trace, { profileId: profileA });
  const srcB = new JourneyTraceReplaySource(trace, { profileId: profileB });
  srcA.seekTo(playheadMs);
  srcB.seekTo(playheadMs);
  return {
    a: srcA.peek() ?? IDLE_STATE,
    b: srcB.peek() ?? IDLE_STATE,
  };
}
