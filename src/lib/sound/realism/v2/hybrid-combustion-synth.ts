/**
 * HybridCombustionSynth - Realism V2.1 combustion backend.
 * Continuous worklet excitation → formants / body resonance → restrained support.
 * Optional sample overlay. Powertrain V2/V3 is authoritative for RPM/load/shift phase.
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
  playbackRateForRpm,
  selectSampleNeighbors,
  type CombustionSampleBank,
  type CombustionSampleEntry,
} from "@/lib/sound/realism/v2/sample-bank";
import type { StrategyBuses } from "@/lib/sound/realism/types";
import type { SoundProfile } from "@/lib/sound/profiles";
import { resolvePersonalityId } from "@/lib/drive/drivetrain-resolve";
import type { ShiftPhase } from "@/lib/powertrain/types";

export type RealismEngineMode = "current" | "v2";

export interface HybridCombustionDiagnostics {
  realismEngine: "v2";
  excitationMode: "worklet" | "fallback" | "none";
  firingHz: number;
  cylinders: number;
  sampleAssisted: boolean;
  supportGain: number;
  combustionGain: number;
  formantGains: number[];
  shiftPhase: ShiftPhase | "idle";
  load: number;
  demand: number;
  /** Approximate graph size (reused nodes; not per-fire). */
  activeNodeEstimate: number;
  audioContextState: string;
}

function targetParam(param: AudioParam, value: number, t: number, tau: number) {
  param.setTargetAtTime(value, t, Math.max(0.01, tau));
}

interface FormantBand {
  filter: BiquadFilterNode;
  gain: GainNode;
}

interface SampleVoice {
  src: AudioBufferSourceNode;
  gain: GainNode;
  entryId: string;
}

/**
 * Drop-in orchestrator for combustion profiles under Realism V2.1.
 */
export class HybridCombustionSynth {
  private disposed = false;
  private cfg: AcousticEngineConfig | null = null;
  private profile: SoundProfile | null = null;
  private ctx: BaseAudioContext | null = null;
  private excitation: CombustionExcitationHandle | null = null;
  private exhaustFormants: FormantBand[] = [];
  private intakeFormants: FormantBand[] = [];
  private bodyResonances: FormantBand[] = [];
  private supportOsc: OscillatorNode[] = [];
  private supportGains: GainNode[] = [];
  private supportBus: GainNode | null = null;
  private combustionBus: GainNode | null = null;
  private intakeBus: GainNode | null = null;
  private spectralTilt: BiquadFilterNode | null = null;
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
  private shiftClick: { filter: BiquadFilterNode; gain: GainNode } | null = null;
  private sampleA: SampleVoice | null = null;
  private sampleB: SampleVoice | null = null;
  private sampleBus: GainNode | null = null;
  private sampleBank: CombustionSampleBank | null = null;
  private decodedSamples = new Map<string, AudioBuffer>();
  private lastShifting = false;
  private lastShiftPhase: ShiftPhase | "idle" = "idle";
  private lastOverrun = false;
  private priorLoad = 0;
  private liftArmed = false;
  private nodeEstimate = 0;
  private diagnostics: HybridCombustionDiagnostics = {
    realismEngine: "v2",
    excitationMode: "none",
    firingHz: 0,
    cylinders: 0,
    sampleAssisted: false,
    supportGain: 0,
    combustionGain: 0,
    formantGains: [],
    shiftPhase: "idle",
    load: 0,
    demand: 0,
    activeNodeEstimate: 0,
    audioContextState: "closed",
  };

  build(ctx: BaseAudioContext, profile: SoundProfile, buses: StrategyBuses): boolean {
    this.dispose();
    this.disposed = false;
    const cfg = acousticEngineForProfile(profile.id);
    if (!cfg) return false;
    this.cfg = cfg;
    this.profile = profile;
    this.ctx = ctx;

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

    // Supporting band-limited harmonics (triangle/sine - low-level only)
    cfg.supportRatios.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i === 0 ? "triangle" : "sine";
      osc.frequency.value = 40 * ratio;
      g.gain.value = (cfg.supportWeights[i] ?? 0.1) * 0.14;
      osc.connect(g);
      g.connect(this.supportBus!);
      osc.start();
      this.supportOsc.push(osc);
      this.supportGains.push(g);
      nodes += 2;
    });
    const supportLp = ctx.createBiquadFilter();
    supportLp.type = "lowpass";
    supportLp.frequency.value = 1400 + cfg.bodyBrightness * 900;
    supportLp.Q.value = 0.75;
    this.supportBus.connect(supportLp);
    supportLp.connect(buses.body);
    nodes += 1;

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

    {
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 380;
      filter.Q.value = 2.6;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      filter.connect(gain);
      gain.connect(buses.accents);
      this.shiftClick = { filter, gain };
      nodes += 2;
    }

    this.nodeEstimate = nodes;
    this.diagnostics.cylinders = cfg.cylinders;
    this.diagnostics.sampleAssisted = this.sampleBank.entries.length > 0;
    this.diagnostics.activeNodeEstimate = nodes;
    this.diagnostics.audioContextState =
      "state" in ctx ? String((ctx as AudioContext).state) : "offline";
    return true;
  }

  setDecodedSamples(map: Map<string, AudioBuffer>) {
    this.decodedSamples = map;
    this.diagnostics.sampleAssisted = map.size > 0 && (this.sampleBank?.entries.length ?? 0) > 0;
  }

  update(state: DriveState, audioTime: number) {
    if (this.disposed || !this.cfg || !this.excitation) return;
    const cfg = this.cfg;
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

    const firingHz = firingHzFromRpm(rpm, cfg.cylinders, cfg.stroke);
    this.diagnostics.firingHz = firingHz;
    this.diagnostics.shiftPhase = shiftPhase;
    this.diagnostics.load = load;
    this.diagnostics.demand = demand;

    const rpmNorm = Math.min(1, rpm / Math.max(1, cfg.redlineRpm));
    const idleGate = Math.max(0, 1 - rpmNorm * 2.2) * Math.max(0, 1 - demand * 2);
    const irregularity = cfg.idleIrregularity * idleGate * (overrun ? 0.35 : 1);

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

    const sharpness = Math.min(1, cfg.combustionSharpness * (0.55 + load * 0.55 + demand * 0.25));

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
      const tiltDb = -4 + load * 5.5 + demand * 2.5 * cfg.highLoadEnrichment;
      targetParam(this.spectralTilt.gain, tiltDb, audioTime, 0.07);
    }

    this.exhaustFormants.forEach((band, i) => {
      const base = 0.26 / (1 + i * 0.48);
      const loadLift = 0.45 + load * 0.85 + demand * 0.4;
      const enrich = 1 + (i > 1 ? load * cfg.highLoadEnrichment * 0.55 : 0);
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
      const excite = 0.12 + load * 0.35 + demand * 0.2;
      targetParam(band.gain.gain, (0.16 / (1 + i * 0.35)) * excite, audioTime, 0.08);
      // Keep centers nearly stationary
      const hz = cfg.bodyResonanceHz[i]! * (1 + rpmNorm * 0.015);
      targetParam(band.filter.frequency, hz, audioTime, 0.18);
    });

    this.intakeFormants.forEach((band, i) => {
      const base = (0.16 * cfg.intakePresence) / (1 + i * 0.42);
      let intake = demand * 0.9 + load * 0.35;
      if (shifting) {
        if (shiftPhase === "torque_cut" || shiftPhase === "disengage") intake *= 0.35;
        else if (pt?.shiftDirection === "down") intake *= 1.15;
      }
      if (overrun) intake *= 0.12;
      targetParam(band.gain.gain, base * (0.2 + intake), audioTime, 0.05);
      targetParam(band.filter.Q, 1.2 + demand * 0.5, audioTime, 0.1);
    });

    // Support harmonics stay subordinate; density rises with load
    const orderHz = Math.max(18, firingHz / Math.max(1, cfg.cylinders / 2));
    const fund = Math.max(
      22,
      Math.min(220, orderHz * (cfg.architecture.includes("v8") ? 0.48 : 0.52)),
    );
    this.supportOsc.forEach((osc, i) => {
      const ratio = cfg.supportRatios[i] ?? i + 1;
      targetParam(osc.frequency, fund * ratio, audioTime, 0.05);
      const w = cfg.supportWeights[i] ?? 0.1;
      const density = 0.28 + load * 0.55 + demand * 0.22;
      const upper = i >= 3 ? load * cfg.highLoadEnrichment : 1;
      const g = this.supportGains[i];
      if (g)
        targetParam(g.gain, w * 0.11 * density * upper * (shifting ? 0.65 : 1), audioTime, 0.06);
    });
    if (this.supportBus) {
      targetParam(this.supportBus.gain, 0.08 + load * 0.08, audioTime, 0.08);
    }
    if (this.combustionBus) {
      const body = 0.3 + load * 0.32 + demand * 0.14;
      const phaseMul =
        shiftPhase === "torque_cut" || shiftPhase === "disengage"
          ? 0.55
          : shiftPhase === "reengage"
            ? 0.9
            : 1;
      targetParam(this.combustionBus.gain, body * phaseMul * (overrun ? 0.65 : 1), audioTime, 0.06);
      this.diagnostics.combustionGain = body;
    }
    if (this.intakeBus) {
      targetParam(
        this.intakeBus.gain,
        (0.1 + demand * 0.38) * cfg.intakePresence * (overrun ? 0.12 : 1),
        audioTime,
        0.05,
      );
    }

    if (this.mechanical) {
      targetParam(
        this.mechanical.gain.gain,
        0.02 * cfg.mechanicalIntensity * (0.35 + rpmNorm + load * 0.55),
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

    // Overrun: requires prior load + lift - not random cruise pops
    if (this.overrun) {
      if (load > 0.4 && demand > 0.35) this.liftArmed = true;
      if (demand > 0.25) this.liftArmed = false;
      const on = overrun && rpm > 1200 && demand < 0.18 && this.priorLoad > 0.28;
      const level = on
        ? (0.045 + Math.min(0.07, (rpmNorm - 0.15) * 0.1)) * cfg.overrunCharacter
        : 0.0001;
      targetParam(this.overrun.gain.gain, level, audioTime, on ? 0.04 : 0.09);
      targetParam(this.overrun.filter.frequency, 460 + rpmNorm * 380, audioTime, 0.1);
      if (on && !this.lastOverrun && this.liftArmed && this.shiftClick) {
        this.fireResonantImpulse(audioTime, 0.1 * cfg.overrunCharacter, 680);
        this.liftArmed = false;
      }
    }
    this.lastOverrun = overrun;
    this.priorLoad = this.priorLoad * 0.92 + load * 0.08;

    if (this.turbo) {
      const boostWant =
        cfg.forcedInduction && demand > 0.32 && rpm > 1600
          ? Math.min(1, (demand - 0.18) * 0.95 + rpmNorm * 0.22)
          : 0;
      // Spool inertia ~0.5 s
      this.turbo.spool += (boostWant - this.turbo.spool) * Math.min(1, 0.016 / 0.5);
      const spool = this.turbo.spool;
      targetParam(this.turbo.gain.gain, spool > 0.05 ? spool * 0.075 : 0.0001, audioTime, 0.08);
      targetParam(this.turbo.filter.frequency, 1500 + spool * 1900 + rpmNorm * 500, audioTime, 0.1);
      if (overrun && spool > 0.5 && this.priorLoad > 0.4 && this.shiftClick && !this.lastOverrun) {
        this.fireResonantImpulse(audioTime, 0.08, 2300);
      }
    }

    // Shift: RPM/load carry the story; mechanical impulse only at reengage / start
    if (shifting && !this.lastShifting && this.shiftClick) {
      const freq = pt?.shiftDirection === "down" ? 500 : 320;
      this.fireResonantImpulse(audioTime, 0.1, freq);
    }
    if (
      shifting &&
      shiftPhase === "reengage" &&
      this.lastShiftPhase !== "reengage" &&
      this.shiftClick
    ) {
      this.fireResonantImpulse(audioTime, 0.12, pt?.shiftDirection === "down" ? 440 : 300);
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

  private fireResonantImpulse(t: number, peak: number, freq: number) {
    if (!this.shiftClick) return;
    const { filter, gain } = this.shiftClick;
    filter.frequency.setValueAtTime(freq, t);
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.007);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
  }

  private ensureSampleVoice(entry: CombustionSampleEntry, slot: "a" | "b"): SampleVoice | null {
    if (!this.ctx || !this.sampleBus) return null;
    const buf = this.decodedSamples.get(entry.assetId);
    if (!buf) return null;
    const existing = slot === "a" ? this.sampleA : this.sampleB;
    if (existing?.entryId === entry.assetId) return existing;
    if (existing) {
      try {
        existing.src.stop();
      } catch {
        /* */
      }
      existing.src.disconnect();
      existing.gain.disconnect();
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    if (entry.loopStart != null && entry.loopEnd != null) {
      src.loopStart = entry.loopStart / buf.sampleRate;
      src.loopEnd = entry.loopEnd / buf.sampleRate;
    }
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    src.connect(gain);
    gain.connect(this.sampleBus);
    src.start();
    const voice = { src, gain, entryId: entry.assetId };
    if (slot === "a") this.sampleA = voice;
    else this.sampleB = voice;
    this.nodeEstimate += 2;
    return voice;
  }

  private updateSamples(rpm: number, demand: number, overrun: boolean, audioTime: number) {
    if (!this.sampleBank?.entries.length || !this.decodedSamples.size || !this.sampleBus) {
      if (this.sampleBus) targetParam(this.sampleBus.gain, 0.0001, audioTime, 0.1);
      return;
    }
    const load = loadRegionFromDemand(demand, overrun);
    const { a, b, blend } = selectSampleNeighbors(this.sampleBank, rpm, load);
    if (!a) return;

    const voiceA = this.ensureSampleVoice(a, "a");
    const voiceB = b ? this.ensureSampleVoice(b, "b") : null;
    if (!voiceA) return;

    const rateA = playbackRateForRpm(rpm, a.rpmRef);
    voiceA.src.playbackRate.setTargetAtTime(rateA, audioTime, 0.08);
    const trimA = a.gain ?? 0.85;
    if (voiceB && b) {
      const rateB = playbackRateForRpm(rpm, b.rpmRef);
      voiceB.src.playbackRate.setTargetAtTime(rateB, audioTime, 0.08);
      const trimB = b.gain ?? 0.85;
      targetParam(voiceA.gain.gain, trimA * (1 - blend) * 0.55, audioTime, 0.1);
      targetParam(voiceB.gain.gain, trimB * blend * 0.55, audioTime, 0.1);
    } else {
      targetParam(voiceA.gain.gain, trimA * 0.55, audioTime, 0.1);
      if (this.sampleB) targetParam(this.sampleB.gain.gain, 0.0001, audioTime, 0.1);
    }
    // Samples assist under procedural - never fully replace excitation
    targetParam(this.sampleBus.gain, 0.35, audioTime, 0.12);
    if (this.combustionBus) {
      targetParam(
        this.combustionBus.gain,
        (this.diagnostics.combustionGain || 0.35) * 0.7,
        audioTime,
        0.12,
      );
    }
    this.diagnostics.sampleAssisted = true;
  }

  getDiagnostics(): HybridCombustionDiagnostics {
    return { ...this.diagnostics, activeNodeEstimate: this.nodeEstimate };
  }

  listLayers() {
    return [
      { id: "v2-combustion", muted: false },
      { id: "v2-intake", muted: false },
      { id: "v2-body-resonance", muted: false },
      { id: "v2-support", muted: false },
      { id: "v2-mechanical", muted: false },
      { id: "v2-overrun", muted: false },
      ...(this.turbo ? [{ id: "v2-turbo", muted: false }] : []),
      ...(this.diagnostics.sampleAssisted ? [{ id: "v2-samples", muted: false }] : []),
    ];
  }

  dispose() {
    this.disposed = true;
    this.excitation?.dispose();
    this.excitation = null;
    this.supportOsc.forEach((o) => {
      try {
        o.stop();
      } catch {
        /* */
      }
      o.disconnect();
    });
    this.supportOsc = [];
    this.supportGains.forEach((g) => g.disconnect());
    this.supportGains = [];
    this.exhaustFormants.forEach((f) => {
      f.filter.disconnect();
      f.gain.disconnect();
    });
    this.exhaustFormants = [];
    this.intakeFormants.forEach((f) => {
      f.filter.disconnect();
      f.gain.disconnect();
    });
    this.intakeFormants = [];
    this.bodyResonances.forEach((f) => {
      f.filter.disconnect();
      f.gain.disconnect();
    });
    this.bodyResonances = [];
    this.spectralTilt?.disconnect();
    this.spectralTilt = null;
    if (this.mechanical) {
      try {
        this.mechanical.src.stop();
      } catch {
        /* */
      }
      this.mechanical.src.disconnect();
      this.mechanical.filter.disconnect();
      this.mechanical.gain.disconnect();
      this.mechanical = null;
    }
    if (this.overrun) {
      try {
        this.overrun.src.stop();
      } catch {
        /* */
      }
      this.overrun.src.disconnect();
      this.overrun.filter.disconnect();
      this.overrun.gain.disconnect();
      this.overrun = null;
    }
    if (this.turbo) {
      try {
        this.turbo.src.stop();
      } catch {
        /* */
      }
      this.turbo.src.disconnect();
      this.turbo.filter.disconnect();
      this.turbo.gain.disconnect();
      this.turbo = null;
    }
    if (this.shiftClick) {
      this.shiftClick.filter.disconnect();
      this.shiftClick.gain.disconnect();
      this.shiftClick = null;
    }
    for (const voice of [this.sampleA, this.sampleB]) {
      if (!voice) continue;
      try {
        voice.src.stop();
      } catch {
        /* */
      }
      voice.src.disconnect();
      voice.gain.disconnect();
    }
    this.sampleA = null;
    this.sampleB = null;
    this.combustionBus?.disconnect();
    this.intakeBus?.disconnect();
    this.supportBus?.disconnect();
    this.sampleBus?.disconnect();
    this.combustionBus = null;
    this.intakeBus = null;
    this.supportBus = null;
    this.sampleBus = null;
    this.cfg = null;
    this.profile = null;
    this.ctx = null;
    this.nodeEstimate = 0;
  }
}
