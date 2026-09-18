import type { DriveState } from "@/lib/drive/model";
import { resolveDrivetrain, type ResolvedDrivetrain } from "@/lib/drive/drivetrain-resolve";
import type { VirtualPowertrainState } from "@/lib/powertrain/types";
import type { SoundProfile } from "@/lib/sound/profiles";
import { clamp } from "@/lib/sound/dsp/math";
import { createLoopingNoise } from "@/lib/sound/dsp/noise";
import { targetLayerGain, targetParam } from "@/lib/sound/dsp/smoother";
import {
  computeDynamicLayerWeights,
  fundamentalHzForLayer,
  transientLayerGainScale,
} from "@/lib/sound/dynamic-drive/layer-weights";
import {
  createTransientSchedulerState,
  tickTransientScheduler,
  type TransientSchedulerState,
} from "@/lib/sound/dynamic-drive/transient-scheduler";
import {
  DYNAMIC_LAYER_IDS,
  type DynamicLayerDebugInfo,
  type DynamicLayerId,
} from "@/lib/sound/dynamic-drive/types";
import type { StrategyBuses } from "@/lib/sound/realism/types";

const GAIN_TAU = 0.07;
const PITCH_TAU = 0.045;
const TRANSIENT_SUM_CAP = 0.72;

function capTransientWeights(weightMap: Record<string, number>, ids: DynamicLayerId[]) {
  const sum = ids.reduce((acc, id) => acc + (weightMap[id] ?? 0), 0);
  if (sum <= TRANSIENT_SUM_CAP) return;
  const scale = TRANSIENT_SUM_CAP / sum;
  for (const id of ids) {
    weightMap[id] = (weightMap[id] ?? 0) * scale;
  }
}

function safeDisconnect(node: AudioNode | null) {
  try {
    node?.disconnect();
  } catch {
    /* already disconnected */
  }
}

interface RpmBandLayer {
  id: DynamicLayerId;
  gain: GainNode;
  filter: BiquadFilterNode;
  voices: { osc: OscillatorNode; g: GainNode; ratio: number }[];
  lastGain: number;
  lastHz: number;
}

interface TransientLayer {
  id: DynamicLayerId;
  gain: GainNode;
  filter: BiquadFilterNode;
  noise: AudioBufferSourceNode;
  lastGain: number;
  lastHz: number;
  defaultFilterHz: number;
}

/**
 * Layered RPM crossfade synthesis for Dynamic Drive.
 * Each band owns harmonic voices with independent fundamental frequency -
 * not a single source with playbackRate.
 */
export class DynamicDriveSynth {
  private profile: SoundProfile | null = null;
  private drivetrain: ResolvedDrivetrain | null = null;
  private bands: RpmBandLayer[] = [];
  private transients: TransientLayer[] = [];
  private accentGain: GainNode | null = null;
  private disposed = false;
  private schedulerState: TransientSchedulerState = createTransientSchedulerState();
  private prevPowertrain: VirtualPowertrainState | null = null;
  private prevSpeedKmh = 0;

  build(ctx: BaseAudioContext, profile: SoundProfile, buses: StrategyBuses): boolean {
    this.dispose();
    this.profile = profile;
    this.drivetrain = resolveDrivetrain(profile);
    this.disposed = false;
    this.schedulerState = createTransientSchedulerState();
    this.prevPowertrain = null;
    this.prevSpeedKmh = 0;

    const bodyIn = buses.body;
    this.accentGain = ctx.createGain();
    this.accentGain.gain.value = 0.55;
    this.accentGain.connect(buses.accents);

    const bandIds: DynamicLayerId[] = ["dd-idle", "dd-low", "dd-mid", "dd-high", "dd-redline"];
    const ratios = profile.voice.harmonics.slice(0, 4);
    if (!ratios.length) ratios.push(1, 0.5, 0.33);

    for (const id of bandIds) {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = profile.voice.filterBase + profile.voice.filterRange * 0.35;
      filter.Q.value = profile.voice.filterQ ?? 1.1;

      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      filter.connect(gain);
      gain.connect(bodyIn);

      const voices = ratios.map((ratio, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = i === 0 ? profile.voice.wave : "sawtooth";
        osc.detune.value = (i % 2 === 0 ? 1 : -1) * profile.voice.detune * (i + 1);
        osc.frequency.value = profile.voice.baseFrequency * ratio;
        g.gain.value = (profile.voice.coreLevel ?? 1) / (i + 1.6);
        osc.connect(g);
        g.connect(filter);
        osc.start();
        return { osc, g, ratio };
      });

      this.bands.push({ id, gain, filter, voices, lastGain: 0, lastHz: 40 });
    }

    const loadBand = this.createHarmonicBand(ctx, "dd-high-load", bodyIn, profile, ratios, 1.15);
    this.bands.push(loadBand);

    this.transients.push(
      this.createTransient(ctx, "dd-upshift", bodyIn, "white", 900),
      this.createTransient(ctx, "dd-downshift", this.accentGain, "pink", 1200),
      this.createTransient(ctx, "dd-rev-match", this.accentGain, "pink", 1050),
      this.createTransient(ctx, "dd-overrun", this.accentGain, "brown", 650),
      this.createTransient(ctx, "dd-exhaust-pop", this.accentGain, "white", 520),
      this.createTransient(ctx, "dd-turbo-flutter", this.accentGain, "white", 1500),
      this.createTransient(ctx, "dd-wastegate", this.accentGain, "pink", 920),
      this.createTransient(ctx, "dd-drivetrain-thump", bodyIn, "brown", 180),
    );

    return true;
  }

  private createHarmonicBand(
    ctx: BaseAudioContext,
    id: DynamicLayerId,
    dest: AudioNode,
    profile: SoundProfile,
    ratios: number[],
    brightness: number,
  ): RpmBandLayer {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = profile.voice.filterBase + profile.voice.filterRange * brightness;
    filter.Q.value = (profile.voice.filterQ ?? 1.1) * 0.95;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    filter.connect(gain);
    gain.connect(dest);
    const voices = ratios.map((ratio, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = profile.voice.baseFrequency * ratio;
      g.gain.value = 0.55 / (i + 1.8);
      osc.connect(g);
      g.connect(filter);
      osc.start();
      return { osc, g, ratio };
    });
    return { id, gain, filter, voices, lastGain: 0, lastHz: 40 };
  }

  private createTransient(
    ctx: BaseAudioContext,
    id: DynamicLayerId,
    dest: AudioNode,
    color: "white" | "pink" | "brown",
    filterHz: number,
  ): TransientLayer {
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = filterHz;
    filter.Q.value = 0.85;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    const noise = createLoopingNoise(ctx, color);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start();
    return {
      id,
      gain,
      filter,
      noise,
      lastGain: 0,
      lastHz: filterHz / 60,
      defaultFilterHz: filterHz,
    };
  }

  update(state: DriveState, audioTime: number) {
    if (this.disposed || !this.profile || !this.drivetrain) return;
    const pt = state.powertrain;
    if (!pt) return;

    const nowMs = pt.timestamp > 0 ? pt.timestamp : Date.now();
    const speedKmh = state.speed * 3.6;
    const tick = tickTransientScheduler({
      pt,
      prevPt: this.prevPowertrain,
      drivetrain: this.drivetrain,
      speedKmh,
      prevSpeedKmh: this.prevSpeedKmh,
      state: this.schedulerState,
      nowMs,
    });
    this.schedulerState = tick.state;

    const weights = computeDynamicLayerWeights(pt, this.drivetrain, tick.output);
    const t = this.drivetrain.transient;
    const maxGain = t.maxLayerGain;
    const weightMap: Record<string, number> = {
      "dd-idle": weights.idle,
      "dd-low": weights.low,
      "dd-mid": weights.mid,
      "dd-high": weights.high,
      "dd-redline": weights.redline,
      "dd-high-load": weights.highLoad,
      "dd-upshift": weights.upshiftTransient,
      "dd-downshift": weights.downshiftTransient,
      "dd-rev-match": weights.revMatchTransient,
      "dd-overrun": weights.overrunTransient,
      "dd-exhaust-pop": weights.exhaustPopTransient,
      "dd-turbo-flutter": weights.turboFlutterTransient,
      "dd-wastegate": weights.wastegateTransient,
      "dd-drivetrain-thump": weights.drivetrainThumpTransient,
    };

    capTransientWeights(weightMap, [
      "dd-upshift",
      "dd-downshift",
      "dd-rev-match",
      "dd-overrun",
      "dd-exhaust-pop",
      "dd-turbo-flutter",
      "dd-wastegate",
      "dd-drivetrain-thump",
    ]);

    // Use controller phase load (torque cut → reengage), not progress-linear duck.
    const loadMul = pt.shifting ? (pt.shiftLoadMultiplier ?? 1) : 1;

    for (const band of this.bands) {
      const w = weightMap[band.id] ?? 0;
      const hz = fundamentalHzForLayer(band.id, pt, this.drivetrain);
      const level = clamp(w * loadMul * maxGain * (0.62 + pt.load * 0.38), 0, maxGain);
      targetLayerGain(band.gain.gain, level, audioTime, GAIN_TAU);
      const bright = 0.2 + pt.load * 0.55 + (band.id === "dd-redline" ? 0.25 : 0);
      targetParam(
        band.filter.frequency,
        this.profile.voice.filterBase + this.profile.voice.filterRange * bright,
        audioTime,
        0.1,
      );
      band.voices.forEach(({ osc, ratio }) => {
        targetParam(osc.frequency, hz * ratio, audioTime, PITCH_TAU);
      });
      band.lastGain = level;
      band.lastHz = hz;
    }

    for (const tr of this.transients) {
      const w = weightMap[tr.id] ?? 0;
      const hz = fundamentalHzForLayer(tr.id, pt, this.drivetrain);
      const scale = transientLayerGainScale(tr.id);
      const level = clamp(w * maxGain * scale, 0, maxGain * 0.65);
      targetLayerGain(tr.gain.gain, level, audioTime, GAIN_TAU * 0.85);
      const variantHz = tick.output.variants?.[tr.id]?.filterHz;
      const filterTarget = variantHz ?? clamp(hz * 12, tr.defaultFilterHz * 0.65, 2400);
      targetParam(tr.filter.frequency, filterTarget, audioTime, 0.08);
      tr.lastGain = level;
      tr.lastHz = hz;
    }

    this.prevPowertrain = { ...pt };
    this.prevSpeedKmh = speedKmh;
  }

  getDebugInfo(): DynamicLayerDebugInfo[] {
    if (!this.profile || !this.drivetrain) return [];
    const baseHz = this.profile.voice.baseFrequency;
    return DYNAMIC_LAYER_IDS.map((id) => {
      const band = this.bands.find((row) => row.id === id);
      const tr = this.transients.find((row) => row.id === id);
      const gain = band?.lastGain ?? tr?.lastGain ?? 0;
      const fundamentalHz = band?.lastHz ?? tr?.lastHz ?? baseHz;
      return {
        id,
        gain,
        fundamentalHz,
        playbackRate: clamp(fundamentalHz / baseHz, 0.2, 4.5),
      };
    });
  }

  listLayers(): { id: string; muted: boolean }[] {
    return DYNAMIC_LAYER_IDS.map((id) => ({ id, muted: false }));
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const band of this.bands) {
      band.voices.forEach(({ osc, g }) => {
        try {
          osc.stop();
        } catch {
          /* stopped */
        }
        safeDisconnect(osc);
        safeDisconnect(g);
      });
      safeDisconnect(band.filter);
      safeDisconnect(band.gain);
    }
    for (const tr of this.transients) {
      try {
        tr.noise.stop();
      } catch {
        /* stopped */
      }
      safeDisconnect(tr.noise);
      safeDisconnect(tr.filter);
      safeDisconnect(tr.gain);
    }
    safeDisconnect(this.accentGain);
    this.bands = [];
    this.transients = [];
    this.accentGain = null;
    this.profile = null;
    this.drivetrain = null;
    this.schedulerState = createTransientSchedulerState();
    this.prevPowertrain = null;
    this.prevSpeedKmh = 0;
  }
}
