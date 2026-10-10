import { createDriveShaper } from "@/lib/sound/dsp/waveshaper";
import { clamp } from "@/lib/sound/dsp/math";
import { MASTER_BUS_OUTPUT_GAIN } from "@/lib/sound/perceptual-volume";

/**
 * Profile bus → gentle saturation → EQ → compressor → master feed.
 * Keeps subjective loudness consistent and avoids clipping.
 */
export interface MasterBus {
  input: GainNode;
  output: GainNode;
  setPresence: (amount: number, t: number) => void;
  getCompressorReductionDb: () => number;
  dispose: () => void;
}

/** Gentle program control; the final limiter remains the peak safety stage. */
export const MASTER_COMPRESSOR = {
  thresholdDb: -10,
  kneeDb: 6,
  ratio: 1.8,
  attackSeconds: 0.018,
  releaseSeconds: 0.28,
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
