import type { StrategyBuses } from "@/lib/sound/realism/types";

/** Primary (American Muscle V8) mix share when the Big Twin layer is active. */
export const MUSCLE_V8_LAYER_PRIMARY_GAIN = 0.6;
/** Secondary (Big Twin) mix share under American Muscle V8. */
export const MUSCLE_V8_LAYER_SECONDARY_GAIN = 0.4;
export const MUSCLE_V8_LAYER_SECONDARY_PROFILE_ID = "big-twin";

/**
 * Makeup so the 0.6 / 0.4 sum stays near the unlayered V8 loudness.
 * Uncorrelated RMS would want ~1.387; fully correlated summing wants 1.0.
 * 1.15 is a conservative starting point (about +1.2 dB), then lab comparison
 * can nudge it. Peak protect still caps the output.
 */
export const MUSCLE_V8_LAYER_MAKEUP_GAIN = 1.15;

export interface EngineLayerSpec {
  profileId: string;
  gain: number;
  /**
   * Continuous engine voice only: no pops, crackles, or shift one-shots.
   * The primary profile keeps exclusive bangs / crackles.
   */
  continuousOnly?: boolean;
}

export interface EngineLayerStack {
  primaryGain: number;
  makeupGain: number;
  layers: readonly EngineLayerSpec[];
}

/**
 * Extra engine profiles mixed under a catalog sound. Keyed by the *requested*
 * profile id so aliases (e.g. Police Patrol → Muscle V8) are not affected.
 */
export const PROFILE_ENGINE_LAYERS: Readonly<Record<string, EngineLayerStack>> = {
  "american-muscle-v8": {
    primaryGain: MUSCLE_V8_LAYER_PRIMARY_GAIN,
    makeupGain: MUSCLE_V8_LAYER_MAKEUP_GAIN,
    layers: [
      {
        profileId: MUSCLE_V8_LAYER_SECONDARY_PROFILE_ID,
        gain: MUSCLE_V8_LAYER_SECONDARY_GAIN,
        continuousOnly: true,
      },
    ],
  },
};

export function engineLayerStackFor(profileId: string | null | undefined): EngineLayerStack | null {
  if (!profileId) return null;
  return PROFILE_ENGINE_LAYERS[profileId] ?? null;
}

export function effectiveLayerGain(stack: EngineLayerStack, gain: number): number {
  return gain * stack.makeupGain;
}

/** Insert a linear gain in front of each strategy bus so a synth can be mixed. */
export function scaleStrategyBuses(
  ctx: BaseAudioContext,
  buses: StrategyBuses,
  gain: number,
): { buses: StrategyBuses; nodes: GainNode[] } {
  const wrap = (dest: AudioNode) => {
    const node = ctx.createGain();
    node.gain.value = gain;
    node.connect(dest);
    return node;
  };
  const body = wrap(buses.body);
  const accents = wrap(buses.accents);
  const beds = wrap(buses.beds);
  const profile = wrap(buses.profile);
  return {
    buses: { body, accents, beds, profile },
    nodes: [body, accents, beds, profile],
  };
}

export function disposeGainNodes(nodes: GainNode[]) {
  for (const node of nodes) {
    try {
      node.disconnect();
    } catch {
      /* already disconnected */
    }
  }
}
