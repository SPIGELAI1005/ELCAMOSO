import {
  PEAK_PROTECT_LOOKAHEAD_MS,
  SAMPLE_PEAK_CEILING_LINEAR,
} from "@/lib/sound/gain-staging/constants";

/**
 * Soft ceiling at the declared sample-peak target.
 * Not a certified true-peak limiter; no lookahead (see PEAK_PROTECT_LOOKAHEAD_MS).
 * Prefer this over treating DynamicsCompressorNode as a brickwall.
 */
export function makeSamplePeakCeilingCurve(
  ceiling = SAMPLE_PEAK_CEILING_LINEAR,
  samples = 4096,
): Float32Array {
  const curve = new Float32Array(samples);
  const c = Math.max(0.1, Math.min(1, ceiling));
  // Soft knee starts ~90% of ceiling so ordinary peaks stay linear.
  const kneeStart = c * 0.9;
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / (samples - 1) - 1;
    const ax = Math.abs(x);
    let y: number;
    if (ax <= kneeStart) {
      y = x;
    } else if (ax >= c) {
      y = Math.sign(x) * c;
    } else {
      const t = (ax - kneeStart) / (c - kneeStart);
      const shaped = kneeStart + (c - kneeStart) * (1 - (1 - t) * (1 - t));
      y = Math.sign(x) * shaped;
    }
    curve[i] = y;
  }
  return curve;
}

export interface PeakProtectStage {
  input: GainNode;
  output: WaveShaperNode;
  /** Documented lookahead (ms); WaveShaper path is 0. */
  lookaheadMs: number;
  ceilingLinear: number;
  dispose: () => void;
}

export function createPeakProtectStage(
  ctx: BaseAudioContext,
  destination: AudioNode,
): PeakProtectStage {
  const input = ctx.createGain();
  input.gain.value = 1;
  const shaper = ctx.createWaveShaper();
  shaper.curve = makeSamplePeakCeilingCurve() as Float32Array<ArrayBuffer>;
  // 2x oversample reduces aliasing from the knee; still not true-peak certified.
  shaper.oversample = "2x";
  input.connect(shaper);
  shaper.connect(destination);
  return {
    input,
    output: shaper,
    lookaheadMs: PEAK_PROTECT_LOOKAHEAD_MS,
    ceilingLinear: SAMPLE_PEAK_CEILING_LINEAR,
    dispose() {
      try {
        input.disconnect();
        shaper.disconnect();
      } catch {
        /* already torn down */
      }
    },
  };
}
