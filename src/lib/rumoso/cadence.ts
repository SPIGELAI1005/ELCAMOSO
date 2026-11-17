/**
 * Peak-detection step counter from DeviceMotion-style acceleration samples.
 * Uses linear acceleration when present; otherwise high-passes gravity out of
 * the raw magnitude. Output is a smoothed steps-per-minute value.
 */
export interface CadenceSample {
  /** Epoch or monotonic milliseconds. */
  tMs: number;
  ax: number;
  ay: number;
  az: number;
  /** True when ax/ay/az are already linear (gravity removed). */
  linear?: boolean;
}

export interface CadenceReading {
  rawSpm: number;
  smoothedSpm: number;
  stepCount: number;
  peaked: boolean;
}

const MIN_STEP_INTERVAL_MS = 280; // ~214 spm ceiling
const WINDOW_MS = 8_000;
const STALE_MS = 3_000;
const SMOOTH_TAU_S = 2.0;
const GRAVITY_TAU_S = 0.8;
const MAG_TAU_S = 0.05;
const DEFAULT_THRESHOLD = 1.35; // m/s² above baseline

function hypot3(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

function emaAlpha(dtS: number, tauS: number): number {
  if (dtS <= 0 || !Number.isFinite(dtS)) return 1;
  return 1 - Math.exp(-dtS / tauS);
}

export class CadenceDetector {
  private lastT: number | null = null;
  private baseline = 0;
  private hasBaseline = false;
  private filt = 0;
  private prevFilt = 0;
  private prevDelta = 0;
  private lastPeakMs = 0;
  private peakMagEma = DEFAULT_THRESHOLD;
  private stepTimes: number[] = [];
  private stepCount = 0;
  private smoothed = 0;
  private raw = 0;

  reset(): void {
    this.lastT = null;
    this.baseline = 0;
    this.hasBaseline = false;
    this.filt = 0;
    this.prevFilt = 0;
    this.prevDelta = 0;
    this.lastPeakMs = 0;
    this.peakMagEma = DEFAULT_THRESHOLD;
    this.stepTimes = [];
    this.stepCount = 0;
    this.smoothed = 0;
    this.raw = 0;
  }

  push(sample: CadenceSample): CadenceReading {
    const mag = hypot3(sample.ax, sample.ay, sample.az);
    const t = sample.tMs;
    const dtS = this.lastT == null ? 0 : Math.max(0, (t - this.lastT) / 1000);
    this.lastT = t;

    let dynamic: number;
    if (sample.linear) {
      dynamic = mag;
    } else {
      if (!this.hasBaseline) {
        this.baseline = mag;
        this.hasBaseline = true;
      } else {
        const a = emaAlpha(dtS, GRAVITY_TAU_S);
        this.baseline += (mag - this.baseline) * a;
      }
      dynamic = mag - this.baseline;
    }

    if (dtS > 0) {
      const a = emaAlpha(dtS, MAG_TAU_S);
      this.filt += (dynamic - this.filt) * a;
    } else {
      this.filt = dynamic;
    }

    const delta = this.filt - this.prevFilt;
    const threshold = Math.max(DEFAULT_THRESHOLD, 0.45 * this.peakMagEma);
    let peaked = false;
    if (
      this.prevDelta > 0 &&
      delta <= 0 &&
      this.prevFilt >= threshold &&
      t - this.lastPeakMs >= MIN_STEP_INTERVAL_MS
    ) {
      peaked = true;
      this.lastPeakMs = t;
      this.stepCount += 1;
      this.stepTimes.push(t);
      const aPeak = emaAlpha(Math.max(dtS, 0.3), 2.5);
      this.peakMagEma += (this.prevFilt - this.peakMagEma) * aPeak;
    }
    this.prevDelta = delta;
    this.prevFilt = this.filt;

    const cutoff = t - WINDOW_MS;
    while (this.stepTimes.length && this.stepTimes[0]! < cutoff) this.stepTimes.shift();

    if (this.stepTimes.length >= 2) {
      const first = this.stepTimes[0]!;
      const last = this.stepTimes[this.stepTimes.length - 1]!;
      const span = last - first;
      this.raw = span > 0 ? ((this.stepTimes.length - 1) / span) * 60_000 : 0;
    } else if (t - this.lastPeakMs > STALE_MS) {
      this.raw = 0;
    }

    const aS = emaAlpha(Math.max(dtS, 0.016), SMOOTH_TAU_S);
    this.smoothed += (this.raw - this.smoothed) * aS;
    if (this.smoothed < 0.5) this.smoothed = 0;

    return {
      rawSpm: this.raw,
      smoothedSpm: this.smoothed,
      stepCount: this.stepCount,
      peaked,
    };
  }
}
