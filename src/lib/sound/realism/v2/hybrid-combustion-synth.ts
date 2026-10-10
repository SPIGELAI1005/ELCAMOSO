/**
 * HybridCombustionSynth - Realism V2.2 combustion backend.
 * Continuous worklet excitation → RPM-tracking order resonators + semi-stationary
 * formants / body resonance → short exhaust-pipe space. Scheduled mechanical and
 * exhaust transients (shift thump, reengage bark, rev-match, overrun, turbo) ride on
 * the same persistent voices. Optional sample overlay.
 * Powertrain V2/V3 is authoritative for RPM / load / shift phase.
 */

import type { DriveState } from "@/lib/drive/model";
import { getNoiseBuffer } from "@/lib/sound/dsp/noise";
import {
  acousticEngineForProfile,
  firingHzFromRpm,
  type AcousticEngineConfig,
} from "@/lib/sound/realism/v2/acoustic-engine";
import {
  createCombustionExcitation,
  type CombustionExcitationHandle,
} from "@/lib/sound/realism/v2/combustion-excitation";
import {
  EMPTY_COMBUSTION_SAMPLE_BANKS,
  loadRegionFromDemand,
  reportAmericanV8SampleCoverage,
  selectSampleMix,
  type AmericanV8RequiredRegion,
  type CombustionSampleBank,
  type CombustionSampleEntry,
} from "@/lib/sound/realism/v2/sample-bank";
import type { StrategyBuses } from "@/lib/sound/realism/types";
import type { SoundProfile } from "@/lib/sound/profiles";
import {
  resolveDrivetrain,
  resolvePersonalityId,
  type ResolvedDrivetrain,
} from "@/lib/drive/drivetrain-resolve";
import type { ShiftPhase } from "@/lib/powertrain/types";
import {
  profileExperienceConfig,
  type AudioLayerRole,
  type ProfileExperienceConfig,
} from "@/lib/sound/profile-experience-config";
import {
  createTransientSchedulerState,
  resolveVariantPools,
  tickTransientScheduler,
  type ActiveTransientPulse,
  type PersonalityVariantPools,
  type TransientKind,
  type TransientSchedulerState,
  type TransientVariant,
} from "@/lib/sound/dynamic-drive/transient-scheduler";

export type RealismEngineMode = "current" | "v2";

export interface HybridCombustionDiagnostics {
  realismEngine: "v2";
  excitationMode: "worklet" | "fallback" | "none";
  firingHz: number;
  cylinders: number;
  sampleAssisted: boolean;
  supportGain: number;
  combustionGain: number;
  intakeGain: number;
  spectralTiltDb: number;
  formantGains: number[];
  shiftPhase: ShiftPhase | "idle";
  load: number;
  demand: number;
  /** Approximate graph size (reused nodes; not per-fire). */
  activeNodeEstimate: number;
  audioContextState: string;
  sampleState: "unavailable" | "loading" | "ready" | "partial" | "failed";
  sampleFallbackReason:
    | "none"
    | "no-approved-assets"
    | "no-load-bank"
    | "rate-out-of-range"
    | "decode-failed";
  activeSampleIds: string[];
  /**
   * Required Muscle pilot regions with no approved sample entry.
   * Empty bank ⇒ all nine regions uncovered; procedural stays authoritative.
   */
  uncoveredOperatingRegions: AmericanV8RequiredRegion[];
  eventCounts: { shift: number; overrun: number; boostRelease: number };
  boostSource: "simulated-powertrain" | "unavailable";
  /** Scheduled one-shot transients by kind (V2.2). */
  transientCounts: Partial<Record<TransientKind, number>>;
  /** core = gears only (FREE live Drive); full = Drive+ / Demo extras. */
  transientTier: "core" | "full";
  /** Exhaust-pipe impulse response + stereo decorrelation available on this context. */
  spaceMode: "pipe-ir" | "dry";
  /** Current RPM-tracking order resonator centers (Hz). */
  orderHz: number[];
}

function targetParam(param: AudioParam, value: number, t: number, tau: number) {
  param.setTargetAtTime(value, t, Math.max(0.01, tau));
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

interface FormantBand {
  filter: BiquadFilterNode;
  gain: GainNode;
}

interface OrderBand extends FormantBand {
  /** Engine order (events per crankshaft revolution). */
  order: number;
  weight: number;
}

interface SampleVoice {
  src: AudioBufferSourceNode;
  gain: GainNode;
  entryId: string;
}

type TransientVoiceId = "shift" | "thump" | "pop" | "turbo";

interface TransientVoice {
  id: TransientVoiceId;
  noise: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
}

const VOICE_FOR_KIND: Record<TransientKind, TransientVoiceId> = {
  upshift: "shift",
  downshift: "shift",
  "rev-match": "pop",
  overrun: "pop",
  "exhaust-pop": "pop",
  "turbo-flutter": "turbo",
  wastegate: "turbo",
  "drivetrain-thump": "thump",
};

/**
 * Peak gain per voice at variant intensity 1 (accents bus, pre-limiter).
 * Calibrated against the offline replay: a shift should lift the 180 ms after
 * the event by roughly 4-7 dB over the preceding bed, not dominate it.
 */
const VOICE_PEAK: Record<TransientVoiceId, number> = {
  shift: 0.7,
  thump: 0.45,
  pop: 0.4,
  turbo: 0.3,
};
/** Variant intensity x strength never collapses a pulse to inaudible; it scales 40-100 %. */
const PULSE_FLOOR = 0.4;

/** Transients every tier renders once gears are active. Everything else is Drive+ / Demo. */
const CORE_TRANSIENT_KINDS: ReadonlySet<TransientKind> = new Set<TransientKind>([
  "upshift",
  "downshift",
  "drivetrain-thump",
]);

/** Reengage bark window after the mechanical thump (seconds). */
const BARK_SECONDS = 0.16;
/** Legacy (no powertrain) shift choreography offsets. */
const LEGACY_THUMP_DELAY = 0.09;
const LEGACY_BARK_DELAY = 0.13;

/** Pipe-IR early reflections for a ~1 m exhaust tract plus a short diffuse tail. */
const PIPE_IR_SECONDS = 0.07;

/** Half-order energy exists only where firing is uneven (lope, cross-plane, twin, single). */
function halfOrderWeight(architectureCode: number): number {
  if (architectureCode === 1 || architectureCode === 4 || architectureCode === 5) return 0.75;
  if (architectureCode === 3) return 0.5;
  return 0.18;
}

/**
 * Drop-in orchestrator for combustion profiles under Realism V2.2.
 */
export class HybridCombustionSynth {
  private disposed = false;
  private cfg: AcousticEngineConfig | null = null;
  private experience: ProfileExperienceConfig | null = null;
  private profile: SoundProfile | null = null;
  private drivetrain: ResolvedDrivetrain | null = null;
  private pools: PersonalityVariantPools | null = null;
  private ctx: BaseAudioContext | null = null;
  private excitation: CombustionExcitationHandle | null = null;
  private exhaustFormants: FormantBand[] = [];
  private intakeFormants: FormantBand[] = [];
  private bodyResonances: FormantBand[] = [];
  private orderBands: OrderBand[] = [];
  private supportBus: GainNode | null = null;
  private combustionBus: GainNode | null = null;
  private intakeBus: GainNode | null = null;
  private spectralTilt: BiquadFilterNode | null = null;
  private pipeSend: GainNode | null = null;
  private pipe: ConvolverNode | null = null;
  private mechanical: {
    src: AudioBufferSourceNode;
    filter: BiquadFilterNode;
    gain: GainNode;
  } | null = null;
  private overrun: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null =
    null;
  private turbo: {
    src: AudioBufferSourceNode;
    filter: BiquadFilterNode;
    gain: GainNode;
    spool: number;
  } | null = null;
  private voices: Partial<Record<TransientVoiceId, TransientVoice>> = {};
  private sampleVoices = new Map<string, SampleVoice>();
  private sampleBus: GainNode | null = null;
  private sampleBank: CombustionSampleBank | null = null;
  private decodedSamples = new Map<string, AudioBuffer>();
  private scheduler: TransientSchedulerState = createTransientSchedulerState();
  private prevPowertrain: DriveState["powertrain"] | null = null;
  private prevSpeedKmh = 0;
  private lastGear = 0;
  private lastShifting = false;
  private lastShiftPhase: ShiftPhase | "idle" = "idle";
  private lastOverrun = false;
  private lastBoostRelease = false;
  private lastUpdateTime = 0;
  private priorLoad = 0;
  private barkStart = 0;
  private barkUntil = 0;
  private barkAmount = 0;
  private legacyRng = 0.37;
  private advancedTransients = true;
  private mutedRoles = new Set<AudioLayerRole>();
  private nodeEstimate = 0;
  private diagnostics: HybridCombustionDiagnostics = {
    realismEngine: "v2",
    excitationMode: "none",
    firingHz: 0,
    cylinders: 0,
    sampleAssisted: false,
    supportGain: 0,
    combustionGain: 0,
    intakeGain: 0,
    spectralTiltDb: 0,
    formantGains: [],
    shiftPhase: "idle",
    load: 0,
    demand: 0,
    activeNodeEstimate: 0,
    audioContextState: "closed",
    sampleState: "unavailable",
    sampleFallbackReason: "no-approved-assets",
    activeSampleIds: [],
    uncoveredOperatingRegions: [...reportAmericanV8SampleCoverage(null).uncovered],
    eventCounts: { shift: 0, overrun: 0, boostRelease: 0 },
    boostSource: "unavailable",
    transientCounts: {},
    transientTier: "full",
    spaceMode: "dry",
    orderHz: [],
  };

  build(ctx: BaseAudioContext, profile: SoundProfile, buses: StrategyBuses): boolean {
    this.dispose();
    this.disposed = false;
    const cfg = acousticEngineForProfile(profile.id);
    if (!cfg) return false;
    this.cfg = cfg;
    this.experience = profileExperienceConfig(profile.id);
    this.profile = profile;
    this.ctx = ctx;
    this.drivetrain = resolveDrivetrain(profile);
    this.pools = resolveVariantPools(this.drivetrain.transient);
    this.scheduler = createTransientSchedulerState(0.42);

    const personalityId = resolvePersonalityId(profile);
    this.sampleBank = EMPTY_COMBUSTION_SAMPLE_BANKS[personalityId] ?? {
      personalityId,
      entries: [],
    };

    let nodes = 0;
    this.combustionBus = ctx.createGain();
    this.combustionBus.gain.value = 0.4;
    this.intakeBus = ctx.createGain();
    this.intakeBus.gain.value = 0.26;
    this.supportBus = ctx.createGain();
    this.supportBus.gain.value = 0.12;
    this.sampleBus = ctx.createGain();
    this.sampleBus.gain.value = 0.0001;
    nodes += 4;

    this.spectralTilt = ctx.createBiquadFilter();
    this.spectralTilt.type = "highshelf";
    this.spectralTilt.frequency.value = 1800;
    this.spectralTilt.gain.value = -2;
    nodes += 1;

    this.excitation = createCombustionExcitation(ctx);
    this.diagnostics.excitationMode = this.excitation.mode;
    nodes += this.excitation.mode === "worklet" ? 1 : 5;

    // Exhaust formants - semi-stationary resonances excited by combustion
    this.exhaustFormants = cfg.exhaustFormantsHz.map((hz, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = i === 0 ? "lowpass" : "bandpass";
      filter.frequency.value = hz;
      filter.Q.value = i === 0 ? 0.7 : 1.15;
      const gain = ctx.createGain();
      gain.gain.value = 0.32 / (1 + i * 0.55);
      this.excitation!.node.connect(filter);
      filter.connect(gain);
      gain.connect(this.spectralTilt!);
      nodes += 2;
      return { filter, gain };
    });
    this.spectralTilt.connect(this.combustionBus);

    // Body / structure resonances - stay nearly fixed vs RPM
    this.bodyResonances = cfg.bodyResonanceHz.map((hz, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = hz;
      filter.Q.value = 2.2 + i * 0.4;
      filter.gain.value = 3.5 - i * 0.8;
      const gain = ctx.createGain();
      gain.gain.value = 0.2 / (1 + i * 0.4);
      this.excitation!.node.connect(filter);
      filter.connect(gain);
      gain.connect(this.combustionBus!);
      nodes += 2;
      return { filter, gain };
    });

    // Intake formants
    this.intakeFormants = cfg.intakeFormantsHz.map((hz, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = hz;
      filter.Q.value = 1.45;
      const gain = ctx.createGain();
      gain.gain.value = (0.2 * cfg.intakePresence) / (1 + i * 0.5);
      this.excitation!.node.connect(filter);
      filter.connect(gain);
      gain.connect(this.intakeBus!);
      nodes += 2;
      return { filter, gain };
    });

    // RPM-tracking engine-order resonators carved out of the excitation itself.
    // They replace the previous sine / triangle support oscillators: the harmonic
    // weight now comes from the combustion pulses, so it keeps their jitter and grit.
    {
      const firingOrder = cfg.cylinders / 2;
      const half = halfOrderWeight(cfg.architectureCode);
      const spec: Array<{ order: number; weight: number; q: number }> = [
        { order: firingOrder / 2, weight: 0.62 * half, q: 7.5 },
        { order: firingOrder, weight: 1, q: 8.5 },
        { order: firingOrder * 2, weight: 0.42, q: 6 },
      ];
      this.orderBands = spec.map(({ order, weight, q }) => {
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = Math.max(20, (cfg.redlineRpm * 0.12 * order) / 60);
        filter.Q.value = q;
        const gain = ctx.createGain();
        gain.gain.value = 0.0001;
        this.excitation!.node.connect(filter);
        filter.connect(gain);
        gain.connect(this.supportBus!);
        nodes += 2;
        return { filter, gain, order, weight };
      });
    }
    const supportLp = ctx.createBiquadFilter();
    supportLp.type = "lowpass";
    supportLp.frequency.value = 1400 + cfg.bodyBrightness * 900;
    supportLp.Q.value = 0.75;
    this.supportBus.connect(supportLp);
    supportLp.connect(buses.body);
    nodes += 1;

    // Space: short exhaust-pipe impulse response with decorrelated L/R, mixed under the
    // dry combustion path. Feature-detected so offline / mocked contexts stay dry.
    if (typeof ctx.createConvolver === "function") {
      try {
        const pipe = ctx.createConvolver();
        pipe.normalize = false;
        pipe.buffer = buildPipeImpulse(ctx, cfg);
        const send = ctx.createGain();
        send.gain.value = 0.3 + cfg.exhaustPulse * 0.14;
        this.combustionBus.connect(send);
        this.supportBus.connect(send);
        send.connect(pipe);
        pipe.connect(buses.body);
        this.pipe = pipe;
        this.pipeSend = send;
        this.diagnostics.spaceMode = "pipe-ir";
        nodes += 2;
      } catch {
        this.pipe = null;
        this.pipeSend = null;
        this.diagnostics.spaceMode = "dry";
      }
    } else {
      this.diagnostics.spaceMode = "dry";
    }

    this.combustionBus.connect(buses.body);
    this.intakeBus.connect(buses.beds);
    this.sampleBus.connect(buses.body);

    // Mechanical / valvetrain - restrained brown through bandpass
    {
      const src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer(ctx, "brown");
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1400 + cfg.mechanicalIntensity * 800;
      filter.Q.value = 1.25;
      const gain = ctx.createGain();
      gain.gain.value = 0.03 * cfg.mechanicalIntensity;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(buses.accents);
      src.start();
      this.mechanical = { src, filter, gain };
      nodes += 3;
    }

    {
      const src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer(ctx, "pink");
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 620;
      filter.Q.value = 1.6;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(buses.beds);
      src.start();
      this.overrun = { src, filter, gain };
      nodes += 3;
    }

    if (cfg.forcedInduction) {
      const src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer(ctx, "pink");
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 2200;
      filter.Q.value = 2.2;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(buses.accents);
      src.start();
      this.turbo = { src, filter, gain, spool: 0 };
      nodes += 3;
    }

    // Persistent transient voices - noise → filter → gain, envelopes scheduled per event.
    const makeVoice = (
      id: TransientVoiceId,
      color: "white" | "pink" | "brown",
      type: BiquadFilterType,
      hz: number,
      q: number,
    ): TransientVoice => {
      const noise = ctx.createBufferSource();
      noise.buffer = getNoiseBuffer(ctx, color);
      noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = hz;
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(buses.accents);
      noise.start();
      nodes += 3;
      return { id, noise, filter, gain };
    };
    this.voices = {
      shift: makeVoice("shift", "pink", "bandpass", 760, 1.1),
      thump: makeVoice("thump", "brown", "lowpass", 160, 1.6),
      pop: makeVoice("pop", "pink", "bandpass", 520, 1.5),
      ...(cfg.forcedInduction ? { turbo: makeVoice("turbo", "white", "bandpass", 1500, 2.4) } : {}),
    };

    this.nodeEstimate = nodes;
    this.diagnostics.cylinders = cfg.cylinders;
    this.diagnostics.sampleAssisted = false;
    this.diagnostics.sampleState = this.sampleBank.entries.length ? "loading" : "unavailable";
    this.diagnostics.sampleFallbackReason = this.sampleBank.entries.length
      ? "decode-failed"
      : "no-approved-assets";
    this.diagnostics.uncoveredOperatingRegions = reportAmericanV8SampleCoverage(
      this.sampleBank,
    ).uncovered;
    this.diagnostics.activeNodeEstimate = nodes;
    this.diagnostics.transientCounts = {};
    this.diagnostics.transientTier = this.advancedTransients ? "full" : "core";
    this.diagnostics.audioContextState =
      "state" in ctx ? String((ctx as AudioContext).state) : "offline";
    return true;
  }

  /** Drive+ / Demo extras (rev-match, overrun, pops, turbo). Core shifts always render. */
  setAdvancedTransientsEnabled(enabled: boolean) {
    this.advancedTransients = enabled;
    this.diagnostics.transientTier = enabled ? "full" : "core";
  }

  setDecodedSamples(map: Map<string, AudioBuffer>) {
    this.decodedSamples = map;
    const expected = this.sampleBank?.entries.length ?? 0;
    this.diagnostics.sampleAssisted = map.size > 0 && expected > 0;
    this.diagnostics.uncoveredOperatingRegions = reportAmericanV8SampleCoverage(
      this.sampleBank,
    ).uncovered;
    this.diagnostics.sampleState =
      expected === 0
        ? "unavailable"
        : map.size === 0
          ? "failed"
          : map.size < expected
            ? "partial"
            : "ready";
    this.diagnostics.sampleFallbackReason =
      map.size > 0 ? "none" : expected ? "decode-failed" : "no-approved-assets";
  }

  update(state: DriveState, audioTime: number) {
    if (this.disposed || !this.cfg || !this.excitation) return;
    const cfg = this.cfg;
    const dt =
      this.lastUpdateTime > 0
        ? Math.max(0.001, Math.min(0.1, audioTime - this.lastUpdateTime))
        : 1 / 60;
    this.lastUpdateTime = audioTime;
    const gate = (role: AudioLayerRole) => (this.mutedRoles.has(role) ? 0.0001 : 1);
    const rpm = Math.max(0, state.rpm || 0);
    const pt = state.powertrain;
    const demand = pt?.driverDemand ?? state.throttle;
    const load = pt?.engineLoad ?? state.load;
    const overrun = Boolean(pt?.overrun || state.regen > 0.45);
    const shifting = Boolean(pt?.shifting || state.isShifting);
    const shiftPhase: ShiftPhase | "idle" = shifting
      ? (pt?.shiftPhase ?? "ratio_transition")
      : "idle";
    const shiftLoad = pt?.shiftLoadMultiplier ?? (shifting ? 0.55 : 1);
    const revMatch = Boolean(pt?.revMatchActive);
    const speedKmh = state.speed * 3.6;

    const firingHz = firingHzFromRpm(rpm, cfg.cylinders, cfg.stroke);
    this.diagnostics.firingHz = firingHz;
    this.diagnostics.shiftPhase = shiftPhase;
    this.diagnostics.load = load;
    this.diagnostics.demand = demand;
    this.diagnostics.boostSource = pt ? "simulated-powertrain" : "unavailable";

    const rpmNorm = Math.min(1, rpm / Math.max(1, cfg.redlineRpm));
    const idleGate = Math.max(0, 1 - rpmNorm * 2.2) * Math.max(0, 1 - demand * 2);
    // Idle lope fades with RPM / demand, but combustion never becomes perfectly periodic:
    // a light-load floor keeps 2-5 % cycle variation at cruise (worklet scales it further).
    const irregularity = Math.min(
      1,
      cfg.idleIrregularity * idleGate * (overrun ? 0.35 : 1) + 0.05 + (1 - load) * 0.04,
    );

    // Transient choreography - scheduler (powertrain) or legacy edge detection.
    this.tickTransients(state, speedKmh, audioTime);

    // Combustion energy: load changes timbre path, not only loudness
    let intensity =
      0.18 +
      demand * 0.34 +
      load * 0.32 +
      rpmNorm * 0.14 * (0.45 + demand * 0.55) +
      load * demand * cfg.highLoadEnrichment * 0.2;

    // Authoritative phase load from Powertrain (torque cut → reengage)
    if (shifting) intensity *= Math.max(0.18, Math.min(1, shiftLoad));
    if (revMatch) intensity = Math.min(1, intensity + 0.28 * (pt?.revMatchProgress ?? 0.5));
    if (overrun) intensity *= 0.55;
    // Reengage bark: clutch / converter takes up drive and combustion snaps back.
    const bark = this.barkLevel(audioTime);
    if (bark > 0) intensity = Math.min(1, intensity + bark);

    const sharpness = Math.min(
      1,
      cfg.combustionSharpness * (0.55 + load * 0.55 + demand * 0.25 + bark * 0.4),
    );

    this.excitation.setParams({
      firingHz,
      intensity: Math.min(1, intensity * cfg.exhaustPulse),
      irregularity,
      load,
      sharpness,
      architecture: cfg.architectureCode,
      audioTime,
    });

    // Spectral tilt: cruise darker, high load brighter (timbre, not gain-only)
    if (this.spectralTilt) {
      const tiltDb = -4 + load * 5.5 + demand * 2.5 * cfg.highLoadEnrichment + bark * 3;
      targetParam(this.spectralTilt.gain, tiltDb, audioTime, 0.07);
      this.diagnostics.spectralTiltDb = tiltDb;
    }

    this.exhaustFormants.forEach((band, i) => {
      const base = 0.26 / (1 + i * 0.48);
      // Cruise keeps a body; full load adds pressure. Together with the excitation
      // this holds the cruise-to-full-load span near 12-16 dB (cabin-plausible).
      const loadLift =
        0.7 +
        load * (0.3 + cfg.loadContrast * 0.2) +
        demand * (0.1 + cfg.loadContrast * 0.1);
      const upperRpm = i > 1 ? rpmNorm * cfg.upperRpmEnergy * (0.12 + load * 0.28) : 0;
      const enrich = 1 + (i > 1 ? load * cfg.highLoadEnrichment * 0.55 + upperRpm : 0);
      const dark = 1 - cfg.bodyBrightness * 0.22;
      targetParam(
        band.gain.gain,
        base * loadLift * enrich * dark * cfg.exhaustPulse,
        audioTime,
        0.055,
      );
      if (i > 0) {
        const hz = cfg.exhaustFormantsHz[i]! * (1 + rpmNorm * 0.035 * i);
        targetParam(band.filter.frequency, hz, audioTime, 0.12);
        targetParam(band.filter.Q, 1.0 + load * 0.45, audioTime, 0.1);
      }
    });

    this.bodyResonances.forEach((band, i) => {
      const excite = 0.28 + load * 0.22 + demand * 0.12;
      targetParam(band.gain.gain, (0.16 / (1 + i * 0.35)) * excite, audioTime, 0.08);
      // Keep centers nearly stationary
      const hz = cfg.bodyResonanceHz[i]! * (1 + rpmNorm * 0.015);
      targetParam(band.filter.frequency, hz, audioTime, 0.18);
    });

    this.intakeFormants.forEach((band, i) => {
      const base = (0.16 * cfg.intakePresence) / (1 + i * 0.42);
      let intake =
        demand * (0.62 + cfg.intakeLoadResponse * 0.46) +
        load * (0.18 + cfg.intakeLoadResponse * 0.24);
      if (shifting) {
        if (shiftPhase === "torque_cut" || shiftPhase === "disengage") intake *= 0.35;
        else if (pt?.shiftDirection === "down") intake *= 1.15;
      }
      if (overrun) intake *= 0.12;
      if (bark > 0) intake += bark * 1.4;
      targetParam(band.gain.gain, base * (0.2 + intake), audioTime, 0.05);
      targetParam(band.filter.Q, 1.2 + demand * 0.5, audioTime, 0.1);
    });

    // Engine-order resonators track crank speed tightly; weight rises with load.
    const revHz = Math.max(0, rpm / 60);
    const orderHz: number[] = [];
    this.orderBands.forEach((band) => {
      const hz = Math.max(20, Math.min(2400, revHz * band.order));
      orderHz.push(hz);
      targetParam(band.filter.frequency, hz, audioTime, 0.03);
      const density = 0.6 + load * 0.3 + demand * 0.1;
      const upper =
        band.order > cfg.cylinders / 2
          ? 0.3 + load * cfg.highLoadEnrichment * 0.7 + rpmNorm * cfg.upperRpmEnergy * 0.5
          : 1;
      // Fundamental weight thins out when the excitation is already dense at high RPM.
      const lowRpmBody = band.order <= cfg.cylinders / 2 ? 1 - rpmNorm * 0.35 : 1;
      targetParam(
        band.gain.gain,
        band.weight * 0.34 * density * upper * lowRpmBody * (shifting ? 0.6 : 1),
        audioTime,
        0.06,
      );
    });
    this.diagnostics.orderHz = orderHz;
    if (this.supportBus) {
      targetParam(this.supportBus.gain, (0.16 + load * 0.1) * gate("combustion"), audioTime, 0.08);
    }
    if (this.pipeSend) {
      // Pipe energy grows with exhaust pulse strength; overrun lets the pipe ring more.
      const pipeLevel = (0.26 + load * 0.14 + (overrun ? 0.1 : 0)) * (0.7 + cfg.exhaustPulse * 0.4);
      targetParam(this.pipeSend.gain, pipeLevel * gate("exhaust"), audioTime, 0.1);
    }
    if (this.combustionBus) {
      // Bus level is the one place loudness follows load; the stages before it are
      // mostly timbre so the chain does not compound into a 25 dB idle-to-WOT span.
      const body = (0.42 + load * 0.24 + demand * 0.1) * (1 + bark * 0.5);
      const phaseMul =
        shiftPhase === "torque_cut" || shiftPhase === "disengage"
          ? 0.55
          : shiftPhase === "reengage"
            ? 0.9
            : 1;
      targetParam(
        this.combustionBus.gain,
        body * phaseMul * (overrun ? 0.65 : 1) * gate("combustion"),
        audioTime,
        0.06,
      );
      this.diagnostics.combustionGain = body;
    }
    if (this.intakeBus) {
      const intakeGain = (0.1 + demand * 0.38) * cfg.intakePresence * (overrun ? 0.12 : 1);
      targetParam(this.intakeBus.gain, intakeGain * gate("intake"), audioTime, 0.05);
      this.diagnostics.intakeGain = intakeGain;
    }

    if (this.mechanical) {
      targetParam(
        this.mechanical.gain.gain,
        0.02 * cfg.mechanicalIntensity * (0.35 + rpmNorm + load * 0.55) * gate("mechanical"),
        audioTime,
        0.08,
      );
      targetParam(
        this.mechanical.filter.frequency,
        1050 + rpmNorm * 1500 + cfg.mechanicalIntensity * 400,
        audioTime,
        0.1,
      );
    }

    // Overrun bed: requires prior load + lift - not random cruise pops
    if (this.overrun) {
      const on = overrun && rpm > 1200 && demand < 0.18 && this.priorLoad > 0.28;
      const level = on
        ? (0.045 + Math.min(0.07, (rpmNorm - 0.15) * 0.1)) * cfg.overrunCharacter
        : 0.0001;
      targetParam(this.overrun.gain.gain, level * gate("exhaust"), audioTime, on ? 0.04 : 0.09);
      targetParam(this.overrun.filter.frequency, 460 + rpmNorm * 380, audioTime, 0.1);
      if (on && !this.lastOverrun) this.diagnostics.eventCounts.overrun += 1;
    }
    this.lastOverrun = overrun;
    this.priorLoad = this.priorLoad * 0.92 + load * 0.08;

    if (this.turbo) {
      const boostWant = pt?.boost ?? 0;
      // Follow deterministic powertrain boost with profile-specific acoustic lag.
      const dynamics = this.experience?.aspirationDynamics;
      const tau =
        boostWant >= this.turbo.spool
          ? dynamics?.attackSeconds || 0.5
          : dynamics?.decaySeconds || 0.38;
      this.turbo.spool +=
        (boostWant - this.turbo.spool) * (1 - Math.exp(-dt / Math.max(0.04, tau)));
      const spool = this.turbo.spool;
      targetParam(
        this.turbo.gain.gain,
        (spool > 0.05 ? spool * 0.075 : 0.0001) * gate("boost"),
        audioTime,
        0.08,
      );
      targetParam(
        this.turbo.filter.frequency,
        1500 + spool * 1900 + rpmNorm * 500,
        audioTime,
        0.1,
      );
      if (
        pt?.boostRelease &&
        !this.lastBoostRelease &&
        this.turbo.spool >= (dynamics?.minimumReleaseState || 0.55)
      ) {
        this.diagnostics.eventCounts.boostRelease += 1;
        if (this.advancedTransients && this.pools) {
          this.firePulse(
            {
              kind: "wastegate",
              variant: this.pickLegacyVariant(this.pools.wastegate),
              strength: 0.55 + spool * 0.4,
            },
            audioTime,
          );
        }
      }
      this.lastBoostRelease = Boolean(pt?.boostRelease);
    }

    // Shift bookkeeping: counts mirror the audible choreography (start + reengage).
    if (shifting && !this.lastShifting) this.diagnostics.eventCounts.shift += 1;
    if (shifting && shiftPhase === "reengage" && this.lastShiftPhase !== "reengage") {
      this.diagnostics.eventCounts.shift += 1;
    }
    this.lastShifting = shifting;
    this.lastShiftPhase = shiftPhase;

    this.updateSamples(rpm, demand, overrun, audioTime);

    this.diagnostics.supportGain = this.supportBus?.gain.value ?? 0;
    this.diagnostics.formantGains = this.exhaustFormants.map((f) => f.gain.gain.value);
    this.diagnostics.activeNodeEstimate = this.nodeEstimate;
    if (this.ctx && "state" in this.ctx) {
      this.diagnostics.audioContextState = String((this.ctx as AudioContext).state);
    }
  }

  /* ------------------------------------------------------------ transients */

  private kindAllowed(kind: TransientKind): boolean {
    return this.advancedTransients || CORE_TRANSIENT_KINDS.has(kind);
  }

  private barkLevel(audioTime: number): number {
    if (audioTime < this.barkStart || audioTime >= this.barkUntil || this.barkAmount <= 0) {
      return 0;
    }
    const remaining = (this.barkUntil - audioTime) / BARK_SECONDS;
    return this.barkAmount * clamp01(remaining);
  }

  /** `at` may sit slightly in the future so the mechanical thump lands first. */
  private armBark(at: number, amount: number) {
    const active = this.lastUpdateTime >= this.barkStart && this.lastUpdateTime < this.barkUntil;
    this.barkStart = at;
    this.barkUntil = at + BARK_SECONDS;
    this.barkAmount = Math.max(active ? this.barkAmount * 0.5 : 0, amount);
  }

  private nextLegacyRand(): number {
    this.legacyRng = (this.legacyRng * 16807 + 0.123) % 1;
    return this.legacyRng;
  }

  private pickLegacyVariant(pool: TransientVariant[]): TransientVariant {
    const idx = Math.floor(this.nextLegacyRand() * pool.length) % Math.max(1, pool.length);
    return pool[idx] ?? pool[0]!;
  }

  private tickTransients(state: DriveState, speedKmh: number, audioTime: number) {
    if (!this.drivetrain || !this.pools) return;
    const pt = state.powertrain;
    const shifting = Boolean(pt?.shifting || state.isShifting);
    const t = this.drivetrain.transient;

    if (pt) {
      const nowMs = audioTime * 1000;
      const tick = tickTransientScheduler({
        pt,
        prevPt: this.prevPowertrain ?? null,
        drivetrain: this.drivetrain,
        speedKmh,
        prevSpeedKmh: this.prevSpeedKmh,
        state: this.scheduler,
        nowMs,
      });
      this.scheduler = tick.state;
      let shiftPulseFired = false;
      for (const pulse of this.scheduler.active) {
        if (pulse.startedAtMs !== nowMs) continue;
        if (!this.kindAllowed(pulse.kind)) continue;
        if (pulse.kind === "upshift" || pulse.kind === "downshift") shiftPulseFired = true;
        this.firePulse(
          {
            kind: pulse.kind,
            variant: {
              id: pulse.variantId,
              intensity: pulse.peakIntensity,
              filterHz: pulse.filterHz,
              decayMs: pulse.durationMs,
            },
            strength: 1,
          },
          audioTime,
        );
      }
      // Core guarantee: a gear change is always audible, even when the scheduler's
      // load / probability gates skip it (light-throttle shifts in town).
      const shiftStart = shifting && !this.lastShifting;
      if (shiftStart && !shiftPulseFired) {
        const up = pt.shiftDirection !== "down";
        const pool = up ? this.pools.upshift : this.pools.downshift;
        const softest = [...pool].sort((a, b) => a.intensity - b.intensity)[0] ?? pool[0]!;
        this.firePulse(
          {
            kind: up ? "upshift" : "downshift",
            variant: softest,
            strength: (up ? t.upshiftStrength : t.downshiftStrength) * 0.75,
          },
          audioTime,
        );
      }
      // Reengage: clutch / converter takes up drive → bark, scaled by demand.
      if (
        shifting &&
        pt.shiftPhase === "reengage" &&
        this.lastShiftPhase !== "reengage"
      ) {
        const down = pt.shiftDirection === "down";
        const demand = pt.driverDemand ?? state.throttle;
        this.armBark(audioTime, (down ? 0.2 : 0.12) + demand * 0.16);
      }
      this.prevPowertrain = { ...pt };
      this.prevSpeedKmh = speedKmh;
      return;
    }

    // Legacy DriveState (no powertrain): choreograph thump → bark from the shift edge.
    const gear = state.gear;
    if (shifting && !this.lastShifting && this.lastGear > 0) {
      const up = gear >= this.lastGear;
      const pool = up ? this.pools.upshift : this.pools.downshift;
      const variant = this.pickLegacyVariant(pool);
      const strength = (up ? t.upshiftStrength : t.downshiftStrength) * (0.7 + state.load * 0.3);
      this.firePulse({ kind: up ? "upshift" : "downshift", variant, strength }, audioTime);
      if (speedKmh > 12) {
        this.firePulse(
          {
            kind: "drivetrain-thump",
            variant: this.pickLegacyVariant(this.pools.thump),
            strength: 0.55 + state.load * 0.3,
          },
          audioTime + LEGACY_THUMP_DELAY,
        );
      }
      this.armBark(audioTime + LEGACY_BARK_DELAY, (up ? 0.1 : 0.18) + state.throttle * 0.14);
    }
    this.lastGear = gear;
    this.prevPowertrain = null;
    this.prevSpeedKmh = speedKmh;
  }

  private firePulse(
    input: { kind: TransientKind; variant: TransientVariant; strength: number },
    audioTime: number,
  ) {
    if (this.mutedRoles.has("event")) return;
    const voiceId = VOICE_FOR_KIND[input.kind];
    const voice = this.voices[voiceId];
    if (!voice) return;
    const { kind, variant, strength } = input;
    const peak =
      VOICE_PEAK[voiceId] * (PULSE_FLOOR + (1 - PULSE_FLOOR) * clamp01(variant.intensity * strength));
    if (peak <= 0.001) return;
    const t = Math.max(audioTime, this.lastUpdateTime) + 0.002;
    const attack = voiceId === "thump" ? 0.012 : voiceId === "turbo" ? 0.008 : 0.005;
    const decayTau = Math.max(0.02, variant.decayMs / 1000 / 3.2);

    voice.filter.frequency.setTargetAtTime(variant.filterHz, t, 0.003);
    const g = voice.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(0.0001, g.value), t);
    g.linearRampToValueAtTime(peak, t + attack);
    if (kind === "turbo-flutter") {
      // Compressor-surge chatter: a handful of decaying bursts around 30 Hz.
      let tt = t + attack;
      let p = peak;
      for (let k = 0; k < 5; k += 1) {
        tt += 0.016;
        g.linearRampToValueAtTime(p * 0.3, tt);
        tt += 0.016;
        p *= 0.78;
        g.linearRampToValueAtTime(p, tt);
      }
      g.setTargetAtTime(0.0001, tt, decayTau);
    } else if (kind === "overrun") {
      // Overrun crackle: irregular micro-bursts riding the decay instead of one swell.
      let tt = t + attack;
      let p = peak;
      for (let k = 0; k < 4; k += 1) {
        tt += 0.02 + this.nextLegacyRand() * 0.05;
        g.linearRampToValueAtTime(p * 0.25, tt);
        tt += 0.008;
        p *= 0.72;
        g.linearRampToValueAtTime(p, tt);
      }
      g.setTargetAtTime(0.0001, tt, decayTau);
    } else {
      g.setTargetAtTime(0.0001, t + attack, decayTau);
    }
    this.diagnostics.transientCounts[kind] = (this.diagnostics.transientCounts[kind] ?? 0) + 1;
  }

  /* --------------------------------------------------------------- samples */

  private ensureSampleVoice(entry: CombustionSampleEntry): SampleVoice | null {
    if (!this.ctx || !this.sampleBus) return null;
    const buf = this.decodedSamples.get(entry.assetId);
    if (!buf) return null;
    const existing = this.sampleVoices.get(entry.assetId);
    if (existing) return existing;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    if (entry.loopSeconds) {
      src.loopStart = entry.loopSeconds.start;
      src.loopEnd = entry.loopSeconds.end;
    } else if (entry.loopStart != null && entry.loopEnd != null) {
      src.loopStart = entry.loopStart / buf.sampleRate;
      src.loopEnd = entry.loopEnd / buf.sampleRate;
    }
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    src.connect(gain);
    gain.connect(this.sampleBus);
    src.start(0, src.loopStart || 0);
    const voice = { src, gain, entryId: entry.assetId };
    this.sampleVoices.set(entry.assetId, voice);
    this.nodeEstimate += 2;
    return voice;
  }

  private updateSamples(rpm: number, demand: number, overrun: boolean, audioTime: number) {
    this.diagnostics.uncoveredOperatingRegions = reportAmericanV8SampleCoverage(
      this.sampleBank,
    ).uncovered;
    if (!this.sampleBank?.entries.length || !this.decodedSamples.size || !this.sampleBus) {
      if (this.sampleBus) targetParam(this.sampleBus.gain, 0.0001, audioTime, 0.1);
      this.diagnostics.sampleAssisted = false;
      this.diagnostics.activeSampleIds = [];
      if (!this.sampleBank?.entries.length) {
        this.diagnostics.sampleFallbackReason = "no-approved-assets";
      }
      return;
    }
    const load = loadRegionFromDemand(demand, overrun, rpm);
    const selection = selectSampleMix(this.sampleBank, rpm, load, demand);
    const activeIds = new Set(selection.targets.map((target) => target.entry.assetId));
    for (const [id, voice] of this.sampleVoices) {
      if (!activeIds.has(id)) targetParam(voice.gain.gain, 0.0001, audioTime, 0.09);
    }
    if (!selection.targets.length) {
      targetParam(this.sampleBus.gain, 0.0001, audioTime, 0.1);
      this.diagnostics.sampleAssisted = false;
      this.diagnostics.activeSampleIds = [];
      this.diagnostics.sampleFallbackReason = selection.fallbackReason;
      return;
    }
    let playable = 0;
    for (const target of selection.targets) {
      const voice = this.ensureSampleVoice(target.entry);
      if (!voice) continue;
      playable += 1;
      voice.src.playbackRate.setTargetAtTime(target.playbackRate, audioTime, 0.08);
      const trim = target.entry.gain ?? 0.85;
      const overlap = target.entry.overlapGain ?? 0.8;
      targetParam(voice.gain.gain, trim * overlap * target.weight * 0.55, audioTime, 0.1);
    }
    if (!playable) {
      targetParam(this.sampleBus.gain, 0.0001, audioTime, 0.1);
      this.diagnostics.sampleAssisted = false;
      this.diagnostics.activeSampleIds = [];
      this.diagnostics.sampleFallbackReason = "decode-failed";
      return;
    }
    // Samples assist under procedural - never fully replace excitation
    targetParam(
      this.sampleBus.gain,
      0.35 * (this.mutedRoles.has("combustion") ? 0.0001 : 1),
      audioTime,
      0.12,
    );
    if (this.combustionBus) {
      targetParam(
        this.combustionBus.gain,
        (this.diagnostics.combustionGain || 0.35) * 0.7,
        audioTime,
        0.12,
      );
    }
    this.diagnostics.sampleAssisted = true;
    this.diagnostics.sampleFallbackReason = "none";
    this.diagnostics.activeSampleIds = [...activeIds];
  }

  /* ----------------------------------------------------------- diagnostics */

  getDiagnostics(): HybridCombustionDiagnostics {
    return {
      ...this.diagnostics,
      transientCounts: { ...this.diagnostics.transientCounts },
      activeNodeEstimate: this.nodeEstimate,
    };
  }

  listLayers() {
    return [
      { id: "v2-combustion", role: "combustion" as const },
      { id: "v2-intake", role: "intake" as const },
      { id: "v2-body-resonance", role: "combustion" as const },
      { id: "v2-orders", role: "combustion" as const },
      { id: "v2-pipe", role: "exhaust" as const },
      { id: "v2-mechanical", role: "mechanical" as const },
      { id: "v2-overrun", role: "exhaust" as const },
      { id: "v2-transients", role: "event" as const },
      ...(this.turbo ? [{ id: "v2-turbo", role: "boost" as const }] : []),
      ...(this.diagnostics.sampleAssisted
        ? [{ id: "v2-samples", role: "combustion" as const }]
        : []),
    ].map((layer) => ({ ...layer, muted: this.mutedRoles.has(layer.role) }));
  }

  setRoleMuted(role: AudioLayerRole, muted: boolean) {
    if (muted) this.mutedRoles.add(role);
    else this.mutedRoles.delete(role);
  }

  setLayerMuted(id: string, muted: boolean) {
    const layer = this.listLayers().find((candidate) => candidate.id === id);
    if (layer) this.setRoleMuted(layer.role, muted);
  }

  setSolo(id: string | null) {
    const selected = id ? this.listLayers().find((candidate) => candidate.id === id)?.role : null;
    const roles = new Set(this.listLayers().map((layer) => layer.role));
    this.mutedRoles.clear();
    if (selected) {
      for (const role of roles) if (role !== selected) this.mutedRoles.add(role);
    }
  }

  dispose() {
    this.disposed = true;
    this.excitation?.dispose();
    this.excitation = null;
    const dropBand = (band: FormantBand) => {
      band.filter.disconnect();
      band.gain.disconnect();
    };
    this.exhaustFormants.forEach(dropBand);
    this.exhaustFormants = [];
    this.intakeFormants.forEach(dropBand);
    this.intakeFormants = [];
    this.bodyResonances.forEach(dropBand);
    this.bodyResonances = [];
    this.orderBands.forEach(dropBand);
    this.orderBands = [];
    this.spectralTilt?.disconnect();
    this.spectralTilt = null;
    this.pipeSend?.disconnect();
    this.pipeSend = null;
    this.pipe?.disconnect();
    this.pipe = null;
    const stopNoise = (src: AudioBufferSourceNode) => {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      src.disconnect();
    };
    if (this.mechanical) {
      stopNoise(this.mechanical.src);
      this.mechanical.filter.disconnect();
      this.mechanical.gain.disconnect();
      this.mechanical = null;
    }
    if (this.overrun) {
      stopNoise(this.overrun.src);
      this.overrun.filter.disconnect();
      this.overrun.gain.disconnect();
      this.overrun = null;
    }
    if (this.turbo) {
      stopNoise(this.turbo.src);
      this.turbo.filter.disconnect();
      this.turbo.gain.disconnect();
      this.turbo = null;
    }
    for (const voice of Object.values(this.voices)) {
      if (!voice) continue;
      stopNoise(voice.noise);
      voice.filter.disconnect();
      voice.gain.disconnect();
    }
    this.voices = {};
    for (const voice of this.sampleVoices.values()) {
      stopNoise(voice.src);
      voice.gain.disconnect();
    }
    this.sampleVoices.clear();
    this.decodedSamples.clear();
    this.combustionBus?.disconnect();
    this.intakeBus?.disconnect();
    this.supportBus?.disconnect();
    this.sampleBus?.disconnect();
    this.combustionBus = null;
    this.intakeBus = null;
    this.supportBus = null;
    this.sampleBus = null;
    this.cfg = null;
    this.experience = null;
    this.profile = null;
    this.drivetrain = null;
    this.pools = null;
    this.ctx = null;
    this.nodeEstimate = 0;
    this.lastUpdateTime = 0;
    this.lastGear = 0;
    this.lastShifting = false;
    this.lastShiftPhase = "idle";
    this.prevPowertrain = null;
    this.barkStart = 0;
    this.barkUntil = 0;
    this.barkAmount = 0;
    this.scheduler = createTransientSchedulerState();
    this.mutedRoles.clear();
  }
}

/**
 * Synthetic exhaust-pipe impulse: a few early reflections at pipe-length delays
 * (acoustic length ≈ 0.9-1.4 m, scaled by cylinder count / exhaust pulse) followed by
 * a short, dark, decorrelated noise tail. L and R get different micro-delays so the
 * mono excitation opens into a believable width without chorus artefacts.
 */
function buildPipeImpulse(ctx: BaseAudioContext, cfg: AcousticEngineConfig): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.round(PIPE_IR_SECONDS * rate));
  const buffer = ctx.createBuffer(2, length, rate);
  // Larger / louder exhausts read as longer tracts.
  const pipeMetres = 0.85 + cfg.exhaustPulse * 0.45 + Math.min(0.25, cfg.cylinders * 0.02);
  const roundTrip = (2 * pipeMetres) / 343;
  const darkness = 1 - cfg.bodyBrightness * 0.5;
  let seed = 0x9e3779b1 ^ cfg.cylinders;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed & 0xffff) / 0x10000;
  };
  for (let ch = 0; ch < 2; ch += 1) {
    const data = buffer.getChannelData(ch);
    const side = ch === 0 ? -1 : 1;
    // Direct path (kept low; the dry bus already carries it).
    data[0] = 0.18;
    const reflections = [
      { at: roundTrip * 0.5, amp: 0.5 },
      { at: roundTrip, amp: 0.36 },
      { at: roundTrip * 1.5, amp: 0.22 },
      { at: roundTrip * 2, amp: 0.14 },
      { at: roundTrip * 2.5, amp: 0.08 },
    ];
    for (const { at, amp } of reflections) {
      const offset = at + side * 0.00035 * (1 + rand() * 0.6);
      const idx = Math.round(offset * rate);
      if (idx > 0 && idx < length) data[idx] = (data[idx] ?? 0) + amp * (0.85 + rand() * 0.3);
    }
    // Dark diffuse tail - one-pole lowpassed noise with exponential decay.
    const tailTau = 0.012 + cfg.exhaustPulse * 0.008;
    let lp = 0;
    const lpCoef = 1 - Math.exp((-2 * Math.PI * (1600 * darkness + 400)) / rate);
    for (let i = 1; i < length; i += 1) {
      const t = i / rate;
      const white = rand() * 2 - 1;
      lp += (white - lp) * lpCoef;
      data[i] = (data[i] ?? 0) + lp * 0.22 * Math.exp(-t / tailTau);
    }
  }
  return buffer;
}
