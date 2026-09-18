import type { WorldLayerId, WorldLayerSpec, WorldPack } from "./types";

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoiseBuffer(ctx: BaseAudioContext, seconds: number, seed: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  const rnd = mulberry32(seed);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = rnd() * 2 - 1;
    last = last * 0.98 + white * 0.02;
    data[i] = last * 0.7 + white * 0.15;
  }
  return buf;
}

interface LayerVoice {
  id: WorldLayerId;
  gain: GainNode;
  osc?: OscillatorNode | undefined;
  noise?: AudioBufferSourceNode | undefined;
  lfo?: OscillatorNode | undefined;
  lfoGain?: GainNode | undefined;
  /** Every node owned by this layer, used for deterministic teardown. */
  nodes: AudioNode[];
}

/**
 * Procedural world layers - continuous sources with gain envelopes.
 * Muted layers stay running (silent) to avoid restart clicks.
 */
export function createWorldLayerPlayer(
  ctx: BaseAudioContext,
  destination: AudioNode,
  pack: WorldPack,
  seed: number,
) {
  const bus = ctx.createGain();
  bus.gain.value = 0.0001;
  bus.connect(destination);

  const voices: LayerVoice[] = [];
  const targets: Partial<Record<WorldLayerId, number>> = {};
  let lastThunderAt = -999;
  let pendingEvents = 0;

  for (const layer of pack.layers) {
    voices.push(buildLayer(ctx, bus, layer, seed + layer.tone));
    targets[layer.id] = 0;
  }

  let started = false;

  return {
    get pendingEvents() {
      return pendingEvents;
    },
    start(audioTime: number) {
      if (started) return;
      started = true;
      // Cinematic entrance - soft fade below safe loudness
      bus.gain.setValueAtTime(0.0001, audioTime);
      bus.gain.linearRampToValueAtTime(pack.packGain * 0.85, audioTime + 1.4);
      for (const v of voices) {
        try {
          v.osc?.start(audioTime);
          v.noise?.start(audioTime);
          v.lfo?.start(audioTime);
        } catch {
          /* already started */
        }
      }
    },
    setGains(next: Partial<Record<WorldLayerId, number>>, audioTime: number) {
      for (const v of voices) {
        const g = Math.max(0.0001, next[v.id] ?? 0);
        targets[v.id] = g;
        try {
          v.gain.gain.setTargetAtTime(g, audioTime, 0.12);
        } catch {
          /* teardown */
        }
      }
    },
    /** Soft distant thunder - rate limited, limited level. */
    maybeThunder(audioTime: number, intensity: number) {
      const thunder = voices.find((v) => v.id === "thunder");
      if (!thunder) return;
      if (audioTime - lastThunderAt < pack.eventCooldownSec) return;
      if (intensity < 0.55) return;
      lastThunderAt = audioTime;
      pendingEvents += 1;
      const peak = Math.min(0.22, 0.08 + intensity * 0.12);
      try {
        thunder.gain.gain.cancelScheduledValues(audioTime);
        thunder.gain.gain.setValueAtTime(Math.max(0.0001, targets.thunder ?? 0.05), audioTime);
        thunder.gain.gain.linearRampToValueAtTime(peak, audioTime + 0.08);
        thunder.gain.gain.exponentialRampToValueAtTime(0.0001, audioTime + 1.8);
      } catch {
        /* ignore */
      }
    },
    activeLayers(): WorldLayerId[] {
      return voices.filter((v) => (targets[v.id] ?? 0) > 0.05).map((v) => v.id);
    },
    getTransitionGain() {
      return bus.gain.value;
    },
    dispose() {
      for (const v of voices) {
        try {
          v.osc?.stop();
        } catch {
          /* */
        }
        try {
          v.noise?.stop();
        } catch {
          /* */
        }
        try {
          v.lfo?.stop();
        } catch {
          /* */
        }
        for (const node of new Set(v.nodes)) {
          try {
            node.disconnect();
          } catch {
            /* already disconnected */
          }
        }
      }
      try {
        bus.disconnect();
      } catch {
        /* */
      }
    },
  };
}

function buildLayer(
  ctx: BaseAudioContext,
  bus: GainNode,
  layer: WorldLayerSpec,
  seed: number,
): LayerVoice {
  const gain = ctx.createGain();
  gain.gain.value = 0.0001;
  gain.connect(bus);

  if (layer.kind === "drone" || layer.kind === "shimmer") {
    const osc = ctx.createOscillator();
    osc.type = layer.kind === "shimmer" ? "triangle" : "sine";
    osc.frequency.value = layer.tone;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = layer.tone * 4;
    osc.connect(filter);
    filter.connect(gain);

    let lfo: OscillatorNode | undefined;
    let lfoGain: GainNode | undefined;
    if (layer.kind === "shimmer") {
      lfo = ctx.createOscillator();
      lfoGain = ctx.createGain();
      lfo.frequency.value = 0.15 + (seed % 7) * 0.02;
      lfoGain.gain.value = layer.tone * 0.04;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
    }
    return {
      id: layer.id,
      gain,
      osc,
      lfo,
      lfoGain,
      nodes: [gain, osc, filter, ...(lfo ? [lfo] : []), ...(lfoGain ? [lfoGain] : [])],
    };
  }

  if (layer.kind === "pulse") {
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = layer.tone;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;
    const pulseGain = ctx.createGain();
    pulseGain.gain.value = 0.35;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 2.2;
    lfoGain.gain.value = 0.32;
    lfo.connect(lfoGain);
    lfoGain.connect(pulseGain.gain);
    osc.connect(filter);
    filter.connect(pulseGain);
    pulseGain.connect(gain);
    return {
      id: layer.id,
      gain,
      osc,
      lfo,
      lfoGain,
      nodes: [gain, osc, filter, pulseGain, lfo, lfoGain],
    };
  }

  // noise / impact
  const noise = ctx.createBufferSource();
  noise.buffer = makeNoiseBuffer(ctx, layer.kind === "impact" ? 2.5 : 3.5, seed);
  noise.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = layer.kind === "impact" ? "lowpass" : "bandpass";
  filter.frequency.value = layer.tone;
  filter.Q.value = layer.kind === "impact" ? 0.7 : 0.9;
  noise.connect(filter);
  filter.connect(gain);
  return { id: layer.id, gain, noise, nodes: [gain, noise, filter] };
}
