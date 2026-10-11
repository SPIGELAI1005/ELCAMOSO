import { createDriveShaper } from "@/lib/sound/dsp/waveshaper";
import { clamp } from "@/lib/sound/dsp/math";
import { MASTER_BUS_OUTPUT_GAIN } from "@/lib/sound/perceptual-volume";

/**
 * Profile bus → gentle saturation → EQ → light program compressor → user-volume stage.
 * Prompt 08: this is EQ/body shaping before user volume / boost / peak protect.
 * Do not treat the program compressor as a brickwall limiter (see gain-staging/peak-protect).
 */
export interface MasterBus {
  input: GainNode;
  output: GainNode;
  setPresence: (amount: number, t: number) => void;
  getCompressorReductionDb: () => number;
  dispose: () => void;
}

/**
 * Very gentle program control so shift/combustion transients are not flattened.
 * Peak safety is the dedicated peak-protect stage (−1 dBFS sample ceiling).
 */
export const MASTER_COMPRESSOR = {
  thresholdDb: -14,
  kneeDb: 8,
  ratio: 1.45,
  attackSeconds: 0.028,
  releaseSeconds: 0.32,
} as const;

export function createMasterBus(ctx: BaseAudioContext, destination: AudioNode): MasterBus {
  const input = ctx.createGain();
  input.gain.value = 1;

  const drive = createDriveShaper(ctx, 0.28);

  const low = ctx.createBiquadFilter();
  low.type = "lowshelf";
  low.frequency.value = 110;
  low.gain.value = -1.2;

  const presence = ctx.createBiquadFilter();
  presence.type = "peaking";
  // ~1.2 kHz helps phone speakers / cabin carry body without harsh HF.
  presence.frequency.value = 1200;
  presence.Q.value = 0.75;
  presence.gain.value = 0.4;

  const air = ctx.createBiquadFilter();
  air.type = "highshelf";
  air.frequency.value = 5500;
  air.gain.value = -1.8;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = MASTER_COMPRESSOR.thresholdDb;
  comp.knee.value = MASTER_COMPRESSOR.kneeDb;
  comp.ratio.value = MASTER_COMPRESSOR.ratio;
  comp.attack.value = MASTER_COMPRESSOR.attackSeconds;
  comp.release.value = MASTER_COMPRESSOR.releaseSeconds;

  const output = ctx.createGain();
  output.gain.value = MASTER_BUS_OUTPUT_GAIN;

  input.connect(drive);
  drive.connect(low);
  low.connect(presence);
  presence.connect(air);
  air.connect(comp);
  comp.connect(output);
  output.connect(destination);

  return {
    input,
    output,
    setPresence(amount, t) {
      const v = clamp(-0.8 + amount * 2.2, -2.5, 3);
      presence.gain.setTargetAtTime(v, t, 0.2);
    },
    getCompressorReductionDb() {
      return Math.abs(comp.reduction);
    },
    dispose() {
      /* nodes GC with context */
    },
  };
}
