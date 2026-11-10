import { createLoopingNoise } from "@/lib/sound/dsp/noise";
import { ROAD_LOUDNESS_TAU_SECONDS } from "@/lib/sound/road-cabin";

export interface CalmCabinBed {
  output: GainNode;
  start: () => void;
  setLevel: (linear: number, time: number, tau?: number) => void;
  dispose: () => void;
}

/**
 * Soft low-frequency procedural bed (brown + a little pink, 40–250 Hz).
 * No asset files; reuses cached long noise buffers.
 */
export function createCalmCabinBed(ctx: BaseAudioContext, destination: AudioNode): CalmCabinBed {
  const brown = createLoopingNoise(ctx, "brown", 1, 11);
  const pink = createLoopingNoise(ctx, "pink", 1, 11);
  const brownGain = ctx.createGain();
  brownGain.gain.value = 0.7;
  const pinkGain = ctx.createGain();
  pinkGain.gain.value = 0.3;
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 40;
  highpass.Q.value = 0.7;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 250;
  lowpass.Q.value = 0.7;
  const output = ctx.createGain();
  output.gain.value = 0.00001;

  brown.connect(brownGain);
  pink.connect(pinkGain);
  brownGain.connect(highpass);
  pinkGain.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(output);
  output.connect(destination);

  let started = false;

  return {
    output,
    start() {
      if (started) return;
      started = true;
      try {
        brown.start();
        pink.start();
      } catch {
        /* already started or context closed */
      }
    },
    setLevel(linear, time, tau = ROAD_LOUDNESS_TAU_SECONDS) {
      const v = Number.isFinite(linear) ? Math.max(0, linear) : 0;
      const safeTau = Math.max(0.005, tau);
      if (v <= 1e-5) output.gain.setTargetAtTime(0.00001, time, safeTau);
      else output.gain.setTargetAtTime(v, time, safeTau);
    },
    dispose() {
      try {
        brown.stop();
        pink.stop();
      } catch {
        /* not started or already stopped */
      }
      for (const node of [brown, pink, brownGain, pinkGain, highpass, lowpass, output]) {
        try {
          node.disconnect();
        } catch {
          /* already torn down */
        }
      }
    },
  };
}
