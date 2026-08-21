import { createDriveShaper } from "@/lib/sound/dsp/waveshaper";
import { clamp } from "@/lib/sound/dsp/math";

/**
 * Profile bus → gentle saturation → EQ → compressor → master feed.
 * Keeps subjective loudness consistent and avoids clipping.
 */
export interface MasterBus {
  input: GainNode;
  output: GainNode;
  setPresence: (amount: number, t: number) => void;
  dispose: () => void;
}

export function createMasterBus(ctx: BaseAudioContext, destination: AudioNode): MasterBus {
  const input = ctx.createGain();
  input.gain.value = 1;

  const drive = createDriveShaper(ctx, 0.28);

  const low = ctx.createBiquadFilter();
  low.type = "lowshelf";
  low.frequency.value = 110;
  low.gain.value = -1.5;

  const presence = ctx.createBiquadFilter();
  presence.type = "peaking";
  // ~1.2 kHz helps phone speakers carry body without boosting harsh HF.
  presence.frequency.value = 1200;
  presence.Q.value = 0.75;
  presence.gain.value = -0.5;

  const air = ctx.createBiquadFilter();
  air.type = "highshelf";
  air.frequency.value = 5500;
  air.gain.value = -2.5;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 10;
  comp.ratio.value = 2.8;
  comp.attack.value = 0.01;
  comp.release.value = 0.22;

  const output = ctx.createGain();
  output.gain.value = 0.72;

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
      const v = clamp(-1.5 + amount * 2.2, -3, 2.5);
      presence.gain.setTargetAtTime(v, t, 0.2);
    },
    dispose() {
      /* nodes GC with context */
    },
  };
}
