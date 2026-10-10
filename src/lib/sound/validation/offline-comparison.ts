import type { DriveState } from "@/lib/drive/model";
import { resolvePersonalityId } from "@/lib/drive/drivetrain-resolve";
import { PowertrainSimulator } from "@/lib/powertrain/simulator";
import type { ShiftPhase } from "@/lib/powertrain/types";
import { SoundEngine } from "@/lib/sound/engine";
import { getProfile } from "@/lib/sound/profiles";

export type ComparisonVariant = "existing" | "tuned";

export interface OfflineRenderStats {
  peakDbfs: number;
  rmsDbfs: number;
  crestDb: number;
  approximateIntegratedLufs: number;
  clippedSamples: number;
  monoCancellationDb: number;
  cruiseToHardAccelerationDb: number;
  largestSampleStep: number;
  cruiseP99SampleStep: number;
  cruiseLargestSampleStep: number;
  bandEnergyDbRelative: {
    subBassBelow80Hz: number;
    lowMid80To500Hz: number;
    mid500To2500Hz: number;
    highAbove2500Hz: number;
  };
  /** Pearson correlation of L/R over the cruise window (1 = mono, ~0.6-0.9 = natural width). */
  cruiseStereoCorrelation: number;
  /** Seconds at which the powertrain started a gear change during the replay. */
  shiftStartSeconds: number[];
  /**
   * Mean RMS lift (dB) of the 180 ms after each shift start vs the 300 ms before it.
   * Positive values mean the shift is audible as an event rather than a dip only.
   */
  meanShiftEventLiftDb: number | null;
  /**
   * Mean of the loudest 20 ms slice (dB) inside the 250 ms after each shift start vs
   * the 300 ms bed before it. Captures the thump / bark even when the torque cut
   * lowers the average level of the window.
   */
  meanShiftPeakLiftDb: number | null;
}

export interface OfflineComparisonRender {
  profileId: string;
  variant: ComparisonVariant;
  sampleRate: number;
  durationSeconds: number;
  wavBase64: string;
  stats: OfflineRenderStats;
  backend: string;
  excitationMode: string | null;
  activeNodeEstimate: number | null;
  renderElapsedMs: number;
  /** Realism V2 transient bookkeeping, when that backend rendered. */
  v2?: {
    transientTier: "core" | "full";
    spaceMode: "pipe-ir" | "dry";
    eventCounts: { shift: number; overrun: number; boostRelease: number };
    transientCounts: Record<string, number>;
  };
}

const SAMPLE_RATE = 48_000;
const DURATION_SECONDS = 16.5;
const STEP_SECONDS = 1 / 60;

interface ReplayInput {
  speedKmh: number;
  accelerationMs2: number;
  throttle: number;
  braking: number;
}

function lerp(a: number, b: number, amount: number) {
  return a + (b - a) * Math.max(0, Math.min(1, amount));
}

/** Identical manual input trace for every renderer and profile. */
export function comparisonReplayInput(seconds: number): ReplayInput {
  if (seconds < 1) return { speedKmh: 0, accelerationMs2: 0, throttle: 0.04, braking: 0 };
  if (seconds < 3) {
    const p = (seconds - 1) / 2;
    return { speedKmh: lerp(0, 18, p), accelerationMs2: 2.5, throttle: 0.36, braking: 0 };
  }
  if (seconds < 5) {
    const p = (seconds - 3) / 2;
    return { speedKmh: lerp(18, 50, p), accelerationMs2: 4.45, throttle: 0.96, braking: 0 };
  }
  if (seconds < 7) return { speedKmh: 50, accelerationMs2: 0, throttle: 0.24, braking: 0 };
  if (seconds < 8) {
    const p = seconds - 7;
    return { speedKmh: lerp(50, 45, p), accelerationMs2: -1.4, throttle: 0.02, braking: 0 };
  }
  if (seconds < 9) {
    const p = seconds - 8;
    return { speedKmh: lerp(45, 30, p), accelerationMs2: -4.2, throttle: 0, braking: 0.72 };
  }
  if (seconds < 11) {
    const p = (seconds - 9) / 2;
    return { speedKmh: lerp(30, 65, p), accelerationMs2: 4.86, throttle: 0.92, braking: 0 };
  }
  if (seconds < 12.5) return { speedKmh: 65, accelerationMs2: 0, throttle: 0.25, braking: 0 };
  if (seconds < 16) {
    const p = (seconds - 12.5) / 3.5;
    return { speedKmh: lerp(65, 0, p), accelerationMs2: -5.16, throttle: 0, braking: 0.78 };
  }
  return { speedKmh: 0, accelerationMs2: 0, throttle: 0, braking: 0 };
}

function driveStateFromInput(
  input: ReplayInput,
  timestamp: number,
  simulator: PowertrainSimulator,
): DriveState {
  const pt = simulator.tick(
    {
      timestamp,
      speedKmh: input.speedKmh,
      accelerationMs2: input.accelerationMs2,
      accelerationFiltered: input.accelerationMs2,
      decelerationMs2: Math.max(0, -input.accelerationMs2),
      inferredThrottle: input.throttle,
      motionConfidence: 1,
      primarySource: "simulator",
      sourceHealth: { phone: false, browser: false, vehicleTelemetry: true },
      fallbackTier: "vehicle-telemetry",
      transitioning: false,
    },
    STEP_SECONDS,
    { directThrottle: input.throttle, braking: input.braking, pedalPosition: input.throttle },
  );
  return {
    speed: input.speedKmh / 3.6,
    acceleration: input.accelerationMs2,
    throttle: pt.driverDemand,
    regen: input.braking,
    rpm: pt.rpm,
    gear: pt.gear,
    load: pt.engineLoad,
    timestamp,
    jerk: 0,
    isShifting: pt.shifting,
    powertrain: pt,
    powertrainBackend: "dynamic",
    speedNormalized: Math.min(1, input.speedKmh / 160),
    accelerationNormalized: Math.min(1, Math.abs(input.accelerationMs2) / 4.5),
  };
}

function db(value: number) {
  return value > 0 ? 20 * Math.log10(value) : -120;
}

function segmentRms(channels: Float32Array[], start: number, end: number) {
  let sum = 0;
  let count = 0;
  for (const channel of channels) {
    for (let i = start; i < end; i += 1) {
      const sample = channel[i] ?? 0;
      sum += sample * sample;
      count += 1;
    }
  }
  return Math.sqrt(sum / Math.max(1, count));
}

function biquad(input: Float32Array, b: number[], a: number[]) {
  const output = new Float32Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < input.length; i += 1) {
    const x = input[i] ?? 0;
    const y = b[0]! * x + b[1]! * x1 + b[2]! * x2 - a[1]! * y1 - a[2]! * y2;
    output[i] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  return output;
}

/** BS.1770 K-weighting + gated integration at 48 kHz; reported as approximate, not certified. */
function approximateIntegratedLufs(channels: Float32Array[]) {
  const weighted = channels.map((channel) => {
    const shelf = biquad(
      channel,
      [1.53512485958697, -2.69169618940638, 1.19839281085285],
      [1, -1.69065929318241, 0.73248077421585],
    );
    return biquad(shelf, [1, -2, 1], [1, -1.99004745483398, 0.99007225036621]);
  });
  const block = Math.round(SAMPLE_RATE * 0.4);
  const hop = Math.round(block * 0.25);
  const energies: number[] = [];
  for (let start = 0; start + block <= weighted[0]!.length; start += hop) {
    let energy = 0;
    for (const channel of weighted) {
      for (let i = start; i < start + block; i += 1) energy += (channel[i] ?? 0) ** 2;
    }
    energies.push(energy / block);
  }
  const loudness = (energy: number) => -0.691 + 10 * Math.log10(Math.max(1e-12, energy));
  const absolute = energies.filter((energy) => loudness(energy) >= -70);
  if (!absolute.length) return -120;
  const absoluteMean = absolute.reduce((sum, value) => sum + value, 0) / absolute.length;
  const relativeGate = loudness(absoluteMean) - 10;
  const relative = absolute.filter((energy) => loudness(energy) >= relativeGate);
  return loudness(relative.reduce((sum, value) => sum + value, 0) / relative.length);
}

function pearson(a: Float32Array, b: Float32Array, start: number, end: number) {
  let sa = 0;
  let sb = 0;
  let n = 0;
  for (let i = start; i < end; i += 1) {
    sa += a[i] ?? 0;
    sb += b[i] ?? 0;
    n += 1;
  }
  const ma = sa / Math.max(1, n);
  const mb = sb / Math.max(1, n);
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = start; i < end; i += 1) {
    const da = (a[i] ?? 0) - ma;
    const dbb = (b[i] ?? 0) - mb;
    cov += da * dbb;
    va += da * da;
    vb += dbb * dbb;
  }
  const denom = Math.sqrt(va * vb);
  return denom > 0 ? cov / denom : 1;
}

function shiftEventLiftDb(channels: Float32Array[], shiftStartSeconds: number[]): number | null {
  if (!shiftStartSeconds.length) return null;
  const lifts = shiftStartSeconds.map((at) => {
    const idx = Math.round(at * SAMPLE_RATE);
    const before = segmentRms(channels, Math.max(0, idx - Math.round(0.3 * SAMPLE_RATE)), idx);
    const after = segmentRms(
      channels,
      idx,
      Math.min(channels[0]!.length, idx + Math.round(0.18 * SAMPLE_RATE)),
    );
    return db(after) - db(before);
  });
  return lifts.reduce((sum, v) => sum + v, 0) / lifts.length;
}

function shiftPeakLiftDb(channels: Float32Array[], shiftStartSeconds: number[]): number | null {
  if (!shiftStartSeconds.length) return null;
  const slice = Math.round(0.02 * SAMPLE_RATE);
  const lifts = shiftStartSeconds.map((at) => {
    const idx = Math.round(at * SAMPLE_RATE);
    const before = segmentRms(channels, Math.max(0, idx - Math.round(0.3 * SAMPLE_RATE)), idx);
    const end = Math.min(channels[0]!.length, idx + Math.round(0.25 * SAMPLE_RATE));
    let loudest = 0;
    for (let start = idx; start + slice <= end; start += slice) {
      loudest = Math.max(loudest, segmentRms(channels, start, start + slice));
    }
    return db(loudest) - db(before);
  });
  return lifts.reduce((sum, v) => sum + v, 0) / lifts.length;
}

function analyse(channels: Float32Array[], shiftStartSeconds: number[] = []): OfflineRenderStats {
  let peak = 0;
  let sum = 0;
  let count = 0;
  let clippedSamples = 0;
  let largestSampleStep = 0;
  const cruiseSteps: number[] = [];
  const cruiseStart = Math.round(5.2 * SAMPLE_RATE);
  const cruiseEnd = Math.round(6.8 * SAMPLE_RATE);
  for (const channel of channels) {
    let previous = channel[0] ?? 0;
    for (let i = 0; i < channel.length; i += 1) {
      const sample = channel[i] ?? 0;
      peak = Math.max(peak, Math.abs(sample));
      sum += sample * sample;
      count += 1;
      if (Math.abs(sample) >= 0.999) clippedSamples += 1;
      const step = Math.abs(sample - previous);
      largestSampleStep = Math.max(largestSampleStep, step);
      if (i >= cruiseStart && i < cruiseEnd) cruiseSteps.push(step);
      previous = sample;
    }
  }
  cruiseSteps.sort((a, b) => a - b);
  const rms = Math.sqrt(sum / Math.max(1, count));
  const mono = new Float32Array(channels[0]!.length);
  for (let i = 0; i < mono.length; i += 1) mono[i] = ((channels[0]![i] ?? 0) + (channels[1]![i] ?? 0)) * 0.5;
  const monoRms = segmentRms([mono], 0, mono.length);
  const bandEnergy = (lowHz: number, highHz: number) => {
    const lowAlpha = lowHz > 0 ? 1 - Math.exp((-2 * Math.PI * lowHz) / SAMPLE_RATE) : 0;
    const highAlpha = highHz > 0 ? 1 - Math.exp((-2 * Math.PI * highHz) / SAMPLE_RATE) : 1;
    let lowState = 0;
    let highState = 0;
    let energy = 0;
    for (let i = 0; i < mono.length; i += 1) {
      const sample = mono[i] ?? 0;
      if (lowHz > 0) lowState += lowAlpha * (sample - lowState);
      highState += highAlpha * (sample - highState);
      const band = highHz > 0 ? highState - (lowHz > 0 ? lowState : 0) : sample - lowState;
      energy += band * band;
    }
    return Math.sqrt(energy / Math.max(1, mono.length));
  };
  const cruiseRms = segmentRms(channels, cruiseStart, cruiseEnd);
  const hardRms = segmentRms(channels, Math.round(3.2 * SAMPLE_RATE), Math.round(4.8 * SAMPLE_RATE));
  return {
    peakDbfs: db(peak),
    rmsDbfs: db(rms),
    crestDb: db(peak) - db(rms),
    approximateIntegratedLufs: approximateIntegratedLufs(channels),
    clippedSamples,
    monoCancellationDb: db(monoRms) - db(rms),
    cruiseToHardAccelerationDb: db(hardRms) - db(cruiseRms),
    largestSampleStep,
    cruiseP99SampleStep: cruiseSteps[Math.floor(cruiseSteps.length * 0.99)] ?? 0,
    cruiseLargestSampleStep: cruiseSteps.at(-1) ?? 0,
    bandEnergyDbRelative: {
      subBassBelow80Hz: db(bandEnergy(0, 80)) - db(rms),
      lowMid80To500Hz: db(bandEnergy(80, 500)) - db(rms),
      mid500To2500Hz: db(bandEnergy(500, 2500)) - db(rms),
      highAbove2500Hz: db(bandEnergy(2500, 0)) - db(rms),
    },
    cruiseStereoCorrelation: pearson(channels[0]!, channels[1]!, cruiseStart, cruiseEnd),
    shiftStartSeconds,
    meanShiftEventLiftDb: shiftEventLiftDb(channels, shiftStartSeconds),
    meanShiftPeakLiftDb: shiftPeakLiftDb(channels, shiftStartSeconds),
  };
}

function encodeWav(channels: Float32Array[], sampleRate: number) {
  const frameCount = channels[0]!.length;
  const bytes = new Uint8Array(44 + frameCount * channels.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels.length * 2, true);
  view.setUint16(32, channels.length * 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, frameCount * channels.length * 2, true);
  let offset = 44;
  for (let i = 0; i < frameCount; i += 1) {
    for (const channel of channels) {
      const sample = Math.max(-1, Math.min(1, channel[i] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
      offset += 2;
    }
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + chunk)));
  }
  return btoa(binary);
}

export async function renderOfflineComparison(
  profileId: string,
  variant: ComparisonVariant,
): Promise<OfflineComparisonRender> {
  const started = performance.now();
  const profile = getProfile(profileId);
  const context = new OfflineAudioContext(2, SAMPLE_RATE * DURATION_SECONDS, SAMPLE_RATE);
  const engine = new SoundEngine();
  engine.setExperienceTuningEnabled(variant === "tuned");
  if (profileId === "electric-hypercar") {
    engine.setSynthesisMode(variant === "existing" ? "original" : "improved");
  } else {
    engine.setSynthesisMode("improved");
    engine.setRealismEngine(variant === "existing" ? "current" : "v2");
  }
  engine.setVolume(0.7);
  await engine.start(profile, { context, signature: false, seed: 0x454c4341 });
  const simulator = new PowertrainSimulator({ profileId: resolvePersonalityId(profile) });
  const shiftStartSeconds: number[] = [];
  let wasShifting = false;
  for (let time = 0; time < DURATION_SECONDS; time += STEP_SECONDS) {
    engine.setRenderTime(time);
    const state = driveStateFromInput(comparisonReplayInput(time), Math.round(time * 1000), simulator);
    if (state.isShifting && !wasShifting) shiftStartSeconds.push(Number(time.toFixed(3)));
    wasShifting = state.isShifting;
    engine.update(state);
  }
  const backend = engine.getActiveBackend();
  const hybrid = engine.getHybridCombustionDiagnostics();
  const rendered = await context.startRendering();
  const channels = [rendered.getChannelData(0).slice(), rendered.getChannelData(1).slice()];
  return {
    profileId,
    variant,
    sampleRate: SAMPLE_RATE,
    durationSeconds: DURATION_SECONDS,
    wavBase64: encodeWav(channels, SAMPLE_RATE),
    stats: analyse(channels, shiftStartSeconds),
    backend,
    excitationMode: hybrid?.excitationMode ?? null,
    activeNodeEstimate: hybrid?.activeNodeEstimate ?? null,
    renderElapsedMs: performance.now() - started,
    ...(hybrid
      ? {
          v2: {
            transientTier: hybrid.transientTier,
            spaceMode: hybrid.spaceMode,
            eventCounts: hybrid.eventCounts,
            transientCounts: Object.fromEntries(
              Object.entries(hybrid.transientCounts).map(([k, v]) => [k, v ?? 0]),
            ),
          },
        }
      : {}),
  };
}

export const COMPARISON_REPLAY_SEGMENTS = [
  { label: "start / idle", start: 0, end: 1 },
  { label: "gentle pull-away", start: 1, end: 3 },
  { label: "sustained acceleration / shifts", start: 3, end: 5 },
  { label: "steady cruise", start: 5, end: 7 },
  { label: "lift-off / overrun", start: 7, end: 8 },
  { label: "braking / regen", start: 8, end: 9 },
  { label: "renewed acceleration / shifts", start: 9, end: 11 },
  { label: "cruise", start: 11, end: 12.5 },
  { label: "return to stop", start: 12.5, end: 16 },
  { label: "stopped", start: 16, end: 16.5 },
] as const;

export type { ShiftPhase };
