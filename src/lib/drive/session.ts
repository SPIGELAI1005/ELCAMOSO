import { computeDriveState, IDLE_STATE, type DriveState } from "@/lib/drive/model";
import { fuseMotion } from "@/lib/drive/fusion";
import { resolveGpsSpeed, type GpsPoint } from "@/lib/drive/gps-speed";
import { cappedGain } from "@/lib/drive/safety";
import { matchRule, type AutoRule, type AutoRulesMode, type ProfileRule } from "@/lib/drive/rules";
import { ContextClassifier, predictState, type DriveContext } from "@/lib/drive/context";
import { evaluateProfileRules } from "@/lib/drive/profile-rules";
import { DEFAULT_CABIN_EQ, DEFAULT_SHIFT_FEEL, type CabinEq, type ShiftFeel } from "@/lib/drive/types-extra";
import { TraceRecorder, saveTrace, type DriveTrace, type TraceAggregates } from "@/lib/drive/traces";
import { SoundEngine, type MeterReading } from "@/lib/sound/engine";
import { getProfile } from "@/lib/sound/profiles";
import type { ProfileTuning, Playlist } from "@/lib/drive/settings";
import { DEFAULT_LAYER_MIX, normalizeMix, type LayerMix } from "@/lib/sound/environments";
import type { SoundSnippet } from "@/lib/sound/snippets";
import { reportAudioError } from "@/lib/telemetry/crashes";
import { trackEvent } from "@/lib/telemetry/analytics";

/** Brief hide (notification shade) should not kill Drive audio immediately. */
const DRIVE_HIDE_GRACE_MS = 2800;

export type SessionKind = "idle" | "drive" | "demo" | "audition" | "replay" | "ab";
export type SessionStatus = "idle" | "starting" | "running" | "error" | "suspended";

export type DemoSelector = "P" | "R" | "N" | "D";

export interface DemoControls {
  throttle: number;
  accel: number;
  regen: number;
  /** Park / Reverse / Neutral / Drive for demo listening. */
  selector: DemoSelector;
}

export const DEMO_DEFAULTS: DemoControls = {
  throttle: 0.3,
  accel: 0.5,
  regen: 0,
  selector: "D",
};

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
  private gpsSpeed = 0;
  private gpsAt = 0;
  private gpsPoint: GpsPoint | null = null;
  private accY: number | null = null;
  private imuAt = 0;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private wakeReleaseHandler: (() => void) | null = null;
  private speed = 0;
  private state: DriveState = IDLE_STATE;
  private kind: SessionKind = "idle";
  private status: SessionStatus = "idle";
  private error: string | null = null;
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
  };
  private cached: SessionSnapshot | null = null;

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
    return {
      kind: this.kind,
      status: this.status,
      error: this.error,
      state: this.state,
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
    };
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.cached = this.read();
    this.listeners.forEach((fn) => fn());
  }

  syncConfig(next: Partial<SessionConfig>) {
    const prevId = this.config.profileId;
    const merged: SessionConfig = { ...this.config, ...next };
    if (next.mix) merged.mix = normalizeMix(next.mix);

    // Skip emit when content is unchanged. Callers often pass fresh object
    // identities (e.g. getTuning() spreads) that would otherwise loop:
    // syncConfig → emit → re-render → new refs → syncConfig.
    if (configFingerprint(this.config) === configFingerprint(merged)) return;

    this.config = merged;
    if (next.mix && merged.mix) this.baseMix = merged.mix;
    const profile = getProfile(this.config.profileId);
    const gain = cappedGain(this.config.volume, this.config.profileGain, profile);
    this.engine?.setVolume(gain);
    this.engine?.setProfileGain(1);
    this.engine?.setIntensityCeiling(cappedGain(1, 1, profile));
    if (next.profileId && next.profileId !== prevId) {
      try {
        this.engine?.setProfile(profile);
      } catch (error) {
        reportAudioError(error);
      }
      this.ruleLatched.clear();
      this.suggestedProfileId = null;
    }
    if (next.environmentId) this.engine?.setEnvironment(next.environmentId);
    if (next.mix) this.engine?.setMix(next.mix);
    if (next.snippets) void this.engine?.setSnippets(next.snippets);
    if (next.cabinEq) this.engine?.setCabinEq(next.cabinEq);
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
    merged.selector =
      sel === "P" || sel === "R" || sel === "N" || sel === "D" ? sel : "D";
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
      if (!opts?.demoMotion) await this.attachSensors();
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

  async startDemo() {
    try {
      await this.begin("demo", { signature: true });
      this.demo = { ...DEMO_DEFAULTS };
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
      (this.status === "running" ||
        this.status === "starting" ||
        this.status === "suspended")
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
      this.engine.setVolume(cappedGain(this.config.volume, this.config.profileGain, getProfile(this.ab.a)));
      this.engineB.setVolume(0.0001);
    } else {
      this.engine.setVolume(0.0001);
      this.engineB.setVolume(
        Math.min(0.85, cappedGain(this.config.volume, this.config.profileGain, getProfile(this.ab.b)) * match),
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
    this.speed = 0;
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
      await engine.start(profile, {
        signature: opts.signature,
        environmentId: this.config.environmentId,
        mix: this.config.mix,
        snippets: this.config.snippets,
      });
      engine.setCabinEq(this.config.cabinEq);
      engine.setIntensityCeiling(cappedGain(1, 1, profile));
      engine.setVolume(cappedGain(this.config.volume, this.config.profileGain, profile));
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
    const eng = this.engine;
    const engB = this.engineB;
    this.engine = null;
    this.engineB = null;
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
      this.state = sample;
      this.tickAudio(sample, dt);
    } else {
      let acceleration = 0;
      if (this.kind === "drive") {
        const fused = fuseMotion({
          gpsSpeed: this.gpsAt ? this.gpsSpeed : null,
          gpsAt: this.gpsAt,
          accY: this.accY,
          imuAt: this.imuAt,
          now,
          dt,
          previousSpeed: this.speed,
          sensitivity: this.config.motionSensitivity,
          noiseFloor: this.config.motionNoiseFloor,
        });
        this.speed = fused.speed;
        acceleration = fused.accel || (this.speed - this.state.speed) / dt;
        this.tickAutoRules();
        this.tickPlaylistSegments();
      } else if (this.kind === "demo") {
        const { throttle, accel, regen, selector } = this.demo;
        const drag = 0.02 * this.speed + 0.25;
        // P/N: no drive force. D/R: throttle pushes. P/N bleed speed to a stop.
        const freewheeling = selector === "P" || selector === "N";
        const push = freewheeling ? 0 : throttle * (1.6 + accel * 4.4);
        const holdBrake =
          selector === "P"
            ? this.speed > 0.15
              ? 0.95
              : 0
            : selector === "N"
              ? this.speed > 0.15
                ? 0.55
                : 0
              : 0;
        const brake = Math.max(regen, holdBrake) * (selector === "P" ? 5.5 : 4.2);
        const a = push - brake - (this.speed > 0 ? drag : 0);
        const prev = this.speed;
        this.speed = Math.max(0, Math.min(80, prev + a * dt));
        acceleration = (this.speed - prev) / dt;
      } else if (this.kind === "audition" || this.kind === "ab") {
        const target = this.auditionKmh / 3.6;
        const rate = target > this.speed ? 2.6 : 3.4;
        const delta = target - this.speed;
        const step = Math.sign(delta) * Math.min(Math.abs(delta), rate * dt);
        const prev = this.speed;
        this.speed = Math.max(0, prev + step);
        acceleration = (this.speed - prev) / dt;
      }

      const next = computeDriveState({
        speed: this.speed,
        acceleration: Number.isFinite(acceleration) ? acceleration : 0,
        previous: this.state,
        profile,
        dt,
        tuning: this.config.tuning,
        shiftFeel: this.config.shiftFeel,
      });
      if (this.kind === "demo") {
        const sel = this.demo.selector;
        const canRev = sel === "N" || sel === "D" || sel === "R";
        const throttle = canRev ? Math.min(1, Math.max(0, this.demo.throttle)) : 0;
        const regen = Math.min(1, Math.max(0, this.demo.regen));
        const neutralRev = sel === "N";

        next.throttle = Math.max(next.throttle, throttle);
        next.regen =
          sel === "P" && this.speed > 0.2
            ? Math.max(next.regen, 0.85, regen)
            : Math.max(next.regen, regen);

        if (canRev && throttle > 0.02) {
          next.load = Math.max(
            next.load,
            Math.min(1, throttle * (neutralRev ? 0.98 : 0.88)),
          );
          const tx = profile.transmission;
          if (profile.drivetrainMode !== "continuous" && tx) {
            const revRpm =
              tx.idleRpm +
              this.speed * 3.6 * (tx.gearRatios[Math.max(0, next.gear - 1)] ?? tx.gearRatios[0]!) +
              throttle * (tx.redlineRpm - tx.idleRpm) * (neutralRev ? 0.96 : 0.55);
            next.rpm = Math.max(next.rpm, Math.min(tx.redlineRpm, revRpm));
          }
        } else if (sel === "P") {
          next.throttle = 0;
        }

        if (sel === "P" || sel === "N") next.gear = 0;
        else if (sel === "R") next.gear = -1;
      }
      this.context = this.classifier.push(next);
      if (this.kind === "drive" || this.kind === "demo" || this.kind === "audition") {
        this.applyProfileRules(next);
      }
      const audioState =
        this.config.latencyCompMs > 0 ? predictState(next, this.config.latencyCompMs) : next;
      this.state = next;
      this.tickAudio(audioState, dt);
      if (this.kind === "drive") this.recorder.push(next);
    }

    if (now - this.lastUi > UI_MS) {
      this.lastUi = now;
      this.emit();
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

  private tickAudio(state: DriveState, wallDt: number) {
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
      this.gpsSpeed = resolved.speed;
      this.gpsAt = atMs;
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
        this.accY = y;
        this.imuAt = performance.now();
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
      navigator.mediaSession.playbackState =
        this.status === "running" ? "playing" : "paused";
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
    const ids =
      list?.segments?.length
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
