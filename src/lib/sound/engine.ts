import type { DriveState } from "@/lib/drive/model";
import { DEFAULT_CABIN_EQ, type CabinEq } from "@/lib/drive/types-extra";
import type { RhythmSpec, SignalSpec, SoundProfile, TextureSpec } from "@/lib/sound/profiles";
import {
  DEFAULT_LAYER_MIX,
  getEnvironment,
  normalizeMix,
  type EnvironmentPreset,
  type LayerKey,
  type LayerMix,
} from "@/lib/sound/environments";
import { audioRandom, seedAudioRandom } from "@/lib/sound/rng";
import type { SoundSnippet } from "@/lib/sound/snippets";
import { createMasterBus, type MasterBus } from "@/lib/sound/realism/master-bus";
import { ImprovedSynth } from "@/lib/sound/realism/improved-synth";
import {
  loudnessForProfile,
  makeupDbForProfile,
  makeupStageSettings,
} from "@/lib/sound/realism/loudness";
import type { DynamicLayerDebugInfo, SynthesisMode } from "@/lib/sound/realism/types";
import type { AudioLayerRole } from "@/lib/sound/profile-experience-config";
import { DynamicDriveSynth } from "@/lib/sound/dynamic-drive/synth";
import { supportsDynamicDrive } from "@/lib/powertrain/adapters/profile-map";
import { reportAudioError } from "@/lib/telemetry/crashes";
import { PROFILE_SWITCH_VOLUME_SCALE, STARTUP_VOLUME_SCALE } from "@/lib/sound/perceptual-volume";
import {
  BODY_CHARACTER_SHELF_DB,
  CHARACTER_NEUTRAL,
  SAMPLE_PEAK_CEILING_DBFS,
  SAMPLE_PEAK_CEILING_LINEAR,
  USER_STAGE_CEILING,
  computeUserStageLinearGain,
  createPeakProtectStage,
  linearToDb,
  mildMasterLoadScale,
  type PeakProtectStage,
} from "@/lib/sound/gain-staging";
import { intensityCeiling as intensityCeilingForProfile } from "@/lib/drive/safety";
import {
  ensureCombustionWorklet,
  HybridCombustionSynth,
  isCombustionRealismV2Profile,
  type HybridCombustionDiagnostics,
  type RealismEngineMode,
} from "@/lib/sound/realism/v2";
import {
  isDriveAudioV3Enabled,
  isRawMechanicalPilotId,
  rawMechanicalPresetFor,
  resolveRawMechanicalQualityTier,
} from "@/lib/sound/realism/v3";
import { isSymphonyProfileId, SymphonySynth } from "@/lib/symphony";
import { FusionSynth, isFusionProfileId } from "@/lib/fusion";
import { isWorldProfileId, WorldSynth } from "@/lib/worlds";
import { fetchSoundAssetManifest } from "@/lib/sound-assets/client-loader";
import { getSharedSampleLoader } from "@/lib/sound/realism/samples";
import { loadRecordedLoopBuffers } from "@/lib/sound/realism/v2/recorded-loops-loader";
import { DEFAULT_TIMELINE_GAP_FLUSH_MS } from "@/lib/sound/realism/shift-events";
import { resolvePersonalityId } from "@/lib/drive/drivetrain-resolve";

export interface MeterReading {
  prePeak: number;
  preRms: number;
  peak: number;
  rms: number;
  headroom: number;
  /** Soft program-compressor reduction (MasterBus), not peak protect. */
  reduction: number;
  compressorReduction: number;
  /** Sample peak at output tap, dBFS. */
  samplePeakDbfs: number;
  /** True when post-protect sample peak is within ~0.5 dB of the declared ceiling. */
  nearCeiling: boolean;
  /** Dev/lab: count of analyser samples at/above the declared ceiling this read. */
  overloadSampleCount: number;
}

export interface SoundGainDiagnostics {
  /** UI slider 0..1 (not the post-perceptual linear gain). */
  userVolume: number;
  profileGain: number;
  loudnessTrim: number;
  loadScale: number;
  outputBoostDb: number;
  bodyCharacter: number;
  mechanicalCharacter: number;
  effectiveMasterTarget: number;
  masterNode: number;
  boostNode: number;
  duck: number;
  body: number;
  accents: number;
  beds: number;
  wet: number;
  profileBusOutput: number;
  samplePeakCeilingDbfs: number;
  peakProtectLookaheadMs: number;
}

interface TextureNode {
  spec: TextureSpec;
  gain: GainNode;
  filter: BiquadFilterNode;
  src: AudioBufferSourceNode;
  panner: StereoPannerNode;
  /** stereo placement phase so beds drift independently */
  phase: number;
  lfo?: { osc: OscillatorNode; gain: GainNode };
}

interface RhythmClock {
  spec: RhythmSpec;
  next: number;
  step: number;
}

interface SignalClock {
  spec: SignalSpec;
  next: number;
}

/** One mixable layer: tone shaping, stereo placement, level and reverb send. */
interface LayerChain {
  input: GainNode;
  tone: BiquadFilterNode;
  panner: StereoPannerNode;
  out: GainNode;
  send: GainNode;
  phase: number;
}

interface SnippetVoice {
  snippet: SoundSnippet;
  buffer: AudioBuffer;
  /** next allowed play time, so triggers cannot machine-gun */
  next: number;
  loopSrc?: AudioBufferSourceNode;
}

/**
 * Motion-to-sound synthesis. Every profile consumes the same DriveState but maps
 * it through its own strategy (virtual transmission vs. continuous), layering a
 * tonal core, atmospheric beds, speed-locked rhythms and occasional signatures.
 *
 * Layers run through their own tone, stereo and reverb-send chain, so a driving
 * environment can place and rebalance them live as the drive state changes.
 */
export class SoundEngine {
  private ctx: BaseAudioContext | null = null;
  private master: GainNode | null = null;
  private duck: GainNode | null = null;
  private cabinIn: GainNode | null = null;
  private cabinLow: BiquadFilterNode | null = null;
  private cabinMid: BiquadFilterNode | null = null;
  private cabinHigh: BiquadFilterNode | null = null;
  /** @deprecated Prompt 08 — peak protect replaces DynamicsCompressor-as-limiter. */
  private limiter: DynamicsCompressorNode | null = null;
  private boostGain: GainNode | null = null;
  /** Catalog loudness makeup (non-engine profiles) after the user-volume stage. */
  private makeupGain: GainNode | null = null;
  private makeupLimiter: DynamicsCompressorNode | null = null;
  private peakProtect: PeakProtectStage | null = null;
  private analyser: AnalyserNode | null = null;
  private meterBuffer: Float32Array<ArrayBuffer> | null = null;
  private preAnalyser: AnalyserNode | null = null;
  private preMeterBuffer: Float32Array<ArrayBuffer> | null = null;
  private body: GainNode | null = null;
  private accents: GainNode | null = null;
  private beds: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private layers: Partial<Record<LayerKey, LayerChain>> = {};
  private reverb: ConvolverNode | null = null;
  private reverbDamp: BiquadFilterNode | null = null;
  private wet: GainNode | null = null;
  private environment: EnvironmentPreset = getEnvironment(null);
  private mix: LayerMix = DEFAULT_LAYER_MIX;
  private snippets: SnippetVoice[] = [];
  private snippetToken = 0;
  private lastThrottle = 0;
  private lastRegen = 0;
  private voices: { osc: OscillatorNode; gain: GainNode; ratio: number }[] = [];
  private noise: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private lfo: { osc: OscillatorNode; gain: GainNode } | null = null;
  private textures: TextureNode[] = [];
  private rhythms: RhythmClock[] = [];
  private signals: SignalClock[] = [];
  private profile: SoundProfile | null = null;
  /** Stable per-interpretation seed (Journey Replay passes its saved seed). */
  private experienceSeed = 1;
  /** UI master volume 0..1 (perceptual curve applied in computeUserStageLinearGain). */
  private volume = 0.35;
  /** per-profile balance gain, 0.4..1.6 */
  private profileGain = 1;
  private outputBoostDb = 0;
  private bodyCharacter = CHARACTER_NEUTRAL;
  private mechanicalCharacter = CHARACTER_NEUTRAL;
  private lastLoadScale = 1;
  private lastMasterTarget = 0;
  /** Pre-boost intensity-band ceiling. */
  static readonly MAX_GAIN = USER_STAGE_CEILING;
  private intensityCeiling = USER_STAGE_CEILING;
  private cabinEq: CabinEq = DEFAULT_CABIN_EQ;
  private cabinLowNeutralDb = 0;
  private duckAmount = 1;
  private renderTime: number | null = null;
  private interruptHandler: (() => void) | null = null;
  private whiteBuffer: AudioBuffer | null = null;
  private pinkBuffer: AudioBuffer | null = null;
  private swapTimer: ReturnType<typeof setTimeout> | null = null;
  /** True while a crossfade rebuild is in flight; skip per-frame updates. */
  private swapping = false;
  /** Latest-wins token for rapid Sound Profile switches. */
  private swapGeneration = 0;
  /** Original (legacy) vs improved multi-layer realism path. */
  private synthesisMode: SynthesisMode = "improved";
  private improved: ImprovedSynth | null = null;
  private experienceTuningEnabled = true;
  private dynamicDriveEnabled = false;
  /** Premium transient tier for Realism V2 (demo / Drive+). Core shifts always render. */
  private advancedTransientsEnabled = true;
  private dynamicDrive: DynamicDriveSynth | null = null;
  private symphony: SymphonySynth | null = null;
  private fusion: FusionSynth | null = null;
  private world: WorldSynth | null = null;
  /** Dev A/B: current engine vs Realism V2. Default v2 for combustion when eligible. */
  private realismEngine: RealismEngineMode = "v2";
  private hybrid: HybridCombustionSynth | null = null;
  private profileBus: MasterBus | null = null;
  private hybridLoadController: AbortController | null = null;
  /** hard ceiling applied before the limiter so no profile can spike */

  setSynthesisMode(mode: SynthesisMode) {
    if (this.synthesisMode === mode) return;
    this.synthesisMode = mode;
    if (this.profile) this.setProfile(this.profile, true);
  }

  getSynthesisMode() {
    return this.synthesisMode;
  }

  /** Dev/offline A/B: bypasses the portfolio phase mixer without changing public profiles. */
  setExperienceTuningEnabled(enabled: boolean) {
    this.experienceTuningEnabled = enabled;
    this.improved?.setExperienceEnabled(enabled);
  }

  /** Dev-only: Current Engine vs Realism V2. Not a customer setting. */
  setRealismEngine(mode: RealismEngineMode) {
    if (this.realismEngine === mode) return;
    this.realismEngine = mode;
    if (this.profile) this.setProfile(this.profile, true);
  }

  getRealismEngine(): RealismEngineMode {
    return this.realismEngine;
  }

  getHybridCombustionDiagnostics(): HybridCombustionDiagnostics | null {
    return this.hybrid?.getDiagnostics() ?? null;
  }

  setDynamicDriveEnabled(enabled: boolean) {
    if (this.dynamicDriveEnabled === enabled) return;
    this.dynamicDriveEnabled = enabled;
    if (this.profile) this.setProfile(this.profile, true);
  }

  getDynamicDriveEnabled() {
    return this.dynamicDriveEnabled;
  }

  /**
   * Drive+ Dynamic Drive extras: rev-match blips, overrun pops, turbo flutter / wastegate.
   * Core upshift / downshift mechanics always render once gears are active.
   */
  setAdvancedTransientsEnabled(enabled: boolean) {
    if (this.advancedTransientsEnabled === enabled) return;
    this.advancedTransientsEnabled = enabled;
    this.hybrid?.setAdvancedTransientsEnabled(enabled);
  }

  getAdvancedTransientsEnabled() {
    return this.advancedTransientsEnabled;
  }

  private shiftIntensity = 0.72;

  /** Mechanical shift intensity 0..1 — not master volume (Prompt 06). */
  setShiftIntensity(value: number) {
    this.shiftIntensity = Math.min(1, Math.max(0, value));
    this.hybrid?.setShiftIntensity(this.shiftIntensity);
  }

  getShiftIntensity() {
    return this.shiftIntensity;
  }

  /** After suspend/resume — discard overdue shift sequence events. */
  notifyAudioTimelineGap(gapMs: number) {
    this.hybrid?.notifyAudioTimelineGap(gapMs);
  }

  /** The strategy that actually owns the current graph, not merely an enabled setting. */
  getActiveBackend(): string {
    if (this.fusion) return "fusion";
    if (this.symphony) return "symphony";
    if (this.world) return "world";
    if (this.hybrid) {
      const diag = this.hybrid.getDiagnostics();
      const prefix = diag.realismEngine === "v3" ? "realism-v3" : "realism-v2";
      return `${prefix}-${diag.excitationMode}`;
    }
    if (this.dynamicDrive) return "dynamic-drive";
    if (this.improved) return "improved";
    return this.ctx ? "legacy" : "stopped";
  }

  getGainDiagnostics(): SoundGainDiagnostics {
    return {
      userVolume: this.volume,
      profileGain: this.profileGain,
      loudnessTrim: this.profile ? loudnessForProfile(this.profile.id) : 1,
      loadScale: this.lastLoadScale,
      outputBoostDb: this.outputBoostDb,
      bodyCharacter: this.bodyCharacter,
      mechanicalCharacter: this.mechanicalCharacter,
      effectiveMasterTarget: this.lastMasterTarget,
      masterNode: this.master?.gain.value ?? 0,
      boostNode: this.boostGain?.gain.value ?? 1,
      duck: this.duck?.gain.value ?? 0,
      body: this.layers.body?.out.gain.value ?? 0,
      accents: this.layers.accents?.out.gain.value ?? 0,
      beds: this.layers.beds?.out.gain.value ?? 0,
      wet: this.wet?.gain.value ?? 0,
      profileBusOutput: this.profileBus?.output.gain.value ?? 0,
      samplePeakCeilingDbfs: SAMPLE_PEAK_CEILING_DBFS,
      peakProtectLookaheadMs: this.peakProtect?.lookaheadMs ?? 0,
    };
  }

  getDynamicDriveDebug(): DynamicLayerDebugInfo[] {
    return this.dynamicDrive?.getDebugInfo() ?? [];
  }

  getSymphonyDiagnostics(audioTime?: number) {
    if (!this.symphony) return null;
    const t = audioTime ?? this.now();
    return this.symphony.getDiagnosticsAt(t);
  }

  getSymphonyEnergy() {
    return (
      this.symphony?.getEnergy() ?? this.fusion?.getEnergy() ?? this.world?.getEnergy() ?? null
    );
  }

  getFusionDiagnostics() {
    return this.fusion?.getDiagnostics() ?? null;
  }

  setFusionMix(mix: number) {
    this.fusion?.setMix(mix, this.now());
  }

  setFusionHarmonicResonance(depth: number) {
    this.fusion?.setHarmonicResonance(depth, this.now());
  }

  getWorldDiagnostics() {
    return this.world?.getDiagnostics() ?? null;
  }

  /** Test/debug visibility for proving interpretation switches release old graphs. */
  getResourceDiagnostics() {
    return {
      contextActive: Boolean(this.ctx),
      oscillatorVoices: this.voices.length,
      textureVoices: this.textures.length,
      snippetVoices: this.snippets.length,
      strategyCount: [
        this.improved,
        this.dynamicDrive,
        this.symphony,
        this.fusion,
        this.world,
        this.hybrid,
      ].filter(Boolean).length,
    };
  }

  listImprovedLayers() {
    if (this.hybrid) {
      return this.hybrid.listLayers();
    }
    if (this.dynamicDrive) {
      return this.dynamicDrive.listLayers().map((l) => ({ ...l, triggerable: false }));
    }
    return this.improved?.listLayers() ?? [];
  }

  setImprovedLayerMuted(id: string, muted: boolean) {
    this.hybrid?.setLayerMuted(id, muted);
    this.improved?.setLayerMuted(id, muted);
  }

  setImprovedLayerSolo(id: string | null) {
    this.hybrid?.setSolo(id);
    this.improved?.setSolo(id);
  }

  setIsolationRoleMuted(role: AudioLayerRole, muted: boolean) {
    this.hybrid?.setRoleMuted(role, muted);
    this.improved?.setRoleMuted(role, muted);
  }

  triggerImprovedLayer(id: string) {
    this.improved?.triggerLayer(id);
  }

  get running() {
    return this.ctx !== null;
  }

  /** Per-profile balance so profiles sit at the same perceived level. */
  setProfileGain(gain: number) {
    this.profileGain = Math.min(1.6, Math.max(0.2, gain));
    this.applyUserStageGain(0.25, PROFILE_SWITCH_VOLUME_SCALE);
  }

  /** Optional output boost 0..+6 dB (peak protect absorbs excess; does not raise car hardware volume). */
  setOutputBoostDb(db: number) {
    this.outputBoostDb = Math.min(6, Math.max(0, Number.isFinite(db) ? db : 0));
    const t = this.now();
    if (this.boostGain) {
      const linear = 10 ** (this.outputBoostDb / 20);
      if (linear <= 0) this.boostGain.gain.setValueAtTime(0, t);
      else this.boostGain.gain.setTargetAtTime(linear, t, 0.08);
    }
    this.applyUserStageGain(0.12);
  }

  getOutputBoostDb() {
    return this.outputBoostDb;
  }

  /**
   * Advanced identity-preserving character (0..1, 0.5 = authored).
   * Body: lowshelf offset. Mechanical: hybrid mechanical bus + MasterBus presence.
   */
  setCharacterFeel(body: number, mechanical: number) {
    this.bodyCharacter = Math.min(1, Math.max(0, Number.isFinite(body) ? body : CHARACTER_NEUTRAL));
    this.mechanicalCharacter = Math.min(
      1,
      Math.max(0, Number.isFinite(mechanical) ? mechanical : CHARACTER_NEUTRAL),
    );
    this.hybrid?.setCharacterFeel(this.bodyCharacter, this.mechanicalCharacter);
    this.applyCharacterToGraph();
  }

  private applyCharacterToGraph() {
    const t = this.now();
    const bodyOffset = (this.bodyCharacter - CHARACTER_NEUTRAL) * 2 * BODY_CHARACTER_SHELF_DB;
    const lowTarget = this.cabinEq.low + bodyOffset;
    this.cabinLow?.gain.setTargetAtTime(lowTarget, t, 0.12);
    const presence = this.mechanicalCharacter;
    this.profileBus?.setPresence(presence, t);
  }

  /** Linear gain into peak-protect (may be 0 for silence). */
  private computeMasterLinear(): number {
    const trim = this.profile ? loudnessForProfile(this.profile.id) : 1;
    const ceiling = this.profile
      ? Math.min(this.intensityCeiling, intensityCeilingForProfile(this.profile))
      : this.intensityCeiling;
    return computeUserStageLinearGain({
      uiVolume: this.volume,
      profileGain: this.profileGain,
      loudnessTrim: trim,
      outputBoostDb: 0, // boost is a separate GainNode after master
      loadScale: this.lastLoadScale,
      intensityCeiling: ceiling,
    });
  }

  private applyUserStageGain(timeConstant = 0.12, scale = 1) {
    if (!this.ctx || !this.master) return;
    const linear = this.computeMasterLinear() * scale;
    this.lastMasterTarget = linear;
    const t = this.now();
    this.applyCatalogMakeup(t);
    if (linear <= 0) {
      this.master.gain.setValueAtTime(0, t);
      return;
    }
    this.master.gain.setTargetAtTime(linear, t, Math.max(0.04, timeConstant));
  }

  private appliedMakeupDb: number | null = null;

  private applyCatalogMakeup(t: number) {
    if (!this.makeupGain || !this.makeupLimiter) return;
    const db = this.profile ? makeupDbForProfile(this.profile.id) : 0;
    if (db === this.appliedMakeupDb) return;
    const first = this.appliedMakeupDb === null;
    this.appliedMakeupDb = db;
    const stage = makeupStageSettings(db);
    const linear = 10 ** (stage.gainDb / 20);
    if (first) this.makeupGain.gain.setValueAtTime(linear, t);
    else this.makeupGain.gain.setTargetAtTime(linear, t, 0.15);
    this.makeupLimiter.threshold.setValueAtTime(stage.thresholdDb, t);
    this.makeupLimiter.ratio.setValueAtTime(stage.ratio, t);
  }

  private now() {
    if (this.renderTime !== null) return this.renderTime;
    return this.ctx?.currentTime ?? 0;
  }

  setIntensityCeiling(value: number) {
    this.intensityCeiling = Math.min(SoundEngine.MAX_GAIN, Math.max(0.2, value));
    this.applyUserStageGain(0.12);
  }

  setCabinEq(eq: CabinEq) {
    this.cabinEq = eq;
    this.cabinLowNeutralDb = eq.low;
    const t = this.now();
    this.cabinMid?.gain.setTargetAtTime(eq.mid, t, 0.08);
    this.cabinHigh?.gain.setTargetAtTime(eq.high, t, 0.08);
    this.applyCharacterToGraph();
  }

  setDuck(amount: number) {
    this.duckAmount = Math.max(0.05, Math.min(1, amount));
    if (this.ctx && this.duck) {
      this.duck.gain.setTargetAtTime(this.duckAmount, this.now(), 0.08);
    }
  }

  setRenderTime(time: number | null) {
    this.renderTime = time;
  }

  onInterrupt(handler: () => void) {
    this.interruptHandler = handler;
    this.live()?.addEventListener("statechange", this.onStateChange);
  }

  private live(): AudioContext | null {
    const ctx = this.ctx;
    return ctx && ctx instanceof AudioContext ? ctx : null;
  }

  private onStateChange = () => {
    if (this.live()?.state === "interrupted") this.interruptHandler?.();
  };

  /** Fade master to silence (~80 ms) then suspend, so idle never clicks. */
  async fadeAndSuspend() {
    const ctx = this.live();
    if (!ctx || !this.master) return;
    const t = this.now();
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), t);
    this.master.gain.linearRampToValueAtTime(0.0001, t + 0.08);
    await new Promise((r) => setTimeout(r, 90));
    if (ctx.state === "running") await ctx.suspend();
  }

  /** Resume after idle with the same soft ramp as startup. */
  async resumeFromIdle() {
    const ctx = this.live();
    if (!ctx || !this.master) return;
    // Treat resume as a timeline gap so overdue shift events never burst-fire.
    this.notifyAudioTimelineGap(DEFAULT_TIMELINE_GAP_FLUSH_MS * 3);
    if (ctx.state !== "running") await ctx.resume();
    const t = ctx.currentTime;
    this.lastLoadScale = 1;
    const target = this.computeMasterLinear() * STARTUP_VOLUME_SCALE;
    this.lastMasterTarget = target;
    this.master.gain.setValueAtTime(0, t);
    if (target <= 0) this.master.gain.setValueAtTime(0, t);
    else this.master.gain.setTargetAtTime(target, t, 0.25);
  }

  async start(
    profile: SoundProfile,
    options?: {
      signature?: boolean | undefined;
      environmentId?: string | undefined;
      mix?: LayerMix | undefined;
      snippets?: SoundSnippet[] | undefined;
      context?: AudioContext | OfflineAudioContext | undefined;
      seed?: number | undefined;
    },
  ) {
    if (typeof options?.seed === "number") {
      this.experienceSeed = options.seed >>> 0;
      seedAudioRandom(this.experienceSeed);
    } else {
      this.experienceSeed = Date.now() & 0xffff;
    }
    if (this.ctx) {
      this.setProfile(profile);
      return;
    }
    const ctx = options?.context ?? new AudioContext();
    if (ctx instanceof AudioContext && ctx.state !== "running") {
      await ctx.resume();
    }
    this.ctx = ctx;
    // Prefetch combustion worklet for Realism V2 (safe no-op if unavailable).
    await ensureCombustionWorklet(ctx);

    this.environment = getEnvironment(options?.environmentId ?? profile.environmentId);
    this.mix = normalizeMix(options?.mix ?? profile.mix);

    // Prompt 08 gain path:
    // layers → cabin EQ → MasterBus (sat/EQ/gentle program) → user volume
    // → optional boost → peak protect (−1 dBFS sample) → duck → destination.
    // DynamicsCompressorNode is not used as a brickwall limiter.
    const duck = ctx.createGain();
    duck.gain.value = 1;
    duck.connect(ctx.destination);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.6;
    duck.connect(analyser);

    const preAnalyser = ctx.createAnalyser();
    preAnalyser.fftSize = 1024;
    preAnalyser.smoothingTimeConstant = 0.6;

    const peakProtect = createPeakProtectStage(ctx, duck);
    preAnalyser.connect(peakProtect.input);

    const boostGain = ctx.createGain();
    boostGain.gain.value = 10 ** (this.outputBoostDb / 20);
    boostGain.connect(preAnalyser);

    // Catalog makeup: PROFILE_LOUDNESS trims are capped by the user-stage ceiling,
    // so quiet non-engine sounds could never reach -16 LUFS. Makeup is applied
    // after the ceiling, with a fast peak limiter that is only engaged (ratio > 1)
    // when the profile receives more than MAKEUP_LIMITER_ENGAGE_DB of makeup. Engines have 0 dB.
    const makeupLimiter = ctx.createDynamicsCompressor();
    makeupLimiter.threshold.value = 0;
    makeupLimiter.knee.value = 0;
    makeupLimiter.ratio.value = 1;
    makeupLimiter.attack.value = 0.001;
    makeupLimiter.release.value = 0.12;
    makeupLimiter.connect(boostGain);
    const makeupGain = ctx.createGain();
    makeupGain.gain.value = 1;
    makeupGain.connect(makeupLimiter);
    this.makeupGain = makeupGain;
    this.makeupLimiter = makeupLimiter;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(makeupGain);

    const cabinIn = ctx.createGain();
    const cabinLow = ctx.createBiquadFilter();
    cabinLow.type = "lowshelf";
    cabinLow.frequency.value = 120;
    cabinLow.gain.value = this.cabinEq.low;
    const cabinMid = ctx.createBiquadFilter();
    cabinMid.type = "peaking";
    // Center mid for cabin/phone presence rather than nasal 1 kHz only.
    cabinMid.frequency.value = 900;
    cabinMid.Q.value = 0.85;
    cabinMid.gain.value = this.cabinEq.mid;
    const cabinHigh = ctx.createBiquadFilter();
    cabinHigh.type = "highshelf";
    cabinHigh.frequency.value = 3500;
    cabinHigh.gain.value = this.cabinEq.high;
    cabinIn.connect(cabinLow);
    cabinLow.connect(cabinMid);
    cabinMid.connect(cabinHigh);
    // Soft saturation → EQ → gentle program compressor after cabin shelves, before user volume.
    const profileBus = createMasterBus(ctx, master);
    cabinHigh.connect(profileBus.input);
    this.profileBus = profileBus;
    this.peakProtect = peakProtect;
    this.boostGain = boostGain;

    // Shared space: one convolver fed by per-layer sends.
    const reverb = ctx.createConvolver();
    reverb.buffer = this.buildImpulse(ctx, this.environment);
    const reverbDamp = ctx.createBiquadFilter();
    reverbDamp.type = "lowpass";
    reverbDamp.frequency.value = 12000 - this.environment.damping * 9000;
    const wet = ctx.createGain();
    wet.gain.value = this.environment.wet;
    reverb.connect(reverbDamp);
    reverbDamp.connect(wet);
    wet.connect(master);

    const makeLayer = (key: LayerKey, phase: number): LayerChain => {
      const input = ctx.createGain();
      input.gain.value = 1;
      const tone = ctx.createBiquadFilter();
      tone.type = "highshelf";
      tone.frequency.value = 900;
      tone.gain.value = 0;
      const panner = ctx.createStereoPanner();
      const out = ctx.createGain();
      out.gain.value = this.mix[key].volume;
      const send = ctx.createGain();
      send.gain.value = this.mix[key].wet;
      input.connect(tone);
      tone.connect(panner);
      panner.connect(out);
      out.connect(cabinIn);
      out.connect(send);
      send.connect(reverb);
      return { input, tone, panner, out, send, phase };
    };

    const bodyLayer = makeLayer("body", 0);
    const accentsLayer = makeLayer("accents", 2.1);
    const bedsLayer = makeLayer("beds", 4.2);
    this.layers = { body: bodyLayer, accents: accentsLayer, beds: bedsLayer };

    const body = bodyLayer.input;
    const accents = accentsLayer.input;
    const beds = bedsLayer.input;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 300;
    filter.Q.value = 1.2;
    filter.connect(body);

    this.limiter = null;
    this.analyser = analyser;
    this.meterBuffer = new Float32Array(analyser.fftSize);
    this.preAnalyser = preAnalyser;
    this.preMeterBuffer = new Float32Array(preAnalyser.fftSize);
    this.master = master;
    this.duck = duck;
    this.cabinIn = cabinIn;
    this.cabinLow = cabinLow;
    this.cabinMid = cabinMid;
    this.cabinHigh = cabinHigh;
    this.reverb = reverb;
    this.reverbDamp = reverbDamp;
    this.wet = wet;
    this.body = body;
    this.accents = accents;
    this.beds = beds;
    this.filter = filter;

    this.applyMix();
    if (options?.snippets) void this.setSnippets(options.snippets);

    // Startup: a soft ELCAMOSO signature, then the profile breathes in to idle.
    const withSignature = options?.signature !== false;
    const signatureEnd = withSignature ? this.playSignature() : ctx.currentTime + 0.4;
    this.setProfile(profile);
    this.applyCharacterToGraph();
    master.gain.setValueAtTime(0, ctx.currentTime);
    const startupTarget = this.computeMasterLinear() * STARTUP_VOLUME_SCALE;
    this.lastMasterTarget = startupTarget;
    if (startupTarget <= 0) master.gain.setValueAtTime(0, signatureEnd - 0.35);
    else master.gain.setTargetAtTime(startupTarget, signatureEnd - 0.35, 0.55);
    this.fireSnippets("start", ctx.currentTime + 0.25);
  }

  /* ------------------------------------------------------- space and mixer */

  /**
   * Synthesised impulse response: an exponentially decaying noise tail whose
   * length and colour follow the environment, so each preset sits in a
   * believable space without shipping audio files.
   */
  private buildImpulse(ctx: BaseAudioContext, env: EnvironmentPreset) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * env.size));
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    const decay = 2.2 + env.damping * 3.5;
    for (let c = 0; c < 2; c += 1) {
      const data = buffer.getChannelData(c);
      let last = 0;
      for (let i = 0; i < length; i += 1) {
        const t = i / length;
        // low-passed noise gives a warmer, less metallic tail
        const white = audioRandom() * 2 - 1;
        last = last + (white - last) * (1 - env.damping * 0.85);
        const spread = 1 + (c === 0 ? -env.spread : env.spread) * 0.08;
        data[i] = last * Math.pow(1 - t, decay) * spread;
      }
    }
    return buffer;
  }

  /** Swaps the driving environment: space, damping and layer balance. */
  setEnvironment(id: string) {
    const env = getEnvironment(id);
    this.environment = env;
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.reverb) this.reverb.buffer = this.buildImpulse(ctx, env);
    this.reverbDamp?.frequency.setTargetAtTime(12000 - env.damping * 9000, ctx.currentTime, 0.3);
    this.wet?.gain.setTargetAtTime(env.wet, ctx.currentTime, 0.4);
    this.applyMix();
  }

  /** Per-layer volume, tone tilt and reverb send from the Studio mixer. */
  setMix(mix: LayerMix) {
    this.mix = normalizeMix(mix);
    this.applyMix();
  }

  private applyMix() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    (Object.keys(this.layers) as LayerKey[]).forEach((key) => {
      const chain = this.layers[key];
      if (!chain) return;
      const setting = this.mix[key];
      const balance = this.environment.balance[key];
      const texture = key === "beds" ? (this.environment.textureScale ?? 1) : 1;
      chain.out.gain.setTargetAtTime(Math.max(0.0001, setting.volume * balance * texture), t, 0.25);
      chain.tone.gain.setTargetAtTime((setting.tone - 1) * 12, t, 0.25);
      chain.send.gain.setTargetAtTime(setting.wet, t, 0.3);
    });
  }

  /**
   * Moves the layers gently across the stereo field and rebalances them from
   * the drive state, which is what makes each bed feel like it belongs to the
   * space rather than sitting flat in the middle.
   */
  private updateSpace(state: DriveState, t: number) {
    const env = this.environment;
    const motion = Math.min(1, (state.speed * 3.6) / 90);
    const lift: Record<LayerKey, number> = {
      body: 1 + state.throttle * env.motion.bodyByThrottle,
      beds: (1 + motion * env.motion.bedsBySpeed) * (env.textureScale ?? 1),
      accents: 1 + state.throttle * env.motion.accentsByThrottle,
    };
    (Object.keys(this.layers) as LayerKey[]).forEach((key) => {
      const chain = this.layers[key];
      if (!chain) return;
      const setting = this.mix[key];
      chain.out.gain.setTargetAtTime(
        Math.max(0.0001, setting.volume * env.balance[key] * lift[key]),
        t,
        0.3,
      );
      const drift = Math.sin(t * 0.13 + chain.phase) * env.spread;
      chain.panner.pan.setTargetAtTime(
        Math.max(-1, Math.min(1, key === "body" ? drift * 0.2 : drift * 0.6)),
        t,
        0.4,
      );
    });

    if (this.wet) {
      const wetTarget = Math.max(
        0,
        Math.min(1, env.wet + motion * env.motion.wetBySpeed + state.regen * env.motion.wetByRegen),
      );
      this.wet.gain.setTargetAtTime(wetTarget, t, 0.35);
    }
  }

  /* -------------------------------------------------------------- snippets */

  /** Decodes user recordings/uploads and maps them to their driving states. */
  async setSnippets(list: SoundSnippet[]) {
    const ctx = this.ctx;
    const token = (this.snippetToken += 1);
    this.stopSnippetBeds();
    if (!ctx) {
      this.snippets = [];
      return;
    }
    const voices: SnippetVoice[] = [];
    for (const snippet of list) {
      try {
        const res = await fetch(snippet.dataUrl);
        const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
        voices.push({ snippet, buffer, next: 0 });
      } catch {
        /* unreadable snippet: skip it rather than break the drive */
      }
    }
    if (token !== this.snippetToken || !this.ctx) return;
    this.snippets = voices;
    voices
      .filter((v) => v.snippet.trigger === "bed")
      .forEach((voice) => this.startSnippetBed(voice));
  }

  private startSnippetBed(voice: SnippetVoice) {
    const ctx = this.ctx;
    const target = this.layers.beds?.input ?? this.beds;
    if (!ctx || !target) return;
    const src = ctx.createBufferSource();
    src.buffer = voice.buffer;
    src.loop = true;
    src.playbackRate.value = voice.snippet.rate;
    const gain = ctx.createGain();
    gain.gain.value = Math.min(1, voice.snippet.level) * 0.4;
    src.connect(gain);
    gain.connect(target);
    src.start();
    voice.loopSrc = src;
  }

  private stopSnippetBeds() {
    this.snippets.forEach((voice) => {
      try {
        voice.loopSrc?.stop();
      } catch {
        /* already stopped */
      }
      delete voice.loopSrc;
    });
  }

  private fireSnippets(trigger: SoundSnippet["trigger"], at: number) {
    const ctx = this.ctx;
    const target = this.layers.accents?.input ?? this.accents;
    if (!ctx || !target) return;
    this.snippets
      .filter((v) => v.snippet.trigger === trigger && at >= v.next)
      .forEach((voice) => this.playSnippetVoice(voice, at, target, trigger));
  }

  /** Fire a specific Garage snippet from a profile IF/THEN rule. */
  fireSnippetById(snippetId: string) {
    const ctx = this.ctx;
    const target = this.layers.accents?.input ?? this.accents;
    if (!ctx || !target) return;
    const voice = this.snippets.find((v) => v.snippet.id === snippetId);
    if (!voice) return;
    const at = this.now();
    if (at < voice.next) return;
    this.playSnippetVoice(voice, at, target, voice.snippet.trigger);
  }

  private playSnippetVoice(
    voice: SnippetVoice,
    at: number,
    target: AudioNode,
    trigger: SoundSnippet["trigger"],
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    const cooldown =
      trigger === "cruise" ? (voice.snippet.everySeconds ?? 25) : voice.buffer.duration + 2.5;
    voice.next = at + cooldown;
    const src = ctx.createBufferSource();
    src.buffer = voice.buffer;
    src.playbackRate.value = voice.snippet.rate;
    const gain = ctx.createGain();
    gain.gain.value = Math.min(1.5, voice.snippet.level) * 0.6;
    src.connect(gain);
    gain.connect(target);
    src.start(at);
  }

  /** One-shot audition of a snippet outside a drive (used by the Studio list). */
  static async previewSnippet(dataUrl: string, rate = 1, level = 1) {
    const ctx = new AudioContext();
    try {
      const res = await fetch(dataUrl);
      const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      const gain = ctx.createGain();
      gain.gain.value = Math.min(1, level) * 0.8;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      await new Promise((r) => setTimeout(r, (buffer.duration / rate) * 1000 + 200));
    } finally {
      await ctx.close();
    }
  }

  /**
   * Short, original ELCAMOSO sonic signature: two soft rising sines that open
   * outward like the O ))) mark. Deliberately not a starter-motor imitation.
   * Returns the time the signature finishes.
   */
  private playSignature() {
    const ctx = this.ctx;
    if (!ctx) return 0;
    const now = ctx.currentTime + 0.05;
    const bus = ctx.createGain();
    bus.gain.value = 0.5;
    bus.connect(this.peakProtect?.input ?? this.duck ?? ctx.destination);
    [392, 587.33].forEach((freq, i) => {
      const at = now + i * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * 0.75, at);
      osc.frequency.exponentialRampToValueAtTime(freq, at + 0.5);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.11, at + 0.16);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.0);
      osc.connect(gain);
      gain.connect(bus);
      osc.start(at);
      osc.stop(at + 1.1);
    });
    return now + 1.3;
  }

  /* --------------------------------------------------------------- buffers */

  private getNoise(ctx: BaseAudioContext, colour: "white" | "pink" = "white") {
    if (colour === "white") {
      if (!this.whiteBuffer) {
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = audioRandom() * 2 - 1;
        this.whiteBuffer = buffer;
      }
      return this.whiteBuffer;
    }
    if (!this.pinkBuffer) {
      // Voss-McCartney style pink noise: much closer to water, wind and gravel.
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0;
      for (let i = 0; i < data.length; i += 1) {
        const w = audioRandom() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
      this.pinkBuffer = buffer;
    }
    return this.pinkBuffer;
  }

  /* -------------------------------------------------------- profile switch */

  /**
   * Switching profiles never jumps in loudness: fade the current body out,
   * build the new voices silently, then fade in (sequential - avoids correlated
   * dual-source gain spikes). Total crossfade stays in the 300–600 ms band.
   * Latest selection wins; failed builds leave the previous sound usable.
   */
  setProfile(profile: SoundProfile, force = false) {
    const ctx = this.ctx;
    const body = this.body;
    if (!ctx || !this.filter) {
      this.profile = profile;
      return;
    }
    if (!force && this.profile?.id === profile.id && this.voices.length) return;
    const generation = ++this.swapGeneration;
    if (force || !this.voices.length || !body) {
      if (this.swapTimer) clearTimeout(this.swapTimer);
      this.swapTimer = null;
      this.swapping = false;
      this.applyProfileBuild(profile, null);
      return;
    }
    if (this.swapTimer) clearTimeout(this.swapTimer);
    this.swapping = true;
    const previous = this.profile;
    // Sequential linear fades (~220 ms out + ~320 ms in ≈ 540 ms). No dual-voice overlap.
    const fadeOut = 0.22;
    const fadeIn = 0.32;
    try {
      body.gain.cancelScheduledValues(ctx.currentTime);
      body.gain.setValueAtTime(body.gain.value, ctx.currentTime);
      body.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fadeOut);
    } catch {
      /* closed / interrupted context */
    }
    this.swapTimer = setTimeout(
      () => {
        this.swapTimer = null;
        if (generation !== this.swapGeneration) {
          this.swapping = false;
          return;
        }
        const c = this.ctx;
        if (!c || !this.body) {
          this.swapping = false;
          return;
        }
        const ok = this.applyProfileBuild(profile, previous);
        if (!ok) {
          this.swapping = false;
          try {
            this.body.gain.cancelScheduledValues(c.currentTime);
            this.body.gain.setValueAtTime(0.0001, c.currentTime);
            this.body.gain.linearRampToValueAtTime(1, c.currentTime + fadeIn);
          } catch {
            /* closed / interrupted context */
          }
          return;
        }
        if (generation !== this.swapGeneration) {
          this.swapping = false;
          return;
        }
        try {
          this.body.gain.setValueAtTime(0.0001, c.currentTime);
          this.body.gain.linearRampToValueAtTime(1, c.currentTime + fadeIn);
        } catch {
          /* closed / interrupted context */
        }
        this.swapping = false;
      },
      fadeOut * 1000 + 30,
    );
  }

  /** @returns false when build failed and the previous profile was restored. */
  private applyProfileBuild(profile: SoundProfile, previous: SoundProfile | null): boolean {
    try {
      this.buildProfile(profile);
      return true;
    } catch (error) {
      reportAudioError(error);
      this.teardownVoices();
      this.improved = null;
      this.hybrid = null;
      if (previous && previous.id !== profile.id) {
        try {
          this.buildProfile(previous);
          return false;
        } catch (restoreError) {
          reportAudioError(restoreError);
        }
      }
      this.profile = profile;
      return false;
    }
  }

  private buildProfile(profile: SoundProfile) {
    const ctx = this.ctx;
    const filter = this.filter;
    if (!ctx || !filter) {
      this.profile = profile;
      return;
    }
    this.teardownVoices();
    this.hybridLoadController?.abort();
    this.hybridLoadController = null;
    this.profile = profile;

    const busesOk = Boolean(this.body && this.accents && this.beds);
    const strategyBuses = busesOk
      ? {
          body: this.body!,
          accents: this.accents!,
          beds: this.beds!,
          profile: this.profileBus?.input ?? this.body!,
        }
      : null;

    // Fusion - Engine + Symphony through FusionMixer.
    if (isFusionProfileId(profile.id) && strategyBuses) {
      this.fusion = new FusionSynth();
      const ok = this.fusion.build(ctx, profile, strategyBuses, this.experienceSeed);
      if (ok) return;
      this.fusion.dispose();
      this.fusion = null;
    }

    // Drive Symphony - musical arrangement from DriveState (fixed BPM, quantized stems).
    if (isSymphonyProfileId(profile.id) && strategyBuses) {
      this.symphony = new SymphonySynth();
      const ok = this.symphony.build(ctx, profile, strategyBuses, this.experienceSeed);
      if (ok) return;
      this.symphony.dispose();
      this.symphony = null;
    }

    // Worlds - reactive sonic fiction from Drive Energy.
    if (isWorldProfileId(profile.id) && strategyBuses) {
      this.world = new WorldSynth();
      const ok = this.world.build(ctx, profile, strategyBuses, this.experienceSeed);
      if (ok) return;
      this.world.dispose();
      this.world = null;
    }

    // Prompt 04: raw mechanical combustion (opt-in flag + realismEngine "v3" + pilot IDs).
    // Current / V2 paths below stay unchanged when the flag is off or mode is not v3.
    if (
      isDriveAudioV3Enabled() &&
      this.realismEngine === "v3" &&
      this.synthesisMode === "improved" &&
      isRawMechanicalPilotId(profile.id) &&
      isCombustionRealismV2Profile(profile.id) &&
      strategyBuses
    ) {
      this.hybrid = new HybridCombustionSynth();
      const quality = resolveRawMechanicalQualityTier(ctx);
      const ok = this.hybrid.build(ctx, profile, strategyBuses, {
        rawMechanical: rawMechanicalPresetFor(profile.id, quality),
      });
      if (ok) {
        this.hybrid.setAdvancedTransientsEnabled(this.advancedTransientsEnabled);
        this.hybrid.setShiftIntensity(this.shiftIntensity);
        this.hybrid.setCharacterFeel(this.bodyCharacter, this.mechanicalCharacter);
        {
          const controller = new AbortController();
          this.hybridLoadController = controller;
          void this.prepareHybridSampleLayer(this.hybrid, ctx, profile, controller);
        }
        return;
      }
      this.hybrid.dispose();
      this.hybrid = null;
      // Fall through to V2 if raw build fails.
    }

    // Realism V2 hybrid combustion - A/B vs current Improved / Dynamic Drive path.
    // Also the safe fallback when V3 is requested but the flag is off / pilot missing.
    if (
      (this.realismEngine === "v2" || this.realismEngine === "v3") &&
      this.synthesisMode === "improved" &&
      isCombustionRealismV2Profile(profile.id) &&
      strategyBuses
    ) {
      this.hybrid = new HybridCombustionSynth();
      const ok = this.hybrid.build(ctx, profile, strategyBuses);
      if (ok) {
        this.hybrid.setAdvancedTransientsEnabled(this.advancedTransientsEnabled);
        this.hybrid.setShiftIntensity(this.shiftIntensity);
        this.hybrid.setCharacterFeel(this.bodyCharacter, this.mechanicalCharacter);
        {
          const controller = new AbortController();
          this.hybridLoadController = controller;
          void this.prepareHybridSampleLayer(this.hybrid, ctx, profile, controller);
        }
        return;
      }
      this.hybrid.dispose();
      this.hybrid = null;
    }

    const useDynamicDrive =
      this.dynamicDriveEnabled &&
      this.synthesisMode === "improved" &&
      this.realismEngine === "current" &&
      supportsDynamicDrive(profile);

    if (useDynamicDrive && strategyBuses) {
      this.dynamicDrive = new DynamicDriveSynth();
      const ok = this.dynamicDrive.build(ctx, profile, strategyBuses);
      if (ok) return;
      this.dynamicDrive?.dispose();
      this.dynamicDrive = null;
    }

    if (this.synthesisMode === "improved" && strategyBuses) {
      this.improved = new ImprovedSynth();
      this.improved.setExperienceEnabled(this.experienceTuningEnabled);
      const ok = this.improved.build(ctx, profile, strategyBuses);
      if (ok) return;
      // Fall through to original if no strategy registered.
      this.improved?.dispose();
      this.improved = null;
    }

    profile.voice.harmonics.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const core = profile.voice.coreLevel ?? 1;
      osc.type = i === 0 ? profile.voice.wave : i < 2 ? profile.voice.wave : "sawtooth";
      osc.detune.value = (i % 2 === 0 ? 1 : -1) * profile.voice.detune * (i + 1);
      osc.frequency.value = profile.voice.baseFrequency * ratio;
      gain.gain.value = (0.34 / (i + 1.4)) * core;
      osc.connect(gain);
      gain.connect(filter);
      osc.start();
      this.voices.push({ osc, gain, ratio });
    });

    if (profile.voice.noise > 0) {
      const src = ctx.createBufferSource();
      src.buffer = this.getNoise(ctx, profile.voice.noiseColor ?? "white");
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain);
      gain.connect(filter);
      src.start();
      this.noise = { src, gain };
    }

    const { lfoRate, lfoDepth, lfoTarget } = profile.voice;
    if (lfoRate && lfoDepth && lfoTarget) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = lfoRate;
      gain.gain.value = lfoDepth;
      osc.connect(gain);
      if (lfoTarget === "pitch") {
        this.voices.forEach(({ osc: v }) => gain.connect(v.detune));
      } else if (lfoTarget === "filter") {
        gain.connect(filter.frequency);
      } else if (this.body) {
        gain.gain.value = Math.min(0.5, lfoDepth / 100);
        gain.connect(this.body.gain);
      }
      osc.start();
      this.lfo = { osc, gain };
    }

    (profile.voice.textures ?? []).forEach((spec) => this.buildTexture(spec));

    const now = ctx.currentTime;
    this.rhythms = [profile.voice.rhythm, profile.voice.rhythmB]
      .filter((r): r is RhythmSpec => Boolean(r))
      .map((spec) => ({ spec, next: now + 0.2, step: 0 }));
    this.signals = (profile.voice.signals ?? []).map((spec) => ({
      spec,
      // stagger the first event so nothing fires the instant a drive starts
      next: now + 4 + audioRandom() * spec.everySeconds,
    }));
  }

  /** Continuous atmospheric bed: water wash, wind, gravel, steam, crowd, rumble. */
  private buildTexture(spec: TextureSpec) {
    const ctx = this.ctx;
    const beds = this.beds;
    if (!ctx || !beds) return;

    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx, spec.kind === "sizzle" ? "white" : "pink");
    src.loop = true;
    src.playbackRate.value = spec.kind === "gravel" ? 1.35 : 1;

    const filter = ctx.createBiquadFilter();
    if (spec.kind === "rumble") {
      filter.type = "lowpass";
      filter.Q.value = 0.8;
    } else if (spec.kind === "water" || spec.kind === "crowd") {
      filter.type = "bandpass";
      filter.Q.value = spec.kind === "water" ? 0.6 : 1.1;
    } else if (spec.kind === "sizzle" || spec.kind === "steam") {
      filter.type = "highpass";
      filter.Q.value = 0.7;
    } else {
      filter.type = "bandpass";
      filter.Q.value = 0.9;
    }
    filter.frequency.value = spec.tone;

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;

    // Each bed gets its own placement, so water, gravel and wind occupy
    // different points in the field instead of stacking in the centre.
    const panner = ctx.createStereoPanner();
    const phase = this.textures.length * 1.7;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(beds);
    src.start();

    const node: TextureNode = { spec, gain, filter, src, panner, phase };

    // Slow surge so water and wind breathe instead of sitting flat.
    if (spec.surge) {
      const osc = ctx.createOscillator();
      const depth = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = spec.surge;
      depth.gain.value = spec.level * 0.45;
      osc.connect(depth);
      depth.connect(gain.gain);
      osc.start();
      node.lfo = { osc, gain: depth };
    }

    this.textures.push(node);
  }

  /** UI master volume 0..1. Zero is silence. Perceptual curve applied internally. */
  setVolume(value: number) {
    this.volume = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
    this.applyUserStageGain(0.2);
  }

  getVolume() {
    return this.volume;
  }

  /* ---------------------------------------------------------------- meter */

  /**
   * Live loudness reading. `headroom` is how much room is left before the
   * output ceiling (1 = silent, 0 = at the ceiling) and `reduction` shows how
   * hard the safety limiter is working.
   */
  getMeter(): MeterReading | null {
    const analyser = this.analyser;
    const buf = this.meterBuffer;
    const preAnalyser = this.preAnalyser;
    const preBuf = this.preMeterBuffer;
    if (!analyser || !buf || !preAnalyser || !preBuf) return null;
    try {
      analyser.getFloatTimeDomainData(buf);
      preAnalyser.getFloatTimeDomainData(preBuf);
    } catch {
      return null;
    }
    let peak = 0;
    let sum = 0;
    let overloadSampleCount = 0;
    for (let i = 0; i < buf.length; i += 1) {
      const v = buf[i] ?? 0;
      const a = Math.abs(v);
      if (a > peak) peak = a;
      if (a >= SAMPLE_PEAK_CEILING_LINEAR) overloadSampleCount += 1;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);
    let prePeak = 0;
    let preSum = 0;
    for (let i = 0; i < preBuf.length; i += 1) {
      const v = preBuf[i] ?? 0;
      prePeak = Math.max(prePeak, Math.abs(v));
      preSum += v * v;
    }
    const ceiling = SAMPLE_PEAK_CEILING_LINEAR;
    const samplePeakDbfs = linearToDb(peak);
    return {
      prePeak: Math.min(1, prePeak),
      preRms: Math.min(1, Math.sqrt(preSum / preBuf.length)),
      peak: Math.min(1, peak),
      rms: Math.min(1, rms),
      headroom: Math.max(0, 1 - Math.min(1, peak / ceiling)),
      reduction: this.profileBus?.getCompressorReductionDb() ?? 0,
      compressorReduction: this.profileBus?.getCompressorReductionDb() ?? 0,
      samplePeakDbfs,
      nearCeiling: samplePeakDbfs >= SAMPLE_PEAK_CEILING_DBFS - 0.5,
      overloadSampleCount,
    };
  }

  getPerf(): { baseLatencyMs: number; outputLatencyMs: number; currentTime: number } {
    const ctx = this.live();
    if (!ctx) return { baseLatencyMs: 0, outputLatencyMs: 0, currentTime: 0 };
    return {
      baseLatencyMs: (ctx.baseLatency ?? 0) * 1000,
      outputLatencyMs: (ctx.outputLatency ?? 0) * 1000,
      currentTime: ctx.currentTime,
    };
  }

  /**
   * Prompt 05 hybrid sample layer: fetch/decode only for the active personality.
   * Stays outside AudioWorklet.process. Empty catalog → procedural, no loudness jump.
   * Stale loads after profile change are ignored via AbortController + loader generation.
   */
  private async prepareHybridSampleLayer(
    synth: HybridCombustionSynth,
    ctx: BaseAudioContext,
    profile: SoundProfile,
    controller: AbortController,
  ) {
    const recorded = synth.getRecordedLoopBank();
    if (recorded) {
      const ready = loadRecordedLoopBuffers(ctx, recorded, controller.signal)
        .then((buffers) => {
          if (controller.signal.aborted || this.hybrid !== synth) return;
          synth.setRecordedLoopBuffers(buffers);
        })
        .catch((error) => {
          if (controller.signal.aborted || this.hybrid !== synth) return;
          reportAudioError(error);
        });
      this.samplesReady = ready;
      await ready;
      return;
    }
    const loader = getSharedSampleLoader();
    const generation = loader.invalidate();
    try {
      const personality = resolvePersonalityId(profile);
      const manifest = await fetchSoundAssetManifest({
        personality,
        signal: controller.signal,
      });
      if (controller.signal.aborted || this.hybrid !== synth) return;
      const result = await loader.loadManifestAssets(ctx, manifest, {
        signal: controller.signal,
        generation,
      });
      if (controller.signal.aborted || this.hybrid !== synth || result.stale) return;
      synth.setDecodedSamples(result.buffers);
    } catch (error) {
      if (controller.signal.aborted || this.hybrid !== synth) return;
      synth.setDecodedSamples(new Map());
      reportAudioError(error);
    }
  }

  private samplesReady: Promise<void> = Promise.resolve();

  /** Resolves once the active profile's recorded loops are decoded (or failed). */
  whenSamplesReady(): Promise<void> {
    return this.samplesReady;
  }

  /* ------------------------------------------------------------- per-frame */

  update(state: DriveState) {
    const ctx = this.ctx;
    const profile = this.profile;
    if (!ctx || !profile || !this.filter || this.swapping) return;
    const t = this.now();

    if (
      this.improved ||
      this.dynamicDrive ||
      this.hybrid ||
      this.symphony ||
      this.fusion ||
      this.world
    ) {
      if (this.fusion) this.fusion.update(state, t);
      if (this.symphony) this.symphony.update(state, t);
      if (this.world) this.world.update(state, t);
      if (this.hybrid) this.hybrid.update(state, t);
      if (this.improved) this.improved.update(state, t);
      if (this.dynamicDrive) this.dynamicDrive.update(state, t);
      this.updateSpace(state, t);
      if (state.throttle > 0.72 && this.lastThrottle <= 0.72) this.fireSnippets("throttle", t);
      if (state.regen > 0.5 && this.lastRegen <= 0.5) this.fireSnippets("regen", t);
      if (state.speed * 3.6 > 20 && state.throttle < 0.5) this.fireSnippets("cruise", t);
      this.lastThrottle = state.throttle;
      this.lastRegen = state.regen;
      if (this.master) {
        this.lastLoadScale = mildMasterLoadScale(state.load, state.regen);
        this.applyUserStageGain(0.12);
      }
      return;
    }

    const v = profile.voice;

    let fundamental: number;
    if (profile.drivetrainMode === "virtual-transmission") {
      fundamental = (state.rpm / 60) * (v.baseFrequency / 26);
    } else {
      fundamental = v.baseFrequency * (1 + state.load * 2.6 + state.throttle * 0.5);
    }
    fundamental = Math.max(18, Math.min(2800, fundamental));

    this.voices.forEach(({ osc, gain, ratio }, i) => {
      osc.frequency.setTargetAtTime(fundamental * ratio, t, 0.05);
      const brightness = 0.2 + state.load * 0.8;
      const core = v.coreLevel ?? 1;
      gain.gain.setTargetAtTime((0.3 / (i + 1.4)) * (i === 0 ? 1 : brightness) * core, t, 0.12);
    });

    const cutoff = v.filterBase + v.filterRange * Math.pow(state.load, 0.8);
    this.filter.frequency.setTargetAtTime(cutoff, t, 0.08);
    const q = v.filterQ ?? (profile.drivetrainMode === "continuous" ? 1.4 : 1.2);
    this.filter.Q.setTargetAtTime(q, t, 0.3);

    if (this.lfo && v.lfoRate) {
      this.lfo.osc.frequency.setTargetAtTime(v.lfoRate * (0.7 + state.load * 1.2), t, 0.2);
    }

    if (this.noise) {
      const texture = this.environment.textureScale ?? 1;
      const level = (v.noise * (0.18 + state.load * 0.55) + state.regen * v.noise * 0.35) * texture;
      this.noise.gain.gain.setTargetAtTime(level * 0.22, t, 0.15);
    }

    this.updateTextures(state, t);
    this.updateSpace(state, t);

    // Snippet triggers are edge-based so a held pedal cannot retrigger them.
    if (state.throttle > 0.72 && this.lastThrottle <= 0.72) this.fireSnippets("throttle", t);
    if (state.regen > 0.5 && this.lastRegen <= 0.5) this.fireSnippets("regen", t);
    if (state.speed * 3.6 > 20 && state.throttle < 0.5) this.fireSnippets("cruise", t);
    this.lastThrottle = state.throttle;
    this.lastRegen = state.regen;

    if (this.master) {
      this.lastLoadScale = mildMasterLoadScale(state.load, state.regen);
      this.applyUserStageGain(0.12);
    }

    this.rhythms.forEach((clock) => this.scheduleRhythm(clock, state));
    this.signals.forEach((clock) => this.scheduleSignal(clock, state));
  }

  private updateTextures(state: DriveState, t: number) {
    const kmh = state.speed * 3.6;
    const spread = this.environment.spread;
    const texture = this.environment.textureScale ?? 1;
    this.textures.forEach(({ spec, gain, filter, src, panner, phase }) => {
      const follow = spec.speedScale ?? 1;
      const motion = Math.min(1, kmh / 90);
      const amount = spec.level * (1 - follow + follow * (0.12 + motion * 0.95)) * texture;
      // regen adds hiss to water/wind: the sound of coasting
      const regenLift =
        texture > 0.01 && (spec.kind === "water" || spec.kind === "wind")
          ? state.regen * 0.2 * texture
          : 0;
      gain.gain.setTargetAtTime(Math.max(0.0001, amount + regenLift), t, 0.35);
      filter.frequency.setTargetAtTime(spec.tone * (0.8 + motion * 0.6), t, 0.4);
      // Beds drift wider and faster with speed: motion you can hear moving.
      const sway = Math.sin(t * (0.18 + motion * 0.5) + phase) * spread;
      panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, sway)), t, 0.5);
      if (spec.kind === "gravel" || spec.kind === "water") {
        src.playbackRate.setTargetAtTime(0.85 + motion * 0.7, t, 0.5);
      }
    });
  }

  /* -------------------------------------------------------------- rhythms */

  /** Rhythmic events (hooves, wheels, bells, chuffs, splashes) that follow speed. */
  private scheduleRhythm(clock: RhythmClock, state: DriveState) {
    const ctx = this.ctx;
    if (!ctx || !this.accents) return;
    const spec = clock.spec;
    const horizon = ctx.currentTime + 0.3;
    if (clock.next < ctx.currentTime) clock.next = ctx.currentTime + 0.02;
    const rate = Math.max(0.25, spec.baseRate + spec.rateScale * state.load);
    const interval = 1 / rate;
    const level = spec.level * (0.35 + state.load * 0.85);

    while (clock.next < horizon) {
      this.fireAccent(spec.kind, clock.next, spec.tone, level, clock.step, state);
      clock.step += 1;
      const swing =
        spec.kind === "putt"
          ? clock.step % 2
            ? 0.62
            : 1.38
          : spec.kind === "clack" || spec.kind === "chug"
            ? clock.step % 2
              ? 0.74
              : 1.26
            : 1;
      clock.next += interval * swing;
    }
  }

  private fireAccent(
    kind: string,
    at: number,
    tone: number,
    level: number,
    step: number,
    state: DriveState,
  ) {
    switch (kind) {
      case "bell":
        return this.fireBell(at, tone, level, step);
      case "blat":
        return this.fireBlat(at, tone, level);
      case "gallop":
        return this.fireGallop(at, tone, level, state);
      case "splash":
        return this.fireSplash(at, tone, level, state);
      case "creak":
        return this.fireCreak(at, tone, level, step);
      case "laugh":
        return this.fireLaugh(at, tone, level, state);
      case "rotor":
        return this.fireRotor(at, tone, level, step, state);
      case "putt":
        return this.firePutt(at, tone, level, step);
      default:
        return this.fireBurst(kind, at, tone, level, step);
    }
  }

  /**
   * One main-rotor blade pass: low boom, mid whoosh with a Doppler fall, and a
   * brief tip hiss. Alternating pan keeps the chop moving around you.
   */
  private fireRotor(at: number, tone: number, level: number, step: number, state: DriveState) {
    const ctx = this.ctx;
    const out = this.bus();
    if (!ctx || !out) return;

    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(step % 2 === 0 ? -0.45 : 0.45, at);
    pan.pan.linearRampToValueAtTime(step % 2 === 0 ? 0.2 : -0.2, at + 0.12);
    pan.connect(out);

    const boom = Math.max(28, tone * (step % 2 ? 1.05 : 0.95));
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(boom, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(18, boom * 0.55), at + 0.14);
    og.gain.setValueAtTime(0.0001, at);
    og.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 0.95), at + 0.01);
    og.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
    osc.connect(og);
    og.connect(pan);
    osc.start(at);
    osc.stop(at + 0.22);

    // Blade slap: noise whoosh that falls in pitch as the blade passes.
    const whoosh = ctx.createBufferSource();
    whoosh.buffer = this.getNoise(ctx, "pink");
    whoosh.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.1;
    const whooshHz = 420 + state.load * 780;
    bp.frequency.setValueAtTime(whooshHz, at);
    bp.frequency.exponentialRampToValueAtTime(whooshHz * 0.35, at + 0.14);
    const wg = ctx.createGain();
    const slap = level * (0.55 + state.load * 0.7);
    wg.gain.setValueAtTime(0.0001, at);
    wg.gain.exponentialRampToValueAtTime(Math.max(0.0002, slap), at + 0.012);
    wg.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    whoosh.connect(bp);
    bp.connect(wg);
    wg.connect(pan);
    whoosh.start(at);
    whoosh.stop(at + 0.2);

    // Tip vortex hiss
    const tip = ctx.createBufferSource();
    tip.buffer = this.getNoise(ctx, "white");
    tip.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(2800 + state.load * 2200, at);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.0001, at);
    tg.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 0.22), at + 0.008);
    tg.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
    tip.connect(hp);
    hp.connect(tg);
    tg.connect(pan);
    tip.start(at);
    tip.stop(at + 0.12);
  }

  /** A single-cylinder tractor stroke: putt ... putt ... with a lazy offbeat. */
  private firePutt(at: number, tone: number, level: number, step: number) {
    const ctx = this.ctx;
    const out = this.bus();
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(tone * (step % 2 ? 0.94 : 1.06), at);
    osc.frequency.exponentialRampToValueAtTime(tone * 0.55, at + 0.13);
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(tone * 7, at);
    lp.frequency.exponentialRampToValueAtTime(tone * 2.4, at + 0.14);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(out);
    osc.start(at);
    osc.stop(at + 0.24);

    // exhaust puff through the stack
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx, "pink");
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.1;
    bp.frequency.value = tone * 5;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, at);
    sg.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 0.45), at + 0.012);
    sg.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    src.connect(bp);
    bp.connect(sg);
    sg.connect(out);
    src.start(at);
    src.stop(at + 0.2);
  }

  private bus() {
    return this.accents;
  }

  private fireBell(at: number, tone: number, level: number, step: number) {
    const ctx = this.ctx;
    const out = this.bus();
    if (!ctx || !out) return;
    // A sleigh bell is a small cluster of inharmonic partials, not one tone.
    const cluster = [1, 1.51, 2.13, 2.79];
    cluster.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(tone * ratio * (step % 3 === 0 ? 1.06 : 1), at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level / (i + 1.6)), at + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.26 + i * 0.05);
      osc.connect(gain);
      gain.connect(out);
      osc.start(at);
      osc.stop(at + 0.45);
    });
  }

  private fireBlat(at: number, tone: number, level: number) {
    const ctx = this.ctx;
    const out = this.bus();
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(tone * 1.4, at);
    osc.frequency.exponentialRampToValueAtTime(tone * 0.55, at + 0.34);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.4);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(out);
    osc.start(at);
    osc.stop(at + 0.45);
  }

  /** One hoof: a wooden knock with a short body resonance and a dust tail. */
  private hoof(at: number, tone: number, level: number, hard: boolean) {
    const ctx = this.ctx;
    const out = this.bus();
    if (!ctx || !out) return;

    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx, "white");
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(tone * (hard ? 1.25 : 0.9), at);
    bp.frequency.exponentialRampToValueAtTime(tone * 0.55, at + 0.06);
    bp.Q.value = 5;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * (hard ? 1 : 0.7)), at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.075);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(out);
    src.start(at);
    src.stop(at + 0.14);

    // wooden thump body
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(tone * 0.45, at);
    osc.frequency.exponentialRampToValueAtTime(tone * 0.28, at + 0.07);
    og.gain.setValueAtTime(0.0001, at);
    og.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 0.55), at + 0.006);
    og.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
    osc.connect(og);
    og.connect(out);
    osc.start(at);
    osc.stop(at + 0.14);
  }

  /** Four-beat transverse gallop with gathered flight after the lead. */
  private fireGallop(at: number, tone: number, level: number, state: DriveState) {
    const stride = 0.58 - Math.min(0.2, state.load * 0.22);
    // Relative footfalls: RH, LH, RF, LF then silence until next stride.
    const pattern = [0, 0.16, 0.3, 0.46];
    pattern.forEach((offset, i) => {
      this.hoof(at + offset * stride * 2, tone * (i < 2 ? 0.9 : 1.08), level * 0.9, i === 3);
    });
  }

  /** Water displaced by a hull: a broadband wash with a low slap underneath. */
  private fireSplash(at: number, tone: number, level: number, state: DriveState) {
    const ctx = this.ctx;
    const out = this.bus();
    if (!ctx || !out) return;
    const dur = 0.32 + state.load * 0.2;

    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx, "pink");
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.5;
    bp.frequency.setValueAtTime(tone * 0.6, at);
    bp.frequency.exponentialRampToValueAtTime(tone * 2.4, at + dur * 0.7);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(out);
    src.start(at);
    src.stop(at + dur + 0.05);

    const thump = ctx.createOscillator();
    const tg = ctx.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(90, at);
    thump.frequency.exponentialRampToValueAtTime(48, at + 0.16);
    tg.gain.setValueAtTime(0.0001, at);
    tg.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 0.8), at + 0.01);
    tg.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    thump.connect(tg);
    tg.connect(out);
    thump.start(at);
    thump.stop(at + 0.26);
  }

  /** Timber under load: a slow, pitch-bending groan from a wooden cart. */
  private fireCreak(at: number, tone: number, level: number, step: number) {
    const ctx = this.ctx;
    const out = this.bus();
    if (!ctx || !out) return;
    const dur = 0.55;
    const osc = ctx.createOscillator();
    const bp = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const wobble = ctx.createOscillator();
    const wobbleDepth = ctx.createGain();

    osc.type = "sawtooth";
    const up = step % 2 === 0;
    osc.frequency.setValueAtTime(tone * (up ? 0.85 : 1.15), at);
    osc.frequency.linearRampToValueAtTime(tone * (up ? 1.2 : 0.8), at + dur);

    wobble.type = "sine";
    wobble.frequency.value = 7 + (step % 3);
    wobbleDepth.gain.value = 22;
    wobble.connect(wobbleDepth);
    wobbleDepth.connect(osc.detune);

    bp.type = "bandpass";
    bp.frequency.value = tone * 3.2;
    bp.Q.value = 6;

    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.14);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    osc.connect(bp);
    bp.connect(gain);
    gain.connect(out);
    osc.start(at);
    wobble.start(at);
    osc.stop(at + dur + 0.05);
    wobble.stop(at + dur + 0.05);
  }

  /**
   * A laugh: a run of vowel-shaped "ha" syllables on a falling pitch, built from
   * a buzzing source through two formant filters.
   */
  private fireLaugh(at: number, tone: number, level: number, state: DriveState) {
    const ctx = this.ctx;
    const out = this.bus();
    if (!ctx || !out) return;
    const joy = Math.min(
      1,
      state.throttle * 0.65 + Math.max(0, state.acceleration / 3.5) * 0.9 + state.load * 0.35,
    );
    const syllables = 3 + Math.round(joy * 5);
    const spacing = 0.16 - joy * 0.07;

    for (let i = 0; i < syllables; i += 1) {
      const t0 = at + i * spacing;
      const pitch = tone * (1.14 - i * 0.05) * (1 + joy * 0.5);
      const osc = ctx.createOscillator();
      const f1 = ctx.createBiquadFilter();
      const f2 = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(pitch * 1.08, t0);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.9, t0 + spacing * 0.8);

      f1.type = "bandpass";
      f1.frequency.value = 780;
      f1.Q.value = 5.5;
      f2.type = "bandpass";
      f2.frequency.value = 1250;
      f2.Q.value = 7;

      const amp = level * (0.55 + joy * 1.05) * (i === 0 ? 1.05 : 0.9 - i * 0.06);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp), t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + spacing * 0.88);

      osc.connect(f1);
      f1.connect(f2);
      f2.connect(gain);
      gain.connect(out);
      osc.start(t0);
      osc.stop(t0 + spacing + 0.02);

      const br = ctx.createBufferSource();
      br.buffer = this.getNoise(ctx, "pink");
      br.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = "bandpass";
      hp.frequency.value = 2100;
      hp.Q.value = 1.2;
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.0001, t0);
      bg.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp * 0.4), t0 + 0.012);
      bg.gain.exponentialRampToValueAtTime(0.0001, t0 + spacing * 0.7);
      br.connect(hp);
      hp.connect(bg);
      bg.connect(out);
      br.start(t0);
      br.stop(t0 + spacing + 0.02);
    }
  }

  /** Generic filtered-noise burst for clack (wheel on stone) and chug (steam). */
  private fireBurst(kind: string, at: number, tone: number, level: number, step: number) {
    const ctx = this.ctx;
    const out = this.bus();
    if (!ctx || !out) return;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx, kind === "clack" ? "white" : "pink");
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = kind === "clack" ? "bandpass" : "lowpass";
    bp.frequency.setValueAtTime(tone * (step % 2 ? 0.85 : 1.15), at);
    bp.Q.value = kind === "clack" ? 9 : 1.2;
    const decay = kind === "clack" ? 0.06 : 0.22;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    src.connect(bp);
    bp.connect(gain);
    gain.connect(out);
    src.start(at);
    src.stop(at + decay + 0.05);

    if (kind === "clack") {
      // stone ring underneath an iron-rimmed wheel
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(tone * 1.9, at);
      og.gain.setValueAtTime(0.0001, at);
      og.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 0.4), at + 0.004);
      og.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
      osc.connect(og);
      og.connect(out);
      osc.start(at);
      osc.stop(at + 0.16);
    }

    if (kind === "chug") {
      // piston thump under the steam puff
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(tone * 0.45, at);
      osc.frequency.exponentialRampToValueAtTime(tone * 0.22, at + 0.1);
      og.gain.setValueAtTime(0.0001, at);
      og.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 0.7), at + 0.008);
      og.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
      osc.connect(og);
      og.connect(out);
      osc.start(at);
      osc.stop(at + 0.18);
    }
  }

  /* --------------------------------------------------------------- signals */

  private scheduleSignal(clock: SignalClock, state: DriveState) {
    const ctx = this.ctx;
    if (!ctx || !this.accents) return;
    if (ctx.currentTime < clock.next) return;
    const spec = clock.spec;
    const at = ctx.currentTime + 0.05;
    this.fireSignal(spec, at, state);
    const pace = spec.speedLinked ? 1 / (0.5 + state.load * 1.4) : 1;
    const jitter = (audioRandom() - 0.5) * 2 * (spec.jitter ?? 0);
    clock.next = ctx.currentTime + Math.max(4, spec.everySeconds * pace + jitter);
  }

  private fireSignal(spec: SignalSpec, at: number, state: DriveState) {
    const ctx = this.ctx;
    const out = this.bus();
    if (!ctx || !out) return;
    const { kind, tone, level } = spec;

    if (kind === "laugh") {
      this.fireLaugh(at, tone, level, state);
      return;
    }

    if (kind === "hohoho") {
      // deep, warm and slow: three descending "ho" syllables
      for (let i = 0; i < 3; i += 1) {
        const t0 = at + i * 0.34;
        const osc = ctx.createOscillator();
        const f1 = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(tone * (1 - i * 0.06), t0);
        osc.frequency.linearRampToValueAtTime(tone * (0.88 - i * 0.06), t0 + 0.3);
        f1.type = "bandpass";
        f1.frequency.value = 480; // "oh" formant
        f1.Q.value = 5;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(level, t0 + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
        osc.connect(f1);
        f1.connect(gain);
        gain.connect(out);
        osc.start(t0);
        osc.stop(t0 + 0.34);
      }
      return;
    }

    if (kind === "horn") {
      // ship's horn: stacked low partials with a slow swell and long tail
      const dur = 3.4;
      [1, 1.5, 2.02, 3.01].forEach((ratio, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i === 0 ? "sawtooth" : "sine";
        osc.frequency.setValueAtTime(tone * ratio * 0.98, at);
        osc.frequency.linearRampToValueAtTime(tone * ratio, at + 0.6);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.linearRampToValueAtTime(level / (i + 1.3), at + 0.55);
        gain.gain.setValueAtTime(level / (i + 1.3), at + dur - 1.2);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(at);
        osc.stop(at + dur + 0.1);
      });
      return;
    }

    if (kind === "whistle") {
      const dur = 1.5;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const air = ctx.createBufferSource();
      const hp = ctx.createBiquadFilter();
      const ag = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(tone * 0.94, at);
      osc.frequency.linearRampToValueAtTime(tone, at + 0.3);
      osc.frequency.linearRampToValueAtTime(tone * 0.9, at + dur);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(level, at + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(gain);
      gain.connect(out);
      air.buffer = this.getNoise(ctx, "white");
      air.loop = true;
      hp.type = "highpass";
      hp.frequency.value = tone * 1.5;
      ag.gain.setValueAtTime(0.0001, at);
      ag.gain.exponentialRampToValueAtTime(level * 0.5, at + 0.16);
      ag.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      air.connect(hp);
      hp.connect(ag);
      ag.connect(out);
      osc.start(at);
      air.start(at);
      osc.stop(at + dur + 0.1);
      air.stop(at + dur + 0.1);
      return;
    }

    if (kind === "seagull") {
      for (let i = 0; i < 3; i += 1) {
        const t0 = at + i * 0.26;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(tone * 0.8, t0);
        osc.frequency.exponentialRampToValueAtTime(tone * 1.6, t0 + 0.07);
        osc.frequency.exponentialRampToValueAtTime(tone * 0.7, t0 + 0.2);
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = tone * 1.4;
        bp.Q.value = 4;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(level, t0 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
        osc.connect(bp);
        bp.connect(gain);
        gain.connect(out);
        osc.start(t0);
        osc.stop(t0 + 0.26);
      }
      return;
    }

    if (kind === "whip") {
      const src = ctx.createBufferSource();
      src.buffer = this.getNoise(ctx, "white");
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 2.5;
      bp.frequency.setValueAtTime(tone * 0.5, at);
      bp.frequency.exponentialRampToValueAtTime(tone * 2.2, at + 0.05);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(level, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
      src.connect(bp);
      bp.connect(gain);
      gain.connect(out);
      src.start(at);
      src.stop(at + 0.26);
      return;
    }

    if (kind === "neigh") {
      // a whinny: a bright vibrato tone that falls away into breath
      const dur = 0.9;
      const osc = ctx.createOscillator();
      const vib = ctx.createOscillator();
      const vibDepth = ctx.createGain();
      const bp = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(tone * 1.3, at);
      osc.frequency.exponentialRampToValueAtTime(tone * 0.72, at + dur);
      vib.type = "sine";
      vib.frequency.value = 18;
      vibDepth.gain.value = 90;
      vib.connect(vibDepth);
      vibDepth.connect(osc.detune);
      bp.type = "bandpass";
      bp.frequency.value = tone * 3;
      bp.Q.value = 3;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(level, at + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(bp);
      bp.connect(gain);
      gain.connect(out);
      osc.start(at);
      vib.start(at);
      osc.stop(at + dur + 0.05);
      vib.stop(at + dur + 0.05);
      return;
    }

    // beam: a soft sci-fi sweep
    const dur = 1.1;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    osc.type = "sine";
    osc.frequency.setValueAtTime(tone * 0.5, at);
    osc.frequency.exponentialRampToValueAtTime(tone * 2, at + dur * 0.8);
    lp.type = "lowpass";
    lp.frequency.value = tone * 4;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(out);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  /** Fires a profile's signature one-shot on demand (used by the Studio). */
  demoSignal(spec: SignalSpec, state: DriveState) {
    const ctx = this.ctx;
    if (!ctx) return;
    this.fireSignal(spec, ctx.currentTime + 0.05, state);
  }

  /* -------------------------------------------------------------- teardown */

  private teardownVoices() {
    this.improved?.dispose();
    this.improved = null;
    this.dynamicDrive?.dispose();
    this.dynamicDrive = null;
    this.symphony?.dispose();
    this.symphony = null;
    this.fusion?.dispose();
    this.fusion = null;
    this.world?.dispose();
    this.world = null;
    this.hybrid?.dispose();
    this.hybrid = null;
    this.voices.forEach(({ osc }) => {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
    });
    this.voices = [];
    if (this.noise) {
      try {
        this.noise.src.stop();
      } catch {
        /* already stopped */
      }
      this.noise = null;
    }
    if (this.lfo) {
      try {
        this.lfo.osc.stop();
      } catch {
        /* already stopped */
      }
      this.lfo = null;
    }
    this.textures.forEach(({ src, lfo }) => {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      try {
        lfo?.osc.stop();
      } catch {
        /* already stopped */
      }
    });
    this.textures = [];
    this.rhythms = [];
    this.signals = [];
  }

  async stop() {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.swapTimer) clearTimeout(this.swapTimer);
    this.swapTimer = null;
    this.swapping = false;
    this.hybridLoadController?.abort();
    this.hybridLoadController = null;
    if (this.master) this.master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
    await new Promise((r) => setTimeout(r, 380));
    this.stopSnippetBeds();
    this.snippets = [];
    this.teardownVoices();
    this.live()?.removeEventListener("statechange", this.onStateChange);
    if ("close" in ctx && typeof ctx.close === "function") await ctx.close();
    this.ctx = null;
    this.master = null;
    this.duck = null;
    this.cabinIn = null;
    this.cabinLow = null;
    this.cabinMid = null;
    this.cabinHigh = null;
    this.peakProtect?.dispose();
    this.peakProtect = null;
    this.boostGain = null;
    this.makeupGain = null;
    this.makeupLimiter = null;
    this.appliedMakeupDb = null;
    this.limiter = null;
    this.analyser = null;
    this.meterBuffer = null;
    this.preAnalyser = null;
    this.preMeterBuffer = null;
    this.body = null;
    this.accents = null;
    this.beds = null;
    this.filter = null;
    this.layers = {};
    this.reverb = null;
    this.reverbDamp = null;
    this.wet = null;
    this.profile = null;
    this.profileBus = null;
  }
}
