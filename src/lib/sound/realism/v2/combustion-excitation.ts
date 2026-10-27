/**
 * Host for combustion excitation AudioWorklet with procedural fallback (V2.1).
 * Fallback uses one persistent noise source amplitude-modulated at firingHz -
 * never spawns per-fire OscillatorNodes.
 */

import { getNoiseBuffer } from "@/lib/sound/dsp/noise";

/** Bump whenever public/audio/combustion-processor.js changes. */
export const COMBUSTION_WORKLET_VERSION = "2026-10-15a";

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
  if (!("audioWorklet" in ctx) || !ctx.audioWorklet) {
    console.warn("[CombustionExcitation] AudioWorklet not supported; using tonal fallback");
    return Promise.resolve(false);
  }
  if (readyContexts.has(ctx)) return Promise.resolve(true);
  const pending = loadPromises.get(ctx);
  if (pending) return pending;
  const promise = (async () => {
    try {
      if (!ctx.audioWorklet) return false;
      console.log("[CombustionExcitation] Loading combustion-processor worklet...");
      // Versioned URL: a new deploy always fetches the new worklet (no stale HTTP/SW cache).
      const url = `/audio/combustion-processor.js?v=${COMBUSTION_WORKLET_VERSION}`;
      // Retry: a failed load silently drops the whole drive to the tonal fallback.
      for (let attempt = 0; ; attempt += 1) {
        try {
          await ctx.audioWorklet.addModule(url);
          break;
        } catch (error) {
          const delay = [400, 1200, 2800][attempt];
          if (delay === undefined || ctx.state === "closed") throw error;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      readyContexts.add(ctx);
      console.log("[CombustionExcitation] Worklet loaded successfully");
      return true;
    } catch (err) {
      console.warn("[CombustionExcitation] Worklet failed to load; using tonal fallback", err);
      return false;
    } finally {
      loadPromises.delete(ctx);
    }
  })();
  loadPromises.set(ctx, promise);
  return promise;
}

/**
 * Tonal fallback excitation when AudioWorklet is unavailable.
 * Uses multiple oscillators at firing-order harmonics instead of noise AM,
 * producing an obviously synthetic but still engine-like rumble.
 */
function createFallbackExcitation(ctx: BaseAudioContext): CombustionExcitationHandle {
  console.log("[CombustionExcitation] Creating tonal fallback excitation");

  const fundamental = ctx.createOscillator();
  fundamental.type = "sawtooth";
  fundamental.frequency.value = 40;

  const harmonic2 = ctx.createOscillator();
  harmonic2.type = "triangle";
  harmonic2.frequency.value = 80;

  const harmonic3 = ctx.createOscillator();
  harmonic3.type = "triangle";
  harmonic3.frequency.value = 120;

  const harmonic4 = ctx.createOscillator();
  harmonic4.type = "sine";
  harmonic4.frequency.value = 160;

  const fundamentalGain = ctx.createGain();
  fundamentalGain.gain.value = 0.32;
  const h2Gain = ctx.createGain();
  h2Gain.gain.value = 0.22;
  const h3Gain = ctx.createGain();
  h3Gain.gain.value = 0.14;
  const h4Gain = ctx.createGain();
  h4Gain.gain.value = 0.08;

  const harmonicMix = ctx.createGain();
  harmonicMix.gain.value = 0.5;

  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx, "brown");
  noise.loop = true;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.06;

  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i += 1) {
    const x = i / 128 - 1;
    curve[i] = Math.tanh(x * 2.8);
  }
  shaper.curve = curve;

  const tilt = ctx.createBiquadFilter();
  tilt.type = "lowshelf";
  tilt.frequency.value = 180;
  tilt.gain.value = 6;

  const body = ctx.createBiquadFilter();
  body.type = "lowpass";
  body.frequency.value = 800;
  body.Q.value = 0.7;

  const presence = ctx.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.value = 320;
  presence.Q.value = 1.2;
  presence.gain.value = 4;

  const mix = ctx.createGain();
  mix.gain.value = 0.45;

  fundamental.connect(fundamentalGain);
  harmonic2.connect(h2Gain);
  harmonic3.connect(h3Gain);
  harmonic4.connect(h4Gain);
  fundamentalGain.connect(harmonicMix);
  h2Gain.connect(harmonicMix);
  h3Gain.connect(harmonicMix);
  h4Gain.connect(harmonicMix);

  noise.connect(noiseGain);
  noiseGain.connect(harmonicMix);

  harmonicMix.connect(shaper);
  shaper.connect(tilt);
  tilt.connect(body);
  body.connect(presence);
  presence.connect(mix);

  fundamental.start();
  harmonic2.start();
  harmonic3.start();
  harmonic4.start();
  noise.start();

  return {
    node: mix,
    mode: "fallback",
    setParams({ firingHz, intensity, load, sharpness, audioTime }) {
      const hz = Math.max(8, Math.min(400, firingHz));
      fundamental.frequency.setTargetAtTime(hz, audioTime, 0.035);
      harmonic2.frequency.setTargetAtTime(hz * 2, audioTime, 0.035);
      harmonic3.frequency.setTargetAtTime(hz * 3, audioTime, 0.035);
      harmonic4.frequency.setTargetAtTime(hz * 4, audioTime, 0.035);

      const baseLevel = 0.18 + intensity * 0.35;
      fundamentalGain.gain.setTargetAtTime(baseLevel * (0.85 + load * 0.15), audioTime, 0.05);
      h2Gain.gain.setTargetAtTime(baseLevel * 0.65 * (0.7 + sharpness * 0.3), audioTime, 0.05);
      h3Gain.gain.setTargetAtTime(baseLevel * 0.4 * (0.6 + sharpness * 0.4), audioTime, 0.05);
      h4Gain.gain.setTargetAtTime(baseLevel * 0.22 * sharpness, audioTime, 0.05);

      noiseGain.gain.setTargetAtTime(0.03 + load * 0.05, audioTime, 0.06);
      mix.gain.setTargetAtTime(0.3 + intensity * 0.4, audioTime, 0.06);

      tilt.gain.setTargetAtTime(5 + load * 3, audioTime, 0.08);
      body.frequency.setTargetAtTime(600 + load * 400 + sharpness * 200, audioTime, 0.08);
      presence.frequency.setTargetAtTime(hz * 2.5, audioTime, 0.08);
      presence.gain.setTargetAtTime(3 + load * 2, audioTime, 0.08);
    },
    dispose() {
      try {
        fundamental.stop();
        harmonic2.stop();
        harmonic3.stop();
        harmonic4.stop();
        noise.stop();
      } catch {
        /* already stopped */
      }
      fundamental.disconnect();
      harmonic2.disconnect();
      harmonic3.disconnect();
      harmonic4.disconnect();
      fundamentalGain.disconnect();
      h2Gain.disconnect();
      h3Gain.disconnect();
      h4Gain.disconnect();
      harmonicMix.disconnect();
      noise.disconnect();
      noiseGain.disconnect();
      shaper.disconnect();
      tilt.disconnect();
      body.disconnect();
      presence.disconnect();
      mix.disconnect();
    },
  };
}

function createWorkletExcitation(ctx: BaseAudioContext): CombustionExcitationHandle | null {
  try {
    console.log("[CombustionExcitation] Creating worklet excitation node");
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
    // F1-class topologies (short pulses) fire up to ~1.6 kHz; everything else keeps 800 Hz.
    let maxFiringHz = 800;
    return {
      node,
      mode: "worklet",
      setParams(p) {
        const t = p.audioTime;
        firingHz?.setTargetAtTime(Math.max(0, Math.min(maxFiringHz, p.firingHz)), t, 0.03);
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
          maxFiringHz = 800;
          node.port.postMessage({ type: "clearTopology" });
          return;
        }
        const tau = (topology as { pulseTauScale?: number }).pulseTauScale;
        maxFiringHz = Number.isFinite(tau) && (tau as number) < 1 ? 2000 : 800;
        node.port.postMessage({ type: "topology", topology });
      },
      dispose() {
        node.disconnect();
      },
    };
  } catch (err) {
    console.warn("[CombustionExcitation] Failed to create worklet node", err);
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
