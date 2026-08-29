/** Soft saturation curves for pressure-like density without hard clipping. */

export function makeSoftClipCurve(amount = 0.4, samples = 2048): Float32Array {
  const curve = new Float32Array(samples);
  const k = Math.max(0.01, amount) * 2.4;
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / (samples - 1) - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

export function createDriveShaper(ctx: BaseAudioContext, amount = 0.35): WaveShaperNode {
  const shaper = ctx.createWaveShaper();
  shaper.curve = makeSoftClipCurve(amount) as Float32Array<ArrayBuffer>;
  shaper.oversample = "2x";
  return shaper;
}
