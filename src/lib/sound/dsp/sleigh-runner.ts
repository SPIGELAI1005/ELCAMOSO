/**
 * Santa Christmas Sleigh: the runners sliding over packed snow. Replaces the carriage's wheels.
 *
 * A soft, band-limited swish (own seeded noise, no recording) that follows speed: silent when
 * parked, rising gently with speed, its band opening a little as the sleigh goes faster, and a
 * slow sway (the sleigh rocking from side to side) so it never sits as a steady hiss.
 * Everything above ~3.4 kHz is cut, so it stays a muffled "shhh" rather than white noise.
 */
import type { DriveState } from "@/lib/drive/model";
import { bellRandom } from "@/lib/sound/dsp/sleigh-bells-overlay";

/** Below this speed (km/h, GPS jitter) the runners are silent. */
export const RUNNER_START_KMH = 1.5;
/** Full runner level from this speed on. */
export const RUNNER_FULL_KMH = 45;
export const RUNNER_LEVEL = 0.11;
export const RUNNER_LOWPASS_HZ = 3400;
export const RUNNER_BAND_LOW_HZ = 700;
export const RUNNER_BAND_HIGH_HZ = 1500;

export interface SleighRunner {
  update(state: DriveState, t: number): void;
  dispose(): void;
  diagnostics(): { connected: boolean; target: number };
}

/** Runner gain target vs speed (0 parked .. 1 at RUNNER_FULL_KMH), eased in. */
export function runnerAmount(kmh: number): number {
  if (kmh <= RUNNER_START_KMH) return 0;
  const u = Math.min(1, (kmh - RUNNER_START_KMH) / (RUNNER_FULL_KMH - RUNNER_START_KMH));
  return Math.sqrt(u);
}

/** Band centre (Hz) vs speed. */
export function runnerBandHz(kmh: number): number {
  const u = Math.min(1, Math.max(0, kmh / 90));
  return RUNNER_BAND_LOW_HZ + (RUNNER_BAND_HIGH_HZ - RUNNER_BAND_LOW_HZ) * u;
}

/** 3 s of soft brown-pink noise with a little granular crunch, seamless at the loop point. */
function runnerNoise(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * 3);
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  const rnd = bellRandom(0x51ed);
  let b0 = 0;
  let b1 = 0;
  for (let i = 0; i < n; i++) {
    const w = rnd() * 2 - 1;
    b0 = 0.995 * b0 + 0.05 * w; // brown-ish body
    b1 = 0.6 * b1 + 0.4 * w; // softened white
    // sparse snow crunch: occasional tiny grains
    const grain = rnd() < 0.004 ? (rnd() * 2 - 1) * 0.8 : 0;
    d[i] = b0 * 1.2 + b1 * 0.35 + grain;
  }
  // equal-power crossfade of the last 0.25 s into the start so the loop has no click
  const x = Math.floor(sr * 0.25);
  for (let i = 0; i < x; i++) {
    const a = Math.sin((Math.PI / 2) * (i / x));
    d[i] = d[i]! * a + d[n - x + i]! * Math.cos((Math.PI / 2) * (i / x));
  }
  let peak = 0;
  for (let i = 0; i < n - x; i++) peak = Math.max(peak, Math.abs(d[i]!));
  const out = ctx.createBuffer(1, n - x, sr);
  const o = out.getChannelData(0);
  for (let i = 0; i < n - x; i++) o[i] = d[i]! / (peak || 1);
  return out;
}

export function createSleighRunner(
  ctx: BaseAudioContext,
  destination: AudioNode,
  level = RUNNER_LEVEL,
): SleighRunner {
  const src = ctx.createBufferSource();
  src.buffer = runnerNoise(ctx);
  src.loop = true;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 180;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = RUNNER_BAND_LOW_HZ;
  band.Q.value = 0.6;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = RUNNER_LOWPASS_HZ;
  lp.Q.value = 0.5;
  const sway = ctx.createGain();
  sway.gain.value = 1;
  const out = ctx.createGain();
  out.gain.value = 0;
  // slow sway: 0.45 Hz, +-25 % around unity
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.45;
  const lfoAmt = ctx.createGain();
  lfoAmt.gain.value = 0.25;
  lfo.connect(lfoAmt);
  lfoAmt.connect(sway.gain);
  src.connect(hp);
  hp.connect(band);
  band.connect(lp);
  lp.connect(sway);
  sway.connect(out);
  out.connect(destination);
  const t0 = ctx.currentTime;
  src.start(t0);
  lfo.start(t0);
  let disposed = false;
  let connected = true;
  let target = 0;
  return {
    update(state, t) {
      if (disposed) return;
      const kmh = Math.max(0, state.speed || 0) * 3.6;
      target = level * runnerAmount(kmh);
      out.gain.setTargetAtTime(target, t, 0.25);
      band.frequency.setTargetAtTime(runnerBandHz(kmh), t, 0.4);
      lfo.frequency.setTargetAtTime(0.35 + 0.25 * Math.min(1, kmh / 60), t, 1);
    },
    diagnostics: () => ({ connected: connected && !disposed, target }),
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        const t = ctx.currentTime;
        out.gain.setTargetAtTime(0, t, 0.05);
        src.stop(t + 0.3);
        lfo.stop(t + 0.3);
      } catch {
        /* closed context */
      }
      setTimeout(() => {
        out.disconnect();
        connected = false;
      }, 400);
    },
  };
}
