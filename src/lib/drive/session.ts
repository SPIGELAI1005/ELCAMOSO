import {
  applyDemoDriveOverrides,
  tickDemoSpeed,
  DEMO_DEFAULTS,
  type DemoControls,
  type DemoSelector,
} from "@/lib/drive/demo-physics";
import { withPersonalityTransmission } from "@/lib/drive/drivetrain-resolve";
import { computeDriveState, IDLE_STATE, type DriveState } from "@/lib/drive/model";
import {
  browserGpsMotionSample,
  browserImuMotionSample,
  createSensorFusion,
  markPhoneRelayLost,
  markPhoneRelayRestored,
  phoneRelayMotionSample,
  pushMotionSample,
  resetSensorFusion,
  tickSensorFusion,
  type SensorFusionState,
} from "@/lib/motion/sensor-fusion";
import {
  cancelPhoneRelayGrace,
  createRelayGraceState,
  schedulePhoneRelayGrace,
} from "@/lib/motion/motion-relay-resilience";
import {
  createVehicleTelemetryProvider,
  getTeslaFleetTelemetryProvider,
  mapTeslaFleetSignalsToMotionSample,
  type TeslaFleetTelemetryRecord,
  type VehicleTelemetryProvider,
} from "@/lib/motion/vehicle-telemetry";
import type { RelayMotionMessage } from "@/lib/motion/relay-sample";
import type { RelayTelemetryMessage } from "@/lib/motion/relay-telemetry";
import type { MotionSample, VehicleMotionState } from "@/lib/motion/types";
import { collectDriveDiagnostics } from "@/lib/diagnostics/collect";
import { buildDiagnosticsSessionExport } from "@/lib/diagnostics/export";
import { DiagnosticsSessionRecorder } from "@/lib/diagnostics/recorder";
import type {
  DriveDiagnosticsFrame,
  DiagnosticsSessionExport,
  DiagnosticsSessionMeta,
} from "@/lib/diagnostics/types";
import { MotionPipelineTracker, type MotionPipelineMetrics } from "@/lib/motion/pipeline-metrics";
import { resolveGpsSpeed, type GpsPoint } from "@/lib/drive/gps-speed";
import {
  deriveMotionState,
  IDLE_MOTION,
  isDrivingSafetySpeed,
  type MotionState,
} from "@/lib/drive/motion-energy";
import { cappedGain } from "@/lib/drive/safety";
import { matchRule, type AutoRule, type AutoRulesMode, type ProfileRule } from "@/lib/drive/rules";
import { ContextClassifier, predictState, type DriveContext } from "@/lib/drive/context";
import { evaluateProfileRules } from "@/lib/drive/profile-rules";
import {
  DEFAULT_CABIN_EQ,
  DEFAULT_SHIFT_FEEL,
  type CabinEq,
  type ShiftFeel,
} from "@/lib/drive/types-extra";
import {
  TraceRecorder,
  saveTrace,
  type DriveTrace,
  type TraceAggregates,
} from "@/lib/drive/traces";
import { SoundEngine, type MeterReading } from "@/lib/sound/engine";
import { getProfile } from "@/lib/sound/profiles";
import { driveStateFromPowertrain } from "@/lib/powertrain/adapters/drive-state";
import {
  powertrainProfileForSound,
  supportsDynamicDrive,
} from "@/lib/powertrain/adapters/profile-map";
import { vehicleMotionFromDrive } from "@/lib/powertrain/adapters/vehicle-motion";
import { PowertrainSimulator } from "@/lib/powertrain/simulator";
import type { ProfileTuning, Playlist } from "@/lib/drive/settings";
import { DEFAULT_LAYER_MIX, normalizeMix, type LayerMix } from "@/lib/sound/environments";
import type { SoundSnippet } from "@/lib/sound/snippets";
import { reportAudioError } from "@/lib/telemetry/crashes";
import { trackEvent } from "@/lib/telemetry/analytics";

/** Consumer-facing Drive status (technical detail stays on /debug). */
export type DriveProductStatus =
  | "idle"
  | "sound-active"
  | "vehicle-connected"
  | "gps-only"
  | "weak-signal"
  | "sound-paused"
  | "simulation";

export function driveProductLabel(status: DriveProductStatus): string {
  switch (status) {
    case "sound-active":
      return "Sound Active";
    case "vehicle-connected":
      return "Vehicle Connected";
    case "gps-only":
      return "GPS Only";
    case "weak-signal":
      return "Weak Signal";
    case "sound-paused":
      return "Sound Paused";
    case "simulation":
      return "Simulation";
    default:
      return "";
  }
}

/** Brief hide (notification shade) should not kill Drive audio immediately. */
const DRIVE_HIDE_GRACE_MS = 2800;

export type SessionKind = "idle" | "drive" | "demo" | "audition" | "replay" | "ab";
export type SessionStatus = "idle" | "starting" | "running" | "error" | "suspended";

export type { DemoControls, DemoSelector } from "@/lib/drive/demo-physics";
export { DEMO_DEFAULTS } from "@/lib/drive/demo-physics";

export interface AudioPerf {
  baseLatencyMs: number;
  outputLatencyMs: number;
  updateMs: number;
  loadPct: number;
  underruns: number;
  driftMs: number;
}

export const IDLE_PERF: AudioPerf = {
  baseLatencyMs: 0,
  outputLatencyMs: 0,
  updateMs: 0,
  loadPct: 0,
  underruns: 0,
  driftMs: 0,
};

export interface SessionSnapshot {
  kind: SessionKind;
  status: SessionStatus;
  error: string | null;
  state: DriveState;
  motion: MotionState;
  productStatus: DriveProductStatus;
  safetyMode: boolean;
  profileId: string;
  profileName: string;
  meter: MeterReading | null;
  demo: DemoControls;
  auditionKmh: number;
  ducking: boolean;
  ab: { a: string; b: string; active: "a" | "b" } | null;
  cockpit: boolean;
  lastTraceId: string | null;
  lastAggregates: TraceAggregates | null;
  perf: AudioPerf;
  context: DriveContext;
  rulesHeld: boolean;
  suggestedProfileId: string | null;
  playlistTripMs: number;
  pipeline: MotionPipelineMetrics;
}

type Listener = () => void;

export interface SessionConfig {
  profileId: string;
  volume: number;
  profileGain: number;
  tuning?: ProfileTuning;
  motionSensitivity: number;
  motionNoiseFloor: number;
  environmentId?: string;
  mix?: LayerMix;
  snippets?: SoundSnippet[];
  cabinEq: CabinEq;
  shiftFeel: ShiftFeel;
  autoRules: AutoRule[];
  autoRulesMode: AutoRulesMode;
  playlists: Playlist[];
  latencyCompMs: number;
  profileRules: Record<string, ProfileRule[]>;
  /** rules attached to the active custom sound */
  activeProfileRules: ProfileRule[];
  /** Dynamic Drive powertrain + layered audio (Legacy transmission when false) */
  dynamicDrive: boolean;
  /** Tesla Fleet Telemetry adapter (optional server bridge). */
  teslaFleetTelemetry: boolean;
}

const UI_MS = 80;

/** Content fingerprint so syncConfig can skip no-op identity churn. */
function configFingerprint(c: SessionConfig): string {
  return JSON.stringify({
    profileId: c.profileId,
    volume: c.volume,
    profileGain: c.profileGain,
    tuning: c.tuning,
    motionSensitivity: c.motionSensitivity,
    motionNoiseFloor: c.motionNoiseFloor,
    environmentId: c.environmentId,
    mix: c.mix,
    cabinEq: c.cabinEq,
    shiftFeel: c.shiftFeel,
    autoRules: c.autoRules,
    autoRulesMode: c.autoRulesMode,
    playlists: c.playlists,
    latencyCompMs: c.latencyCompMs,
    profileRules: c.profileRules,
    activeProfileRules: c.activeProfileRules,
    dynamicDrive: c.dynamicDrive,
    teslaFleetTelemetry: c.teslaFleetTelemetry,
    snippets: c.snippets?.map((s) => ({
      id: s.id,
      name: s.name,
      trigger: s.trigger,
      level: s.level,
      dataLen: s.dataUrl?.length ?? 0,
    })),
  });
}

class DriveSession {
  private engine: SoundEngine | null = null;
  private engineB: SoundEngine | null = null;
  private listeners = new Set<Listener>();
  private raf: number | null = null;
  private lastTick = 0;
  private lastUi = 0;
  private watchId: number | null = null;
  private motionHandler: ((e: DeviceMotionEvent) => void) | null = null;
  private gpsAt = 0;
  private gpsPoint: GpsPoint | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private wakeReleaseHandler: (() => void) | null = null;
  private speed = 0;
  private state: DriveState = IDLE_STATE;
  private motion: MotionState = IDLE_MOTION;
  private kind: SessionKind = "idle";
  private status: SessionStatus = "idle";
  private error: string | null = null;
  private hasImu = false;
  private demo: DemoControls = { ...DEMO_DEFAULTS };
  private auditionKmh = 60;
  private ducking = false;
  private cockpit = false;
  private ab: SessionSnapshot["ab"] = null;
  private replay: DriveTrace | null = null;
  private replayIndex = 0;
  private driveStartedAt = 0;
  private recorder = new TraceRecorder();
  private wake: WakeLockSentinel | null = null;
  private lastRuleId: string | null = null;
  private lastTraceId: string | null = null;
  private lastAggregates: TraceAggregates | null = null;
  private underruns = 0;
  private lastAudioTime = 0;
  private perf: AudioPerf = IDLE_PERF;
  private classifier = new ContextClassifier();
  private context: DriveContext = "city";
  private rulesHeld = false;
  private suggestedProfileId: string | null = null;
  private playlistTripStartedAt = 0;
  private playlistSegmentIndex = 0;
  private ruleLatched = new Set<string>();
  private baseMix: LayerMix = normalizeMix(undefined);
  private config: SessionConfig = {
    profileId: "gt-v8",
    volume: 0.7,
    profileGain: 1,
    motionSensitivity: 1,
    motionNoiseFloor: 0,
    cabinEq: DEFAULT_CABIN_EQ,
    shiftFeel: DEFAULT_SHIFT_FEEL,
    autoRules: [],
    autoRulesMode: "off",
    playlists: [],
    latencyCompMs: 0,
    profileRules: {},
    activeProfileRules: [],
    dynamicDrive: false,
    teslaFleetTelemetry: false,
  };
  private vehicleTelemetryProvider: VehicleTelemetryProvider | null = null;
  private vehicleTelemetryUnsub: (() => void) | null = null;
  private powertrainSim: PowertrainSimulator | null = null;
  private powertrainSoundProfileId: string | null = null;
  private sensorFusion: SensorFusionState = createSensorFusion();
  private lastVehicleMotion = vehicleMotionFromDrive({
    speedMps: 0,
    accelerationMps2: 0,
    timestamp: 0,
  });
  private lastFusionIngestAt = 0;
  private relayGrace = createRelayGraceState();
  private pipeline = new MotionPipelineTracker();
  private diagnosticsRecorder = new DiagnosticsSessionRecorder();
  private debugDriveDiagnostics = false;
  private diagnosticsRecordAt = 0;
  private lastUiFingerprint = "";
  private lastCoreUiFingerprint = "";
  private uiAuxSkipTicks = 0;
  private cached: SessionSnapshot | null = null;
  /** AudioContext created/resumed during pointerdown; handed to the next begin(). */
  private gestureAudioContext: AudioContext | null = null;

  /** Dynamic Drive powertrain sim — also used for Demo (simulated gears at realistic speeds). */
  private powertrainSimActive(profile: ReturnType<typeof getProfile>): boolean {
    return supportsDynamicDrive(profile) && (this.config.dynamicDrive || this.kind === "demo");
  }

  /**
   * Call synchronously from a user-activation handler (pointerdown / click)
   * before any await. Browsers block AudioContext.resume() once the gesture
   * stack unwinds — Home “Hold to accelerate” must prime audio here.
   */
  primeAudioFromUserGesture(): void {
    if (typeof window === "undefined") return;
    try {
      const AudioCtx =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.gestureAudioContext || this.gestureAudioContext.state === "closed") {
        this.gestureAudioContext = new AudioCtx();
      }
      const ctx = this.gestureAudioContext;
      if (ctx.state === "suspended") void ctx.resume();
    } catch {
      this.gestureAudioContext = null;
    }
  }

  snapshot(): SessionSnapshot {
    if (!this.cached) this.cached = this.read();
    return this.cached;
  }

  private safeMeter(): MeterReading | null {
    try {
      return this.engine?.getMeter() ?? null;
    } catch {
      return null;
    }
  }

  private read(): SessionSnapshot {
    const profile = getProfile(this.config.profileId);
    const productStatus = this.resolveProductStatus();
    const safetyMode = this.readSafetyMode();
    return {
      kind: this.kind,
      status: this.status,
      error: this.error,
      state: this.state,
      motion: this.motion,
      productStatus,
      safetyMode,
      profileId: this.config.profileId,
      profileName: profile.name,
      meter: this.safeMeter(),
      demo: this.demo,
      auditionKmh: this.auditionKmh,
      ducking: this.ducking,
      ab: this.ab,
      cockpit: this.cockpit,
      lastTraceId: this.lastTraceId,
      lastAggregates: this.lastAggregates,
      perf: this.perf,
      context: this.context,
      rulesHeld: this.rulesHeld,
      suggestedProfileId: this.suggestedProfileId,
      playlistTripMs:
        this.kind === "drive" && this.playlistTripStartedAt
          ? Date.now() - this.playlistTripStartedAt
          : 0,
      pipeline: this.pipeline.snapshot(Date.now(), this.lastVehicleMotion.fallbackTier),
    };
  }

  private resolveProductStatus(): DriveProductStatus {
    if (this.status === "idle" || this.kind === "idle") return "idle";
    if (this.status === "suspended" || this.ducking) return "sound-paused";
    if (
      this.kind === "demo" ||
      this.kind === "audition" ||
      this.kind === "ab" ||
      this.kind === "replay"
    ) {
      return "simulation";
    }
    if (this.status === "error") return "weak-signal";
    if (this.kind === "drive" && this.status === "running") {
      if (this.lastVehicleMotion.sourceHealth.vehicleTelemetry) {
        return "vehicle-connected";
      }
      if (!this.hasImu && this.gpsAt > 0) return "gps-only";
      const stale = this.gpsAt > 0 && performance.now() - this.gpsAt > 4000;
      if (stale || (this.gpsAt === 0 && this.status === "running")) return "weak-signal";
      return "sound-active";
    }
    if (this.status === "starting") return "sound-active";
    return "idle";
  }

  private noteMotion(state: DriveState, dt: number) {
    this.state = state;
    this.motion = deriveMotionState(state, this.motion.motionEnergy, dt);
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Quantized drive/powertrain fields — no analyser or pipeline reads. */
  private computeCoreUiFingerprint(): string {
    const s = this.state;
    const pt = s.powertrain;
    const parts: (string | number)[] = [
      this.kind,
      this.status,
      this.error ?? "",
      pt?.gear ?? s.gear,
      (pt?.shifting ?? s.isShifting) ? 1 : 0,
      Math.round((pt?.rpm ?? s.rpm) / 20),
      Math.round((s.speed * 3.6) / 2),
      Math.round(this.motion.motionEnergy * 16),
      Math.round(s.throttle * 8),
      Math.round(s.regen * 8),
      this.resolveProductStatus(),
      this.readSafetyMode() ? 1 : 0,
      this.rulesHeld ? 1 : 0,
      this.suggestedProfileId ?? "",
      this.ducking ? 1 : 0,
      this.cockpit ? 1 : 0,
      this.config.profileId,
    ];
    return parts.join("|");
  }

  /** Meter + pipeline fields (more expensive; throttled when core is stable). */
  private computeAuxUiFingerprint(): string {
    const parts: (string | number)[] = [];
    if (this.cockpit) {
      const pipe = this.pipeline.snapshot(Date.now(), this.lastVehicleMotion.fallbackTier);
      parts.push(
        pipe.networkHealth,
        pipe.seq ?? -1,
        Math.round(pipe.phoneSendHz),
        Math.round(pipe.fusionHz),
        pipe.fallbackTier ?? "",
      );
    }
    const meter = this.safeMeter();
    if (meter) {
      parts.push(Math.round(meter.peak * 16), Math.round(meter.rms * 16));
    }
    return parts.join("|");
  }

  /** Fingerprint of UI-visible fields; skips React emit when unchanged between UI ticks. */
  private computeUiFingerprint(): string {
    return `${this.computeCoreUiFingerprint()}|${this.computeAuxUiFingerprint()}`;
  }

  private readSafetyMode(): boolean {
    return (
      (this.status === "running" || this.status === "suspended") &&
      (this.kind === "drive" || this.kind === "demo") &&
      isDrivingSafetySpeed(this.state.speed)
    );
  }

  private emit() {
    this.lastUiFingerprint = this.computeUiFingerprint();
    this.cached = this.read();
    this.listeners.forEach((fn) => fn());
  }

  /** Throttled loop emit: high-frequency simulation does not force React updates. */
  private tryEmitUi() {
    const core = this.computeCoreUiFingerprint();
    const coreChanged = core !== this.lastCoreUiFingerprint;

    if (!coreChanged) {
      if (!this.cockpit) return;
      this.uiAuxSkipTicks += 1;
      // Pipeline/meter refresh ~320 ms when RPM/speed buckets are stable.
      if (this.uiAuxSkipTicks % 4 !== 0) return;
    } else {
      this.uiAuxSkipTicks = 0;
    }

    const fp = `${core}|${this.computeAuxUiFingerprint()}`;
    if (fp === this.lastUiFingerprint) {
      this.lastCoreUiFingerprint = core;
      return;
    }
    this.lastCoreUiFingerprint = core;
    this.lastUiFingerprint = fp;
    this.cached = this.read();
    this.listeners.forEach((fn) => fn());
  }

  syncConfig(next: Partial<SessionConfig>) {
    const prevId = this.config.profileId;
    const prevEnv = this.config.environmentId;
    const merged: SessionConfig = { ...this.config, ...next };
    if (next.mix) merged.mix = normalizeMix(next.mix);

    // Skip emit when content is unchanged. Callers often pass fresh object
    // identities (e.g. getTuning() spreads) that would otherwise loop:
    // syncConfig → emit → re-render → new refs → syncConfig.
    if (configFingerprint(this.config) === configFingerprint(merged)) return;

    this.config = merged;
    this.sensorFusion.options.sensitivity = merged.motionSensitivity;
    this.sensorFusion.options.noiseFloor = merged.motionNoiseFloor;
    if (next.mix && merged.mix) this.baseMix = merged.mix;
    const profile = getProfile(this.config.profileId);
    const gain = cappedGain(this.config.volume, this.config.profileGain, profile);
    this.engine?.setVolume(gain);
    this.engine?.setProfileGain(1);
    this.engine?.setIntensityCeiling(cappedGain(1, 1, profile));
    if (merged.profileId !== prevId) {
      this.powertrainSim = null;
      this.powertrainSoundProfileId = null;
      try {
        this.engine?.setProfile(profile);
      } catch (error) {
        reportAudioError(error);
      }
      this.ruleLatched.clear();
      this.suggestedProfileId = null;
    }
    if (merged.environmentId !== prevEnv) {
      this.engine?.setEnvironment(merged.environmentId);
    }
    if (next.mix) this.engine?.setMix(next.mix);
    if (next.snippets) void this.engine?.setSnippets(next.snippets);
    if (next.cabinEq) this.engine?.setCabinEq(next.cabinEq);
    if (next.dynamicDrive !== undefined) {
      const profile = getProfile(this.config.profileId);
      this.engine?.setDynamicDriveEnabled(this.powertrainSimActive(profile));
      if (!this.powertrainSimActive(profile)) {
        this.powertrainSim = null;
        this.powertrainSoundProfileId = null;
      }
    }
    if (next.teslaFleetTelemetry !== undefined) {
      this.syncVehicleTelemetryProvider();
    }
    this.bindMediaSession();
    this.emit();
  }

  setRulesHeld(held: boolean) {
    this.rulesHeld = held;
    if (!held) this.suggestedProfileId = null;
    this.emit();
  }

  acceptSuggestion() {
    if (!this.suggestedProfileId) return;
    this.applyProfile(this.suggestedProfileId);
    this.suggestedProfileId = null;
    this.emit();
  }

  dismissSuggestion() {
    this.suggestedProfileId = null;
    this.emit();
  }

  private applyProfile(profileId: string) {
    if (profileId === this.config.profileId) return;
    this.config.profileId = profileId;
    this.powertrainSim = null;
    this.powertrainSoundProfileId = null;
    try {
      this.engine?.setProfile(getProfile(profileId));
    } catch (error) {
      reportAudioError(error);
    }
    this.ruleLatched.clear();
    this.bindMediaSession();
  }

  setCockpit(on: boolean) {
    this.cockpit = on;
    // Wake lock follows live Drive, not only Cockpit. Cockpit still opts into
    // denser UI; wake is requested whenever Drive is running.
    if (this.kind === "drive" && (this.status === "running" || this.status === "suspended")) {
      void this.requestWake();
    } else if (!on) {
      void this.releaseWake();
    }
    this.emit();
  }

  setDemo(next: Partial<DemoControls>) {
    const merged = { ...DEMO_DEFAULTS, ...this.demo, ...next };
    const sel = merged.selector;
    merged.selector = sel === "P" || sel === "R" || sel === "N" || sel === "D" ? sel : "D";
    this.demo = merged;
    this.emit();
  }

  setAuditionKmh(kmh: number) {
    this.auditionKmh = Math.max(0, Math.min(180, kmh));
    this.emit();
  }

  async startDrive(opts?: { demoMotion?: boolean }) {
    try {
      await this.begin("drive", { signature: true });
    } catch {
      this.emit();
      return;
    }
    try {
      this.driveStartedAt = Date.now();
      this.playlistTripStartedAt = Date.now();
      this.playlistSegmentIndex = 0;
      this.classifier.reset();
      this.rulesHeld = false;
      this.suggestedProfileId = null;
      this.ruleLatched.clear();
      this.baseMix = normalizeMix(this.config.mix ?? DEFAULT_LAYER_MIX);
      this.recorder.start(this.config.profileId);
      resetSensorFusion(this.sensorFusion);
      this.pipeline.reset();
      cancelPhoneRelayGrace(this.relayGrace);
      if (this.debugDriveDiagnostics) this.diagnosticsRecorder.clear();
      this.sensorFusion.options.sensitivity = this.config.motionSensitivity;
      this.sensorFusion.options.noiseFloor = this.config.motionNoiseFloor;
      if (!opts?.demoMotion) await this.attachSensors();
      this.syncVehicleTelemetryProvider();
      this.status = "running";
      this.kind = "drive";
      this.lastTick = performance.now();
      this.loop();
      this.bindMediaSession();
      this.attachIdle();
      void this.requestWake();
      this.emit();
    } catch {
      this.status = "error";
      this.error = "Location unavailable";
      this.kind = "idle";
      this.emit();
    }
  }

  async startDemo(initialDemo?: Partial<DemoControls>) {
    try {
      await this.begin("demo", { signature: true });
      this.demo = { ...DEMO_DEFAULTS, ...(initialDemo ?? {}) };
      this.speed = 0;
      this.status = "running";
      this.kind = "demo";
      this.lastTick = performance.now();
      this.loop();
      this.emit();
    } catch {
      this.emit();
    }
  }

  async startAudition() {
    try {
      await this.begin("audition", { signature: false });
      this.status = "running";
      this.kind = "audition";
      this.lastTick = performance.now();
      this.loop();
      this.emit();
    } catch {
      this.emit();
    }
  }

  /**
   * Listen / Preview from Sounds: switch in place when audio is already live.
   * Recreating the AudioContext mid-play (especially in-car browsers) is a
   * common crash path; keep the running engine and only crossfade profiles.
   */
  async listenProfile(profileId: string, kmh = 60) {
    this.syncConfig({ profileId });
    this.setAuditionKmh(kmh);
    if (
      this.engine &&
      (this.status === "running" || this.status === "starting" || this.status === "suspended")
    ) {
      this.emit();
      return;
    }
    await this.startAudition();
  }

  async startReplay(trace: DriveTrace) {
    try {
      await this.begin("replay", { signature: false });
      this.replay = trace;
      this.replayIndex = 0;
      this.status = "running";
      this.kind = "replay";
      this.lastTick = performance.now();
      this.loop();
      this.emit();
    } catch {
      this.emit();
    }
  }

  async startAb(a: string, b: string) {
    try {
      this.ab = { a, b, active: "a" };
      this.config.profileId = a;
      await this.begin("ab", { signature: false });
      this.engineB = new SoundEngine();
      await this.engineB.start(getProfile(b), {
        signature: false,
        environmentId: this.config.environmentId,
        mix: this.config.mix,
      });
      this.engineB.setVolume(0.0001);
      this.status = "running";
      this.kind = "ab";
      this.lastTick = performance.now();
      this.loop();
      this.emit();
    } catch (error) {
      if (this.status !== "error") {
        reportAudioError(error);
        trackEvent("audio_error", { kind: "ab" });
        this.status = "error";
        this.error = "Audio unavailable";
        this.kind = "idle";
      }
      this.emit();
    }
  }

  flipAb() {
    if (!this.ab || !this.engine || !this.engineB) return;
    this.ab = { ...this.ab, active: this.ab.active === "a" ? "b" : "a" };
    const peakA = this.engine.getMeter()?.rms ?? 0.1;
    const peakB = this.engineB.getMeter()?.rms ?? 0.1;
    const match = Math.min(2, (peakA + 0.04) / (peakB + 0.04));
    if (this.ab.active === "a") {
      this.engine.setVolume(
        cappedGain(this.config.volume, this.config.profileGain, getProfile(this.ab.a)),
      );
      this.engineB.setVolume(0.0001);
    } else {
      this.engine.setVolume(0.0001);
      this.engineB.setVolume(
        Math.min(
          0.85,
          cappedGain(this.config.volume, this.config.profileGain, getProfile(this.ab.b)) * match,
        ),
      );
    }
    this.emit();
  }

  stop() {
    this.detachSensors();
    this.detachIdle();
    void this.releaseWake();
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    const trace = this.kind === "drive" ? this.recorder.snapshot() : null;
    if (trace) {
      this.lastTraceId = trace.id;
      this.lastAggregates = trace.aggregates;
      void saveTrace(trace);
    }
    void this.engine?.stop();
    void this.engineB?.stop();
    this.engine = null;
    this.engineB = null;
    this.kind = "idle";
    this.status = "idle";
    this.state = IDLE_STATE;
    this.motion = IDLE_MOTION;
    this.speed = 0;
    this.hasImu = false;
    this.ab = null;
    this.replay = null;
    this.ducking = false;
    this.underruns = 0;
    this.lastAudioTime = 0;
    this.perf = IDLE_PERF;
    this.rulesHeld = false;
    this.suggestedProfileId = null;
    this.playlistTripStartedAt = 0;
    this.playlistSegmentIndex = 0;
    this.ruleLatched.clear();
    this.classifier.reset();
    this.context = "city";
    resetSensorFusion(this.sensorFusion);
    this.pipeline.reset();
    cancelPhoneRelayGrace(this.relayGrace);
    this.releaseVehicleTelemetryProvider();
    this.lastVehicleMotion = vehicleMotionFromDrive({
      speedMps: 0,
      accelerationMps2: 0,
      timestamp: 0,
    });
    if (typeof navigator !== "undefined" && navigator.mediaSession) {
      navigator.mediaSession.playbackState = "none";
    }
    this.emit();
  }

  private async begin(kind: SessionKind, opts: { signature: boolean }) {
    await this.stopSoft();
    this.error = null;
    this.status = "starting";
    this.kind = kind;
    this.underruns = 0;
    this.lastAudioTime = 0;
    this.emit();
    try {
      const profile = getProfile(this.config.profileId);
      const engine = new SoundEngine();
      const primedContext = this.gestureAudioContext;
      this.gestureAudioContext = null;
      await engine.start(profile, {
        signature: opts.signature,
        environmentId: this.config.environmentId,
        mix: this.config.mix,
        snippets: this.config.snippets,
        ...(primedContext ? { context: primedContext } : {}),
      });
      engine.setCabinEq(this.config.cabinEq);
      engine.setIntensityCeiling(cappedGain(1, 1, profile));
      engine.setVolume(cappedGain(this.config.volume, this.config.profileGain, profile));
      engine.setDynamicDriveEnabled(this.powertrainSimActive(profile));
      this.engine = engine;
    } catch (error) {
      reportAudioError(error);
      trackEvent("audio_error", { kind });
      this.status = "error";
      this.error = "Audio unavailable";
      this.kind = "idle";
      throw error;
    }
  }

  /** Tear down audio; await close so the next begin() does not stack contexts. */
  private async stopSoft() {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.detachSensors();
    this.releaseVehicleTelemetryProvider();
    const eng = this.engine;
    const engB = this.engineB;
    this.engine = null;
    this.engineB = null;
    this.powertrainSim = null;
    this.powertrainSoundProfileId = null;
    const stops: Promise<void>[] = [];
    if (eng) stops.push(eng.stop().catch(() => undefined));
    if (engB) stops.push(engB.stop().catch(() => undefined));
    if (stops.length) await Promise.all(stops);
  }

  private loop = () => {
    const now = performance.now();
    const dt = Math.min(0.5, Math.max(0.001, (now - this.lastTick) / 1000));
    this.lastTick = now;
    const profile = getProfile(this.config.profileId);

    if (this.kind === "replay" && this.replay) {
      this.replayIndex += 1;
      const sample = this.replay.samples[this.replayIndex];
      if (!sample) {
        this.stop();
        return;
      }
      this.noteMotion(sample, dt);
      this.tickAudio(sample, dt);
    } else {
      let acceleration = 0;
      let driveVehicleMotion = this.lastVehicleMotion;
      if (this.kind === "drive") {
        const vehicleMotion = tickSensorFusion(this.sensorFusion, { now, dt });
        this.pipeline.noteFusion(now);
        this.lastVehicleMotion = vehicleMotion;
        driveVehicleMotion = vehicleMotion;
        this.speed = vehicleMotion.speedKmh / 3.6;
        acceleration = vehicleMotion.accelerationMs2;
        this.tickAutoRules();
        this.tickPlaylistSegments();
      } else if (this.kind === "demo") {
        const demoTick = tickDemoSpeed(this.speed, dt, this.demo);
        this.speed = demoTick.speedMs;
        acceleration = demoTick.accelerationMs2;
      } else if (this.kind === "audition" || this.kind === "ab") {
        const target = this.auditionKmh / 3.6;
        const rate = target > this.speed ? 2.6 : 3.4;
        const delta = target - this.speed;
        const step = Math.sign(delta) * Math.min(Math.abs(delta), rate * dt);
        const prev = this.speed;
        this.speed = Math.max(0, prev + step);
        acceleration = (this.speed - prev) / dt;
      }

      const next = this.computeNextDriveState({
        speed: this.speed,
        acceleration: Number.isFinite(acceleration) ? acceleration : 0,
        profile,
        dt,
        now,
        ...(this.kind === "drive" ? { vehicleMotion: driveVehicleMotion } : {}),
      });
      if (this.kind === "demo") {
        applyDemoDriveOverrides(next, {
          demo: this.demo,
          speedMs: this.speed,
          profile,
          dynamicDriveActive: this.powertrainSimActive(profile),
        });
      }
      this.context = this.classifier.push(next);
      if (this.kind === "drive" || this.kind === "demo" || this.kind === "audition") {
        this.applyProfileRules(next);
      }
      const audioState = this.applyMotionLatencyComp(next);
      this.noteMotion(next, dt);
      this.tickAudio(audioState, dt);
      if (this.kind === "drive") this.recorder.push(next);
      if (this.kind === "drive" && this.debugDriveDiagnostics) {
        this.recordDriveDiagnostics(next);
      }
    }

    if (now - this.lastUi > UI_MS) {
      this.lastUi = now;
      this.tryEmitUi();
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private tickAutoRules() {
    const mode = this.config.autoRulesMode;
    if (mode === "off" || this.rulesHeld) {
      this.suggestedProfileId = null;
      return;
    }
    const minutes = (Date.now() - this.driveStartedAt) / 60000;
    const nextId = matchRule(
      this.config.autoRules,
      this.speed * 3.6,
      new Date().getHours(),
      minutes,
      this.context,
    );
    if (!nextId || nextId === this.config.profileId) {
      if (mode === "suggest") this.suggestedProfileId = null;
      return;
    }
    if (mode === "auto") {
      this.applyProfile(nextId);
      this.suggestedProfileId = null;
    } else {
      this.suggestedProfileId = nextId;
    }
  }

  private tickPlaylistSegments() {
    if (this.rulesHeld) return;
    const list = this.config.playlists[0];
    const segments = list?.segments;
    if (!segments?.length || !this.playlistTripStartedAt) return;
    const elapsedMin = (Date.now() - this.playlistTripStartedAt) / 60000;
    let cursor = 0;
    let index = 0;
    for (let i = 0; i < segments.length; i += 1) {
      cursor += segments[i]!.minutes;
      if (elapsedMin < cursor) {
        index = i;
        break;
      }
      index = i;
    }
    if (index === this.playlistSegmentIndex) return;
    this.playlistSegmentIndex = index;
    const nextId = segments[index]?.profileId;
    if (nextId) this.applyProfile(nextId);
  }

  private applyProfileRules(state: DriveState) {
    const fromCustom = this.config.activeProfileRules;
    const fromBuiltIn = this.config.profileRules[this.config.profileId] ?? [];
    const rules = fromCustom.length ? fromCustom : fromBuiltIn;
    if (!rules.length) return;
    const result = evaluateProfileRules({
      rules,
      kmh: state.speed * 3.6,
      throttle: state.throttle,
      regen: state.regen,
      context: this.context,
      mix: this.baseMix,
      latched: this.ruleLatched,
    });
    this.ruleLatched = result.latched;
    this.engine?.setMix(result.mix);
    if (result.environmentId) this.engine?.setEnvironment(result.environmentId);
    result.snippetIds.forEach((id) => this.engine?.fireSnippetById(id));
  }

  private computeNextDriveState(input: {
    speed: number;
    acceleration: number;
    profile: ReturnType<typeof getProfile>;
    dt: number;
    now: number;
    vehicleMotion?: VehicleMotionState;
  }): DriveState {
    const { speed, acceleration, profile, dt, now, vehicleMotion } = input;

    if (this.powertrainSimActive(profile)) {
      if (!this.powertrainSim || this.powertrainSoundProfileId !== profile.id) {
        this.powertrainSim = new PowertrainSimulator({
          profile: powertrainProfileForSound(profile),
        });
        this.powertrainSoundProfileId = profile.id;
      }

      let directThrottle: number | undefined;
      let braking: number | undefined;
      if (this.kind === "demo") {
        const sel = this.demo.selector;
        const canRev = sel === "N" || sel === "D" || sel === "R";
        directThrottle = canRev ? Math.min(1, Math.max(0, this.demo.throttle)) : 0;
        braking = Math.min(1, Math.max(0, this.demo.regen));
        if (sel === "P" && speed > 0.2) braking = Math.max(braking, 0.85);
      } else if (this.kind === "audition" || this.kind === "ab") {
        directThrottle = Math.min(1, Math.max(0, acceleration / 2.6 + speed / 60));
      }

      const motion =
        vehicleMotion ??
        vehicleMotionFromDrive({
          speedMps: speed,
          accelerationMps2: acceleration,
          timestamp: now,
          throttle: directThrottle ?? this.state.throttle,
          regen: this.state.regen,
          source: this.kind === "demo" ? "simulator" : "phone",
        });

      const pt = this.powertrainSim.tick(motion, dt, {
        ...(directThrottle !== undefined ? { directThrottle } : {}),
        ...(braking !== undefined ? { braking } : {}),
      });
      this.pipeline.notePowertrain(performance.now());

      return driveStateFromPowertrain(pt, motion, this.state, this.config.tuning, dt);
    }

    return computeDriveState({
      speed,
      acceleration,
      previous: this.state,
      profile: withPersonalityTransmission(profile),
      dt,
      tuning: this.config.tuning,
      shiftFeel: this.config.shiftFeel,
    });
  }

  private tickAudio(state: DriveState, wallDt: number) {
    this.pipeline.noteAudio(performance.now());
    const started = performance.now();
    this.engine?.update(state);
    this.engineB?.update(state);
    const updateMs = performance.now() - started;
    const lat = this.engine?.getPerf() ?? { baseLatencyMs: 0, outputLatencyMs: 0, currentTime: 0 };
    if (this.lastAudioTime > 0 && lat.currentTime > 0) {
      const audioDt = lat.currentTime - this.lastAudioTime;
      const driftMs = (wallDt - audioDt) * 1000;
      if (this.status === "running" && audioDt >= 0 && audioDt < wallDt * 0.35 && wallDt > 0.018) {
        this.underruns += 1;
      }
      this.perf = {
        baseLatencyMs: lat.baseLatencyMs,
        outputLatencyMs: lat.outputLatencyMs,
        updateMs,
        loadPct: Math.min(100, (updateMs / (wallDt * 1000)) * 100),
        underruns: this.underruns,
        driftMs,
      };
    } else {
      this.perf = {
        baseLatencyMs: lat.baseLatencyMs,
        outputLatencyMs: lat.outputLatencyMs,
        updateMs,
        loadPct: Math.min(100, (updateMs / 16.67) * 100),
        underruns: this.underruns,
        driftMs: 0,
      };
    }
    if (lat.currentTime > 0) this.lastAudioTime = lat.currentTime;
  }

  private ingestGpsPosition(pos: GeolocationPosition) {
    const atMs = performance.now();
    const resolved = resolveGpsSpeed({
      reportedSpeed: pos.coords.speed,
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      atMs,
      previous: this.gpsPoint,
      accuracyM: pos.coords.accuracy,
    });
    this.gpsPoint = resolved.point;
    // Prefer reported or delta samples. Skip "none" so fusion keeps the last
    // good fix instead of treating a null-speed browser fix as fresh zero.
    if (resolved.source !== "none") {
      this.gpsAt = atMs;
      pushMotionSample(
        this.sensorFusion,
        browserGpsMotionSample({
          speedMs: resolved.speed,
          accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
          timestamp: pos.timestamp || Date.now(),
        }),
        atMs,
      );
    }
  }

  private async attachSensors() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      throw new Error("no-geo");
    }
    this.gpsPoint = null;
    const DM = window.DeviceMotionEvent as typeof DeviceMotionEvent & {
      requestPermission?: () => Promise<PermissionState>;
    };
    if (typeof DM?.requestPermission === "function") {
      try {
        await DM.requestPermission();
      } catch {
        /* IMU stays optional */
      }
    }
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          this.ingestGpsPosition(pos);
          if (!settled) {
            settled = true;
            resolve();
          }
        },
        (err) => {
          if (!settled) {
            settled = true;
            reject(err);
          }
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
      );
    });
    this.motionHandler = (event: DeviceMotionEvent) => {
      const y = event.accelerationIncludingGravity?.y ?? event.acceleration?.y;
      if (typeof y === "number") {
        const at = performance.now();
        this.hasImu = true;
        pushMotionSample(
          this.sensorFusion,
          browserImuMotionSample({ accelMs2: y, timestamp: Date.now() }),
          at,
        );
      }
    };
    window.addEventListener("devicemotion", this.motionHandler);
  }

  private detachSensors() {
    if (this.watchId !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.motionHandler) {
      window.removeEventListener("devicemotion", this.motionHandler);
      this.motionHandler = null;
    }
    this.gpsPoint = null;
  }

  private clearHideTimer() {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  private attachIdle() {
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("pagehide", this.onPageHide);
    window.addEventListener("pageshow", this.onPageShow);
    this.engine?.onInterrupt(() => this.duck(true));
  }

  private detachIdle() {
    this.clearHideTimer();
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("pagehide", this.onPageHide);
    window.removeEventListener("pageshow", this.onPageShow);
  }

  private onPageHide = () => {
    this.clearHideTimer();
    void this.suspend();
  };

  private onPageShow = () => {
    this.clearHideTimer();
    void this.resume();
    if (this.kind === "drive") void this.requestWake();
  };

  private onVisibility = () => {
    if (document.hidden) {
      // Drive: grace so a quick shade / multitask peek does not kill audio.
      if (this.kind === "drive" && this.status === "running") {
        this.clearHideTimer();
        this.hideTimer = setTimeout(() => {
          this.hideTimer = null;
          if (document.hidden) void this.suspend();
        }, DRIVE_HIDE_GRACE_MS);
        return;
      }
      void this.suspend();
      return;
    }
    this.clearHideTimer();
    void this.resume();
    if (this.kind === "drive") void this.requestWake();
  };

  async suspend() {
    if (this.status !== "running" || !this.engine) return;
    await this.engine.fadeAndSuspend();
    this.status = "suspended";
    this.emit();
  }

  async resume() {
    if (this.status !== "suspended" || !this.engine) return;
    await this.engine.resumeFromIdle();
    this.status = "running";
    this.ducking = false;
    // Keep the rAF spine alive after long backgrounding.
    if (this.raf === null && (this.kind === "drive" || this.kind === "demo")) {
      this.lastTick = performance.now();
      this.loop();
    }
    this.emit();
  }

  duck(on: boolean) {
    this.ducking = on;
    this.engine?.setDuck(on ? 0.15 : 1);
    this.emit();
  }

  /** Fire a manual layer accent (e.g. submarine sonar ping). */
  triggerLayer(id: string) {
    this.engine?.triggerImprovedLayer(id);
  }

  /** Ingest Tesla Fleet Telemetry record (server bridge). No-op when flag off or no mappable fields. */
  ingestVehicleTelemetry(record: TeslaFleetTelemetryRecord) {
    if (!this.config.teslaFleetTelemetry) return;
    const tesla = getTeslaFleetTelemetryProvider();
    if (tesla) {
      tesla.ingest(record);
      return;
    }
    const sample = mapTeslaFleetSignalsToMotionSample(record);
    if (!sample) return;
    pushMotionSample(this.sensorFusion, sample, performance.now());
  }

  /** Ingest Fleet Telemetry forwarded over the Drive relay (display role). */
  ingestVehicleTelemetryRelay(message: RelayTelemetryMessage) {
    if (!this.config.teslaFleetTelemetry) return;
    this.pipeline.noteVehicleTelemetry(message, performance.now());
    this.ingestVehicleTelemetry(message.record);
  }

  getVehicleTelemetryStatus() {
    return this.vehicleTelemetryProvider?.getStatus() ?? null;
  }

  private syncVehicleTelemetryProvider() {
    this.releaseVehicleTelemetryProvider();
    const provider = createVehicleTelemetryProvider({
      enabled: this.config.teslaFleetTelemetry,
      kind: this.config.teslaFleetTelemetry ? "tesla-fleet" : "none",
    });
    this.vehicleTelemetryProvider = provider;
    this.vehicleTelemetryUnsub = provider.subscribe((sample) => {
      pushMotionSample(this.sensorFusion, sample, performance.now());
    });
    if (this.config.teslaFleetTelemetry) {
      void provider.connect().catch(() => undefined);
    }
  }

  private releaseVehicleTelemetryProvider() {
    this.vehicleTelemetryUnsub?.();
    this.vehicleTelemetryUnsub = null;
    void this.vehicleTelemetryProvider?.disconnect();
    this.vehicleTelemetryProvider = null;
  }

  /** Ingest phone relay motion with pipeline timestamps (no raw coordinates). */
  ingestPhoneRelayMotion(message: RelayMotionMessage) {
    const receivedAt = performance.now();
    if (this.sensorFusion.fallback.phoneSuspended) {
      markPhoneRelayRestored(this.sensorFusion, receivedAt);
      this.pipeline.noteReconnect();
    }
    this.pipeline.notePhoneRelay(message, receivedAt);
    pushMotionSample(this.sensorFusion, phoneRelayMotionSample(message.sample), receivedAt);
    this.fuseMotionOnIngest(receivedAt);
  }

  /** Fuse immediately when relay samples arrive — do not wait for the next animation frame. */
  private fuseMotionOnIngest(now: number) {
    if (this.kind !== "drive" || this.status !== "running") return;
    const dt = Math.min(
      0.12,
      Math.max(
        0.001,
        this.lastFusionIngestAt > 0 ? (now - this.lastFusionIngestAt) / 1000 : 1 / 60,
      ),
    );
    this.lastFusionIngestAt = now;
    const vehicleMotion = tickSensorFusion(this.sensorFusion, { now, dt });
    this.pipeline.noteFusion(now);
    this.lastVehicleMotion = vehicleMotion;
    this.speed = vehicleMotion.speedKmh / 3.6;
  }

  /** Phone relay peer dropped — wait for reconnect before suspending phone tier. */
  onPhoneRelayPeerLost() {
    schedulePhoneRelayGrace(this.relayGrace, () => {
      markPhoneRelayLost(this.sensorFusion);
      this.pipeline.noteReconnect();
    });
  }

  /** Phone relay peer returned within grace window. */
  onPhoneRelayPeerAvailable() {
    cancelPhoneRelayGrace(this.relayGrace);
    markPhoneRelayRestored(this.sensorFusion);
    this.pipeline.noteReconnect();
  }

  /** @deprecated Prefer onPhoneRelayPeerLost (grace). Immediate suspend for tests. */
  notifyPhoneRelayLost() {
    cancelPhoneRelayGrace(this.relayGrace);
    markPhoneRelayLost(this.sensorFusion);
  }

  notifyPhoneRelayAvailable() {
    this.onPhoneRelayPeerAvailable();
  }

  setDebugDriveDiagnostics(enabled: boolean) {
    this.debugDriveDiagnostics = enabled;
    if (!enabled) this.diagnosticsRecorder.clear();
  }

  getDebugDriveDiagnostics() {
    return this.debugDriveDiagnostics;
  }

  getDriveDiagnostics(): DriveDiagnosticsFrame {
    return this.collectDriveDiagnosticsFrame(this.state);
  }

  exportDriveDiagnosticsSession(): DiagnosticsSessionExport {
    return buildDiagnosticsSessionExport(
      this.diagnosticsRecorder.snapshot(),
      this.diagnosticsSessionMeta(),
    );
  }

  getDriveDiagnosticsSessionFrameCount(): number {
    return this.diagnosticsRecorder.snapshot().length;
  }

  clearDriveDiagnosticsSession() {
    this.diagnosticsRecorder.clear();
  }

  private diagnosticsSessionMeta(): DiagnosticsSessionMeta {
    const profile = getProfile(this.config.profileId);
    const synthesisMode = this.engine?.getDynamicDriveEnabled()
      ? "dynamic-drive"
      : (this.engine?.getSynthesisMode() ?? "legacy");
    return {
      profileId: this.config.profileId,
      profileName: profile.name,
      dynamicDrive: this.config.dynamicDrive,
      synthesisMode,
      productStatus: this.resolveProductStatus(),
    };
  }

  private collectDriveDiagnosticsFrame(driveState: DriveState): DriveDiagnosticsFrame {
    const synthesisMode = this.engine?.getDynamicDriveEnabled()
      ? "dynamic-drive"
      : (this.engine?.getSynthesisMode() ?? "legacy");
    return collectDriveDiagnostics({
      sensorFusion: this.sensorFusion,
      vehicleMotion: this.lastVehicleMotion,
      driveState,
      pipeline: this.pipeline.snapshot(Date.now(), this.lastVehicleMotion.fallbackTier),
      synthesisMode,
      dynamicLayers: this.engine?.getDynamicDriveDebug() ?? [],
      meter: this.safeMeter(),
      perf: this.perf,
    });
  }

  private recordDriveDiagnostics(driveState: DriveState) {
    const now = Date.now();
    if (now - this.diagnosticsRecordAt < 500) return;
    this.diagnosticsRecordAt = now;
    this.diagnosticsRecorder.record(this.collectDriveDiagnosticsFrame(driveState));
  }

  /** @deprecated Use ingestPhoneRelayMotion */
  ingestPhoneMotion(sample: MotionSample) {
    this.ingestPhoneRelayMotion({
      type: "motion",
      from: "phone",
      at: Date.now(),
      seq: 0,
      sample,
    });
  }

  getPipelineMetrics(): MotionPipelineMetrics {
    return this.pipeline.snapshot();
  }

  /** Latest fused motion estimate for Dynamic Drive instrumentation. */
  getVehicleMotion() {
    return this.lastVehicleMotion;
  }

  private applyMotionLatencyComp(state: DriveState): DriveState {
    const phoneLive = this.lastVehicleMotion.sourceHealth.phone;
    const relayComp = phoneLive ? this.pipeline.suggestedLatencyCompMs() : 0;
    const compMs = phoneLive
      ? Math.max(this.config.latencyCompMs, relayComp)
      : this.config.latencyCompMs;
    if (compMs <= 0) return state;
    return predictState(state, compMs);
  }

  private bindMediaSession() {
    try {
      if (typeof navigator === "undefined" || !navigator.mediaSession) return;
      const profile = getProfile(this.config.profileId);
      if (typeof MediaMetadata !== "undefined") {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: profile.name,
          artist: "ELCAMOSO",
          album: "Sound in motion",
        });
      }
      navigator.mediaSession.playbackState = this.status === "running" ? "playing" : "paused";
      navigator.mediaSession.setActionHandler("play", () => {
        if (this.status === "idle") void this.startDrive();
        else void this.resume();
      });
      navigator.mediaSession.setActionHandler("pause", () => this.stop());
      navigator.mediaSession.setActionHandler("nexttrack", () => this.stepPlaylist(1));
      navigator.mediaSession.setActionHandler("previoustrack", () => this.stepPlaylist(-1));
    } catch {
      /* In-car browsers often stub Media Session incompletely. */
    }
  }

  private stepPlaylist(dir: number) {
    const list = this.config.playlists[0];
    const ids = list?.segments?.length
      ? list.segments.map((s) => s.profileId)
      : (list?.profileIds ?? []);
    if (!ids.length) return;
    const i = Math.max(0, ids.indexOf(this.config.profileId));
    const next = ids[(i + dir + ids.length) % ids.length];
    if (next) {
      this.applyProfile(next);
      this.rulesHeld = true;
      this.emit();
    }
  }

  private async requestWake() {
    if (typeof navigator === "undefined" || !navigator.wakeLock) return;
    if (typeof document !== "undefined" && document.hidden) return;
    await this.releaseWake();
    try {
      const sentinel = await navigator.wakeLock.request("screen");
      this.wake = sentinel;
      this.wakeReleaseHandler = () => {
        this.wake = null;
        this.wakeReleaseHandler = null;
        // Browser releases wake on hide; reclaim when Drive is still live.
        if (
          this.kind === "drive" &&
          (this.status === "running" || this.status === "suspended") &&
          typeof document !== "undefined" &&
          !document.hidden
        ) {
          void this.requestWake();
        }
      };
      sentinel.addEventListener("release", this.wakeReleaseHandler);
    } catch {
      this.wake = null;
      this.wakeReleaseHandler = null;
    }
  }

  private async releaseWake() {
    if (this.wake && this.wakeReleaseHandler) {
      try {
        this.wake.removeEventListener("release", this.wakeReleaseHandler);
      } catch {
        /* */
      }
    }
    this.wakeReleaseHandler = null;
    try {
      await this.wake?.release();
    } catch {
      /* */
    }
    this.wake = null;
  }
}

let singleton: DriveSession | null = null;

export function getSession(): DriveSession {
  if (!singleton) singleton = new DriveSession();
  return singleton;
}
