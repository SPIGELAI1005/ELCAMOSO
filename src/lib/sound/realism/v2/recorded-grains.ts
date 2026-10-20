/**
 * Granular, de-looped player for recorded engine regions.
 * Two decorrelated streams per source; each grain picks a random region/offset that fits
 * the target RPM, is pitched from that region's own measured RPM, and gets slight pitch and
 * level jitter. Sine (equal-power) windows with 50 % overlap keep the level constant.
 * Scheduling runs on the main thread from update() with a short look-ahead.
 */
import {
  MAX_GRAIN_RATE,
  MIN_GRAIN_RATE,
  pickRegion,
  regionRpmAt,
  type RecordedSource,
} from "./recorded-loops";

interface Grain {
  src: AudioBufferSourceNode;
  gain: GainNode;
  baseRpm: number;
  jitter: number;
  end: number;
}

const LOOKAHEAD = 0.12;
const EDGE = 0.04;

function sineWindow(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i += 1) w[i] = Math.sin((Math.PI * i) / (n - 1));
  return w;
}

export class GranularStream {
  private next = 0;
  private grains: Grain[] = [];
  private rng: number;
  private readonly win = sineWindow(64);
  private readonly minRate: number;
  private readonly maxRate: number;
  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly buffer: AudioBuffer,
    private readonly source: RecordedSource,
    private readonly out: AudioNode,
    seed: number,
  ) {
    this.rng = seed >>> 0 || 1;
    this.minRate = source.minRate ?? MIN_GRAIN_RATE;
    this.maxRate = source.maxRate ?? MAX_GRAIN_RATE;
  }

  private rand(): number {
    let x = this.rng;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.rng = x >>> 0;
    return this.rng / 4294967296;
  }

  get activeCount(): number {
    return this.grains.length;
  }

  update(rpm: number, audioTime: number): void {
    // Retire finished grains; retune live ones toward the current RPM.
    this.grains = this.grains.filter((g) => {
      // Nodes disconnect themselves on "ended" (render-time safe for offline contexts).
      if (g.end <= audioTime) return false;
      const rate = Math.min(this.maxRate, Math.max(this.minRate, (rpm / g.baseRpm) * g.jitter));
      g.src.playbackRate.setTargetAtTime(rate, audioTime, 0.05);
      return true;
    });
    if (this.next < audioTime) this.next = audioTime;
    while (this.next < audioTime + LOOKAHEAD) {
      this.spawn(rpm, this.next);
    }
  }

  private spawn(rpm: number, at: number): void {
    const dur = 0.32 + this.rand() * 0.34;
    const region = pickRegion(
      this.source.regions,
      rpm,
      () => this.rand(),
      this.minRate,
      this.maxRate,
    );
    if (!region) {
      this.next = at + dur / 2;
      return;
    }
    const jitter = 1 + (this.rand() - 0.5) * 0.016; // ±0.8 % pitch
    const level = 10 ** (((this.rand() - 0.5) * 2) / 20); // ±1 dB
    const span = region.end - region.start - 2 * EDGE;
    const baseGuess = regionRpmAt(region, region.start + span / 2);
    const rate = Math.min(this.maxRate, Math.max(this.minRate, (rpm / baseGuess) * jitter));
    const srcLen = dur * rate;
    const room = Math.max(0, span - srcLen);
    const offset = region.start + EDGE + this.rand() * room;
    const baseRpm = regionRpmAt(region, offset + srcLen / 2);
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = Math.min(
      this.maxRate,
      Math.max(this.minRate, (rpm / baseRpm) * jitter),
    );
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    const curve = new Float32Array(this.win.length);
    for (let i = 0; i < curve.length; i += 1) curve[i] = this.win[i]! * level;
    gain.gain.setValueCurveAtTime(curve, at, dur);
    src.connect(gain);
    gain.connect(this.out);
    src.start(at, offset);
    src.stop(at + dur + 0.02);
    src.onended = () => {
      src.disconnect();
      gain.disconnect();
    };
    this.grains.push({ src, gain, baseRpm, jitter, end: at + dur + 0.03 });
    this.next = at + dur / 2;
  }

  dispose(): void {
    for (const g of this.grains) {
      try {
        g.src.stop();
      } catch {
        /* already stopped */
      }
      g.src.disconnect();
      g.gain.disconnect();
    }
    this.grains = [];
  }
}
