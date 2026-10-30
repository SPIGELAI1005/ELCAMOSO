/** Stereo hall impulse: early reflections + exponentially decaying, darkening noise tail. */
export function hallImpulseData(sampleRate: number, seconds: number, seed = 11): [Float32Array, Float32Array] {
  const n = Math.floor(sampleRate * seconds);
  const out: [Float32Array, Float32Array] = [new Float32Array(n), new Float32Array(n)];
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  const pre = Math.floor(0.022 * sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = out[ch]!;
    let lp = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sampleRate;
      const amp = Math.exp((-6.9 * t) / seconds);
      const k = 0.55 - 0.4 * Math.min(1, t / seconds); // darker as it decays
      lp += k * (rnd() - lp);
      d[i] = lp * amp * 0.5;
    }
    for (const [ms, g] of [[11, 0.5], [19, 0.35], [31, 0.28], [43, 0.2]] as const) {
      const at = Math.floor(((ms + ch * 3) / 1000) * sampleRate);
      if (at < n) d[at]! += g * 0.6;
    }
  }
  return out;
}
