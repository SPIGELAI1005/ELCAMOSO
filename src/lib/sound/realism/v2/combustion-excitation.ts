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
  /** Seed cycle-to-cycle RNG (worklet only; no-op on fallback). */
  setSeed?: (seed: number) => void;
  /** Install validated cylinder topology (worklet only; no-op on fallback). */
  setTopology?: (topology: unknown | null) => void;
  dispose: () => void;
  mode: "worklet" | "fallback";
}

/**
 * Worklet modules are registered per AudioContext. A single global flag used to mark the
 * module as loaded after the first context, so every later context (each Stop → Play
 * creates a new AudioContext; every OfflineAudioContext render too) silently fell back to
 * the procedural noise excitation. Track readiness per context instead.
 */
const readyContexts = new WeakSet<BaseAudioContext>();
const loadPromises = new WeakMap<BaseAudioContext, Promise<boolean>>();

export function isCombustionWorkletReady(ctx?: BaseAudioContext) {
  return ctx ? readyContexts.has(ctx) : false;
}

export function ensureCombustionWorklet(ctx: BaseAudioContext): Promise<boolean> {
  if (!("audioWorklet" in ctx) || !ctx.audioWorklet) return Promise.resolve(false);
  if (readyContexts.has(ctx)) return Promise.resolve(true);
  const pending = loadPromises.get(ctx);
  if (pending) return pending;
  const promise = (async () => {
    try {
      if (!ctx.audioWorklet) return false;
      await ctx.audioWorklet.addModule("/audio/combustion-processor.js");
      readyContexts.add(ctx);
      return true;
    } catch {
      return false;
    } finally {
      loadPromises.delete(ctx);
    }
  })();
  loadPromises.set(ctx, promise);
  return promise;
}

function createFallbackExcitation(ctx: BaseAudioContext): CombustionExcitationHandle {
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx, "brown");
  noise.loop = true;
  const am = ctx.createGain();
  am.gain.value = 0.42;
  const tone = ctx.createOscillator();
  tone.type = "triangle";
  tone.frequency.value = 40;
  const toneGain = ctx.createGain();
  toneGain.gain.value = 0.12;
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
  tilt.frequency.value = 260;
  tilt.gain.value = 5;
  const body = ctx.createBiquadFilter();
  body.type = "lowpass";
  body.frequency.value = 900;
  body.Q.value = 0.65;
  // Preserve a restrained broadband pressure edge for upper formants. The
  // previous fallback sent only the low-passed body onward, starving intake
  // and high-RPM resonances whenever AudioWorklet was unavailable.
  const edgeHp = ctx.createBiquadFilter();
  edgeHp.type = "highpass";
  edgeHp.frequency.value = 720;
  edgeHp.Q.value = 0.55;
  const edgeGain = ctx.createGain();
  edgeGain.gain.value = 0.035;

  noise.connect(am);
  tone.connect(toneGain);
  toneGain.connect(am.gain);
  am.connect(shaper);
  shaper.connect(tilt);
  tilt.connect(body);
  body.connect(mix);
  shaper.connect(edgeHp);
  edgeHp.connect(edgeGain);
  edgeGain.connect(mix);
  noise.start();
  tone.start();

  return {
    node: mix,
    mode: "fallback",
    setParams({ firingHz, intensity, irregularity, load, sharpness, audioTime }) {
      const hz = Math.max(8, Math.min(400, firingHz));
      tone.frequency.setTargetAtTime(hz, audioTime, 0.04);
      const depth = 0.035 + intensity * (0.1 + load * 0.08) * (0.8 + sharpness * 0.2);
      toneGain.gain.setTargetAtTime(depth * (1 + irregularity * 0.12), audioTime, 0.05);
      mix.gain.setTargetAtTime(0.28 + intensity * 0.38, audioTime, 0.06);
      tilt.gain.setTargetAtTime(4 + load * 2.5 - sharpness * 0.8, audioTime, 0.08);
      body.frequency.setTargetAtTime(620 + load * 520 + sharpness * 180, audioTime, 0.08);
      edgeHp.frequency.setTargetAtTime(620 + load * 580 + sharpness * 320, audioTime, 0.08);
      edgeGain.gain.setTargetAtTime(0.018 + load * sharpness * 0.085, audioTime, 0.06);
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
      body.disconnect();
      edgeHp.disconnect();
      edgeGain.disconnect();
      mix.disconnect();
    },
  };
}

function createWorkletExcitation(ctx: BaseAudioContext): CombustionExcitationHandle | null {
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
        architecture?.setTargetAtTime(Math.max(0, Math.min(6, p.architecture)), t, 0.2);
      },
      setSeed(seed: number) {
        const s = seed >>> 0;
        node.port.postMessage({ type: "seed", seed: s === 0 ? 1 : s });
      },
      setTopology(topology: unknown | null) {
        if (topology == null) {
          node.port.postMessage({ type: "clearTopology" });
          return;
        }
        node.port.postMessage({ type: "topology", topology });
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
  if (readyContexts.has(ctx) && "audioWorklet" in ctx) {
    const worklet = createWorkletExcitation(ctx);
    if (worklet) return worklet;
  }
  return createFallbackExcitation(ctx);
}
