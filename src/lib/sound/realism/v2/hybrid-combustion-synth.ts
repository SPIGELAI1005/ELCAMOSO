/**
 * HybridCombustionSynth — Realism V2 combustion backend.
 * Procedural (worklet excitation + formants + support harmonics) with optional sample overlay.
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
} from "@/lib/sound/realism/v2/sample-bank";
import type { StrategyBuses } from "@/lib/sound/realism/types";
import type { SoundProfile } from "@/lib/sound/profiles";
import { resolvePersonalityId } from "@/lib/drive/drivetrain-resolve";

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
}

function targetParam(param: AudioParam, value: number, t: number, tau: number) {
  param.setTargetAtTime(value, t, Math.max(0.01, tau));
}

interface FormantBand {
  filter: BiquadFilterNode;
  gain: GainNode;
}

/**
 * Drop-in orchestrator for combustion profiles under Realism V2.
 * Connects to existing body / accents / beds buses.
 */
export class HybridCombustionSynth {
  private disposed = false;
  private cfg: AcousticEngineConfig | null = null;
  private profile: SoundProfile | null = null;
  private excitation: CombustionExcitationHandle | null = null;
  private exhaustFormants: FormantBand[] = [];
  private intakeFormants: FormantBand[] = [];
  private supportOsc: OscillatorNode[] = [];
  private supportGains: GainNode[] = [];
  private supportBus: GainNode | null = null;
  private combustionBus: GainNode | null = null;
  private intakeBus: GainNode | null = null;
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
  private samplePlayers: {
    src: AudioBufferSourceNode;
    gain: GainNode;
    entryId: string;
  }[] = [];
  private sampleBank: CombustionSampleBank | null = null;
  private decodedSamples = new Map<string, AudioBuffer>();
  private lastShifting = false;
  private lastOverrun = false;
  private diagnostics: HybridCombustionDiagnostics = {
    realismEngine: "v2",
    excitationMode: "none",
    firingHz: 0,
    cylinders: 0,
    sampleAssisted: false,
    supportGain: 0,
    combustionGain: 0,
    formantGains: [],
  };

  build(ctx: BaseAudioContext, profile: SoundProfile, buses: StrategyBuses): boolean {
    this.dispose();
    this.disposed = false;
    const cfg = acousticEngineForProfile(profile.id);
    if (!cfg) return false;
    this.cfg = cfg;
    this.profile = profile;

    const personalityId = resolvePersonalityId(profile);
    this.sampleBank = EMPTY_COMBUSTION_SAMPLE_BANKS[personalityId] ?? {
      personalityId,
      entries: [],
    };

    this.combustionBus = ctx.createGain();
    this.combustionBus.gain.value = 0.42;
    this.intakeBus = ctx.createGain();
    this.intakeBus.gain.value = 0.28;
    this.supportBus = ctx.createGain();
    this.supportBus.gain.value = 0.18;

    this.excitation = createCombustionExcitation(ctx);
    this.diagnostics.excitationMode = this.excitation.mode;

    // Exhaust formants — semi-stationary resonances excited by combustion
    this.exhaustFormants = cfg.exhaustFormantsHz.map((hz, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = i === 0 ? "lowpass" : "bandpass";
      filter.frequency.value = hz;
      filter.Q.value = i === 0 ? 0.7 : 1.1;
      const gain = ctx.createGain();
      gain.gain.value = 0.35 / (1 + i * 0.55);
      this.excitation!.node.connect(filter);
      filter.connect(gain);
      gain.connect(this.combustionBus!);
      return { filter, gain };
    });

    // Intake formants
    this.intakeFormants = cfg.intakeFormantsHz.map((hz, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = hz;
      filter.Q.value = 1.4;
      const gain = ctx.createGain();
      gain.gain.value = (0.22 * cfg.intakePresence) / (1 + i * 0.5);
      this.excitation!.node.connect(filter);
      filter.connect(gain);
      gain.connect(this.intakeBus!);
      return { filter, gain };
    });

    // Supporting band-limited harmonics (triangle/sine — not sawtooth stack)
    cfg.supportRatios.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i === 0 ? "triangle" : i < 3 ? "sine" : "triangle";
      osc.frequency.value = 40 * ratio;
      g.gain.value = (cfg.supportWeights[i] ?? 0.1) * 0.22;
      osc.connect(g);
      g.connect(this.supportBus!);
      osc.start();
      this.supportOsc.push(osc);
      this.supportGains.push(g);
    });
    const supportLp = ctx.createBiquadFilter();
    supportLp.type = "lowpass";
    supportLp.frequency.value = 1800 + cfg.bodyBrightness * 1200;
    supportLp.Q.value = 0.8;
    this.supportBus.connect(supportLp);
    supportLp.connect(buses.body);

    this.combustionBus.connect(buses.body);
    this.intakeBus.connect(buses.beds);

    // Mechanical / valvetrain — restrained brown through bandpass
    {
      const src = ctx.createBufferSource();
      src.buffer = getNoiseBuffer(ctx, "brown");
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1400 + cfg.mechanicalIntensity * 800;
      filter.Q.value = 1.2;
      const gain = ctx.createGain();
      gain.gain.value = 0.04 * cfg.mechanicalIntensity;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(buses.accents);
      src.start();
      this.mechanical = { src, filter, gain };
    }

    // Overrun path — quiet until lift
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
    }

    // Shift mechanical impulse bus (resonant, not white burst)
    {
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 380;
      filter.Q.value = 2.4;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      filter.connect(gain);
      gain.connect(buses.accents);
      this.shiftClick = { filter, gain };
    }

    this.diagnostics.cylinders = cfg.cylinders;
    this.diagnostics.sampleAssisted = this.sampleBank.entries.length > 0;
    return true;
  }

  /** Optional: inject decoded sample buffers keyed by assetId. */
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
    const shiftProgress = pt?.shiftProgress ?? 0;
    const revMatch = Boolean(pt?.revMatchActive);

    const firingHz = firingHzFromRpm(rpm, cfg.cylinders, cfg.stroke);
    this.diagnostics.firingHz = firingHz;

    const rpmNorm = Math.min(1, rpm / Math.max(1, this.profile ? 7000 : 6500));
    // Idle irregularity fades as RPM/load rise
    const idleGate = Math.max(0, 1 - rpmNorm * 2.2) * Math.max(0, 1 - demand * 2);
    const irregularity = cfg.idleIrregularity * idleGate * (overrun ? 0.4 : 1);

    // Intensity: combustion energy grows with load at fixed RPM
    let intensity = 0.22 + demand * 0.38 + load * 0.28 + rpmNorm * 0.18 * (0.5 + demand * 0.5);
    if (shifting) {
      // Torque cut / re-engage shaped by shift progress
      const dip =
        shiftProgress < 0.45 ? 1 - shiftProgress * 1.4 : 0.35 + (shiftProgress - 0.45) * 1.1;
      intensity *= Math.max(0.2, Math.min(1, dip));
    }
    if (revMatch) intensity = Math.min(1, intensity + 0.25 * (pt?.revMatchProgress ?? 0.5));

    this.excitation.setParams({
      firingHz,
      intensity: Math.min(1, intensity * cfg.exhaustPulse),
      irregularity,
      load,
      audioTime,
    });

    // Formant gains track load (timbre change, not just loudness)
    this.exhaustFormants.forEach((band, i) => {
      const base = 0.28 / (1 + i * 0.5);
      const loadLift = 0.55 + load * 0.7 + demand * 0.35;
      const dark = 1 - cfg.bodyBrightness * 0.25;
      targetParam(band.gain.gain, base * loadLift * dark * cfg.exhaustPulse, audioTime, 0.06);
      // Keep formants mostly stationary; slight RPM drift only on upper bands
      if (i > 0) {
        const hz = cfg.exhaustFormantsHz[i]! * (1 + rpmNorm * 0.04 * i);
        targetParam(band.filter.frequency, hz, audioTime, 0.12);
      }
    });

    this.intakeFormants.forEach((band, i) => {
      const base = (0.18 * cfg.intakePresence) / (1 + i * 0.45);
      const intake =
        demand * 0.85 + load * 0.4 + (shifting && pt?.shiftDirection === "down" ? 0.2 : 0);
      targetParam(band.gain.gain, base * (0.25 + intake), audioTime, 0.05);
    });

    // Support harmonics follow engine order (firing-related fundamental approximation)
    const orderHz = Math.max(18, firingHz / Math.max(1, cfg.cylinders / 2));
    const fund = Math.max(
      22,
      Math.min(220, orderHz * (cfg.architecture.includes("v8") ? 0.5 : 0.55)),
    );
    this.supportOsc.forEach((osc, i) => {
      const ratio = cfg.supportRatios[i] ?? i + 1;
      targetParam(osc.frequency, fund * ratio, audioTime, 0.05);
      const w = cfg.supportWeights[i] ?? 0.1;
      const bright = 0.35 + load * 0.55 + demand * 0.25;
      const g = this.supportGains[i];
      if (g) targetParam(g.gain, w * 0.16 * bright * (shifting ? 0.7 : 1), audioTime, 0.06);
    });
    if (this.supportBus) {
      targetParam(this.supportBus.gain, 0.14 + load * 0.1, audioTime, 0.08);
    }
    if (this.combustionBus) {
      const body = 0.32 + load * 0.28 + demand * 0.12;
      targetParam(this.combustionBus.gain, body * (overrun ? 0.7 : 1), audioTime, 0.07);
      this.diagnostics.combustionGain = body;
    }
    if (this.intakeBus) {
      targetParam(
        this.intakeBus.gain,
        (0.12 + demand * 0.35) * cfg.intakePresence * (overrun ? 0.15 : 1),
        audioTime,
        0.05,
      );
    }

    if (this.mechanical) {
      targetParam(
        this.mechanical.gain.gain,
        0.025 * cfg.mechanicalIntensity * (0.4 + rpmNorm + load * 0.5),
        audioTime,
        0.08,
      );
      targetParam(
        this.mechanical.filter.frequency,
        1100 + rpmNorm * 1600 + cfg.mechanicalIntensity * 400,
        audioTime,
        0.1,
      );
    }

    if (this.overrun) {
      const on = overrun && rpm > 1200 && demand < 0.2;
      const level = on ? 0.06 + Math.min(0.08, (rpmNorm - 0.2) * 0.12) : 0.0001;
      targetParam(this.overrun.gain.gain, level, audioTime, on ? 0.04 : 0.08);
      targetParam(this.overrun.filter.frequency, 480 + rpmNorm * 400, audioTime, 0.1);
      // Edge into overrun after load — contextual, not free-running pops
      if (on && !this.lastOverrun && load > 0.35 && this.shiftClick) {
        this.fireResonantImpulse(audioTime, 0.12, 720);
      }
    }
    this.lastOverrun = overrun;

    if (this.turbo) {
      const boostWant =
        cfg.forcedInduction && demand > 0.35 && rpm > 1800
          ? Math.min(1, (demand - 0.2) * 0.9 + rpmNorm * 0.25)
          : 0;
      this.turbo.spool += (boostWant - this.turbo.spool) * Math.min(1, 0.016 / 0.45);
      const spool = this.turbo.spool;
      targetParam(this.turbo.gain.gain, spool > 0.05 ? spool * 0.07 : 0.0001, audioTime, 0.08);
      targetParam(this.turbo.filter.frequency, 1600 + spool * 1800 + rpmNorm * 600, audioTime, 0.1);
      // Flutter on strong lift after boost
      if (this.lastOverrun === false && overrun && spool > 0.45 && this.shiftClick) {
        this.fireResonantImpulse(audioTime, 0.09, 2400);
      }
    }

    // Shift engagement: resonant impulse at shift edges, RPM/load carry the story
    if (shifting && !this.lastShifting && this.shiftClick) {
      const freq = pt?.shiftDirection === "down" ? 520 : 340;
      this.fireResonantImpulse(audioTime, 0.14, freq);
    }
    this.lastShifting = shifting;

    this.updateSamples(rpm, demand, overrun, audioTime);

    this.diagnostics.supportGain = this.supportBus?.gain.value ?? 0;
    this.diagnostics.formantGains = this.exhaustFormants.map((f) => f.gain.gain.value);
  }

  private fireResonantImpulse(t: number, peak: number, freq: number) {
    if (!this.shiftClick) return;
    const { filter, gain } = this.shiftClick;
    filter.frequency.setValueAtTime(freq, t);
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  }

  private updateSamples(rpm: number, demand: number, overrun: boolean, audioTime: number) {
    // Sample path is dormant until assets are registered & decoded.
    if (!this.sampleBank || !this.sampleBank.entries.length || !this.decodedSamples.size) return;
    const load = loadRegionFromDemand(demand, overrun);
    const { a, b, blend } = selectSampleNeighbors(this.sampleBank, rpm, load);
    void a;
    void b;
    void blend;
    void playbackRateForRpm;
    void audioTime;
    // Full dual-player crossfade lands when buffers exist; procedural layer stays under.
  }

  getDiagnostics(): HybridCombustionDiagnostics {
    return { ...this.diagnostics };
  }

  listLayers() {
    return [
      { id: "v2-combustion", muted: false },
      { id: "v2-intake", muted: false },
      { id: "v2-support", muted: false },
      { id: "v2-mechanical", muted: false },
      { id: "v2-overrun", muted: false },
      ...(this.turbo ? [{ id: "v2-turbo", muted: false }] : []),
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
    for (const bus of [this.combustionBus, this.intakeBus, this.supportBus]) {
      bus?.disconnect();
    }
    this.combustionBus = null;
    this.intakeBus = null;
    this.supportBus = null;
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
    this.samplePlayers.forEach((p) => {
      try {
        p.src.stop();
      } catch {
        /* */
      }
      p.src.disconnect();
      p.gain.disconnect();
    });
    this.samplePlayers = [];
    this.cfg = null;
    this.profile = null;
  }
}
