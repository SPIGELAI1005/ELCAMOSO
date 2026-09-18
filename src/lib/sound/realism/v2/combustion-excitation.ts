/**
 * Host for combustion excitation AudioWorklet with procedural fallback (V2.1).
 * Fallback uses one persistent noise source amplitude-modulated at firingHz -
 * never spawns per-fire OscillatorNodes.
 */

import { getNoiseBuffer } from "@/lib/sound/dsp/noise";

export interface CombustionExcitationParams {
  firingHz: number;
  intensity: number;
  irregularity: number;
  load: number;
  sharpness: number;
  architecture: number;
  audioTime: number;
}

export interface CombustionExcitationHandle {
  node: AudioNode;
  setParams: (p: CombustionExcitationParams) => void;
  dispose: () => void;
  mode: "worklet" | "fallback";
}

let workletReady = false;
let workletLoadPromise: Promise<boolean> | null = null;

export function isCombustionWorkletReady() {
  return workletReady;
}

export function ensureCombustionWorklet(ctx: BaseAudioContext): Promise<boolean> {
  if (!(ctx instanceof AudioContext)) return Promise.resolve(false);
  if (workletReady) return Promise.resolve(true);
  if (workletLoadPromise) return workletLoadPromise;
  workletLoadPromise = (async () => {
    try {
      if (!ctx.audioWorklet) return false;
      await ctx.audioWorklet.addModule("/audio/combustion-processor.js");
      workletReady = true;
      return true;
    } catch {
      workletReady = false;
      return false;
    }
  })();
  return workletLoadPromise;
}

function createFallbackExcitation(ctx: BaseAudioContext): CombustionExcitationHandle {
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx, "brown");
  noise.loop = true;
  const am = ctx.createGain();
  am.gain.value = 0.2;
  const tone = ctx.createOscillator();
  tone.type = "sine";
  tone.frequency.value = 40;
  const toneGain = ctx.createGain();
  toneGain.gain.value = 0.35;
  const mix = ctx.createGain();
  mix.gain.value = 0.45;
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i += 1) {
    const x = i / 128 - 1;
    curve[i] = Math.tanh(x * (2.2 + i * 0.002));
  }
  shaper.curve = curve;
  const tilt = ctx.createBiquadFilter();
  tilt.type = "lowshelf";
  tilt.frequency.value = 220;
  tilt.gain.value = 2;

  noise.connect(am);
  tone.connect(toneGain);
  toneGain.connect(am.gain);
  am.connect(shaper);
  shaper.connect(tilt);
  tilt.connect(mix);
  noise.start();
  tone.start();

  return {
    node: mix,
    mode: "fallback",
    setParams({ firingHz, intensity, irregularity, load, sharpness, audioTime }) {
      const hz = Math.max(8, Math.min(400, firingHz));
      tone.frequency.setTargetAtTime(hz, audioTime, 0.04);
      const depth = 0.1 + intensity * (0.32 + load * 0.28) * (0.7 + sharpness * 0.4);
      toneGain.gain.setTargetAtTime(depth * (1 + irregularity * 0.15), audioTime, 0.05);
      mix.gain.setTargetAtTime(0.22 + intensity * 0.48, audioTime, 0.06);
      tilt.gain.setTargetAtTime(1.5 + load * 3 - sharpness, audioTime, 0.08);
    },
    dispose() {
      try {
        tone.stop();
        noise.stop();
      } catch {
        /* already stopped */
      }
      tone.disconnect();
      noise.disconnect();
      am.disconnect();
      toneGain.disconnect();
      shaper.disconnect();
      tilt.disconnect();
      mix.disconnect();
    },
  };
}

function createWorkletExcitation(ctx: AudioContext): CombustionExcitationHandle | null {
  try {
    const node = new AudioWorkletNode(ctx, "elcamoso-combustion-excitation", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    const firingHz = node.parameters.get("firingHz");
    const intensity = node.parameters.get("intensity");
    const irregularity = node.parameters.get("irregularity");
    const load = node.parameters.get("load");
    const sharpness = node.parameters.get("sharpness");
    const architecture = node.parameters.get("architecture");
    return {
      node,
      mode: "worklet",
      setParams(p) {
        const t = p.audioTime;
        firingHz?.setTargetAtTime(Math.max(0, Math.min(800, p.firingHz)), t, 0.03);
        intensity?.setTargetAtTime(Math.max(0, Math.min(1, p.intensity)), t, 0.04);
        irregularity?.setTargetAtTime(Math.max(0, Math.min(1, p.irregularity)), t, 0.08);
        load?.setTargetAtTime(Math.max(0, Math.min(1, p.load)), t, 0.05);
        sharpness?.setTargetAtTime(Math.max(0, Math.min(1, p.sharpness)), t, 0.06);
        architecture?.setTargetAtTime(Math.max(0, Math.min(5, p.architecture)), t, 0.2);
      },
      dispose() {
        node.disconnect();
      },
    };
  } catch {
    return null;
  }
}

/** Synchronous factory - prefers worklet when already loaded. */
export function createCombustionExcitation(ctx: BaseAudioContext): CombustionExcitationHandle {
  if (workletReady && ctx instanceof AudioContext) {
    const worklet = createWorkletExcitation(ctx);
    if (worklet) return worklet;
  }
  return createFallbackExcitation(ctx);
}
