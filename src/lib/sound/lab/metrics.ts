/**
 * Lab signal metrics. Peak/RMS/crest are sample-domain. Integrated loudness is
 * approximate BS.1770-style and is never labeled as certified LUFS or true peak.
 */

export const LAB_BANDS_HZ = [
  [20, 60],
  [60, 150],
  [150, 400],
  [400, 1500],
  [1500, 4000],
  [4000, 12000],
] as const;

export interface LabBandEnergy {
  lowHz: number;
  highHz: number;
  /** RMS of one-pole band approximation, dBFS relative to full-scale. */
  rmsDbfs: number;
  /** Relative to full-mix RMS (dB). */
  relativeToMixDb: number;
}

export interface LabSignalMetrics {
  samplePeak: number;
  samplePeakDbfs: number;
  rms: number;
  rmsDbfs: number;
  crestFactorDb: number;
  dcOffset: number;
  nanCount: number;
  infinityCount: number;
  clippedSamples: number;
  /** Approximate integrated loudness (BS.1770-style K-weighting + gating). Not certified LUFS. */
  approximateIntegratedLoudness: number;
  spectralCentroidHz: number;
  bandEnergy: LabBandEnergy[];
  /** Honest label for consumers / reports. */
  loudnessLabel: "approximate-integrated-loudness-not-certified-lufs";
  truePeakLabel: "not-measured-sample-peak-only";
}

function db(value: number) {
  return value > 0 ? 20 * Math.log10(value) : -120;
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

/** Approximate BS.1770 integrated loudness at the given sample rate. */
export function approximateIntegratedLoudness(channels: Float32Array[], sampleRate: number) {
  const weighted = channels.map((channel) => {
    const shelf = biquad(
      channel,
      [1.53512485958697, -2.69169618940638, 1.19839281085285],
      [1, -1.69065929318241, 0.73248077421585],
    );
    return biquad(shelf, [1, -2, 1], [1, -1.99004745483398, 0.99007225036621]);
  });
  const block = Math.round(sampleRate * 0.4);
  const hop = Math.max(1, Math.round(block * 0.25));
  const energies: number[] = [];
  const length = weighted[0]?.length ?? 0;
  for (let start = 0; start + block <= length; start += hop) {
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

function monoMix(channels: Float32Array[]) {
  const length = channels[0]?.length ?? 0;
  const mono = new Float32Array(length);
  const n = Math.max(1, channels.length);
  for (let i = 0; i < length; i += 1) {
    let sum = 0;
    for (const channel of channels) sum += channel[i] ?? 0;
    mono[i] = sum / n;
  }
  return mono;
}

function bandRms(mono: Float32Array, sampleRate: number, lowHz: number, highHz: number) {
  const nyquist = sampleRate / 2;
  const hi = Math.min(highHz, nyquist);
  if (hi <= lowHz) return 0;
  const lowAlpha = lowHz > 0 ? 1 - Math.exp((-2 * Math.PI * lowHz) / sampleRate) : 0;
  const highAlpha = 1 - Math.exp((-2 * Math.PI * hi) / sampleRate);
  let lowState = 0;
  let highState = 0;
  let energy = 0;
  for (let i = 0; i < mono.length; i += 1) {
    const sample = mono[i] ?? 0;
    if (lowHz > 0) lowState += lowAlpha * (sample - lowState);
    highState += highAlpha * (sample - highState);
    const band = highState - (lowHz > 0 ? lowState : 0);
    energy += band * band;
  }
  return Math.sqrt(energy / Math.max(1, mono.length));
}

/**
 * Spectral centroid via short DFT windows on mono. Windowed FFT not required —
 * uses hop of overlapping rectangular DFT blocks for lab diagnostics.
 */
export function spectralCentroidHz(mono: Float32Array, sampleRate: number) {
  const size = 2048;
  if (mono.length < size) return 0;
  let weighted = 0;
  let total = 0;
  const hop = size;
  for (let start = 0; start + size <= mono.length; start += hop) {
    for (let k = 1; k < size / 2; k += 1) {
      let re = 0;
      let im = 0;
      const w = (2 * Math.PI * k) / size;
      for (let n = 0; n < size; n += 1) {
        const x = mono[start + n] ?? 0;
        re += x * Math.cos(w * n);
        im -= x * Math.sin(w * n);
      }
      const mag = Math.hypot(re, im);
      const hz = (k * sampleRate) / size;
      weighted += mag * hz;
      total += mag;
    }
  }
  return total > 0 ? weighted / total : 0;
}

export function analyseLabSignal(
  channels: Float32Array[],
  sampleRate: number,
): LabSignalMetrics {
  let peak = 0;
  let sum = 0;
  let count = 0;
  let dcSum = 0;
  let nanCount = 0;
  let infinityCount = 0;
  let clippedSamples = 0;

  for (const channel of channels) {
    for (let i = 0; i < channel.length; i += 1) {
      const sample = channel[i] ?? 0;
      if (!Number.isFinite(sample)) {
        if (Number.isNaN(sample)) nanCount += 1;
        else infinityCount += 1;
        continue;
      }
      peak = Math.max(peak, Math.abs(sample));
      sum += sample * sample;
      dcSum += sample;
      count += 1;
      if (Math.abs(sample) >= 0.999) clippedSamples += 1;
    }
  }

  const rms = Math.sqrt(sum / Math.max(1, count));
  const dcOffset = dcSum / Math.max(1, count);
  const mono = monoMix(channels);
  const nyquist = sampleRate / 2;
  const bandEnergy = LAB_BANDS_HZ.filter(([, high]) => high <= nyquist + 1e-6).map(
    ([lowHz, highHz]) => {
      const band = bandRms(mono, sampleRate, lowHz, highHz);
      return {
        lowHz,
        highHz,
        rmsDbfs: db(band),
        relativeToMixDb: db(band) - db(rms),
      };
    },
  );

  return {
    samplePeak: peak,
    samplePeakDbfs: db(peak),
    rms,
    rmsDbfs: db(rms),
    crestFactorDb: db(peak) - db(rms),
    dcOffset,
    nanCount,
    infinityCount,
    clippedSamples,
    approximateIntegratedLoudness: approximateIntegratedLoudness(channels, sampleRate),
    spectralCentroidHz: spectralCentroidHz(mono, sampleRate),
    bandEnergy,
    loudnessLabel: "approximate-integrated-loudness-not-certified-lufs",
    truePeakLabel: "not-measured-sample-peak-only",
  };
}

/** Magnitude spectrum for UI (first channel / mono), dB vs frequency bins. */
export function magnitudeSpectrumDb(
  mono: Float32Array,
  sampleRate: number,
  fftSize = 2048,
): { hz: number; db: number }[] {
  const size = Math.min(fftSize, mono.length);
  if (size < 16) return [];
  const start = Math.max(0, Math.floor((mono.length - size) / 2));
  const points: { hz: number; db: number }[] = [];
  for (let k = 1; k < size / 2; k += 1) {
    let re = 0;
    let im = 0;
    const w = (2 * Math.PI * k) / size;
    for (let n = 0; n < size; n += 1) {
      const x = mono[start + n] ?? 0;
      re += x * Math.cos(w * n);
      im -= x * Math.sin(w * n);
    }
    points.push({ hz: (k * sampleRate) / size, db: db(Math.hypot(re, im) / size) });
  }
  return points;
}
