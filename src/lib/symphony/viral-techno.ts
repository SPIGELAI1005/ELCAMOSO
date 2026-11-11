import type { MovementState } from "./types";
import type { MusicClock } from "./music-clock";
import { smoothstep } from "./speed-layers";

/** MIDI: C#2=37, G#1=32, B1=35, E2=40. */
const WALK_CS: readonly number[] = [37, 37, 32, 35, 37, 37, 32, 35];
const WALK_E: readonly number[] = [40, 40, 35, 37, 40, 40, 35, 37];
/** Rolling 16ths (C# minor / E). */
const ROLL_CS: readonly number[] = [37, 37, 32, 37, 35, 37, 32, 35, 37, 44, 32, 37, 35, 37, 32, 35];
const ROLL_E: readonly number[] = [40, 40, 35, 40, 37, 40, 35, 37, 40, 47, 35, 40, 37, 40, 35, 37];
/** Acid 16ths in the same 4-bar i–i–i–III. */
const ACID_CS: readonly number[] = [49, 52, 56, 49, 52, 56, 61, 56, 49, 52, 47, 52, 56, 52, 49, 52];
const ACID_E: readonly number[] = [52, 56, 59, 52, 56, 59, 64, 59, 52, 56, 51, 56, 59, 56, 52, 56];
/** Arp 16ths: C#m triad / E triad. */
const ARP_CS: readonly number[] = [61, 64, 68, 64, 61, 68, 64, 73, 61, 64, 68, 64, 61, 68, 64, 73];
const ARP_E: readonly number[] = [64, 68, 71, 68, 64, 71, 68, 76, 64, 68, 71, 68, 64, 71, 68, 76];

export interface TechnoLayerGains {
  sub: number;
  kick: number;
  offbeatBass: number;
  acid: number;
  openHat: number;
  arp: number;
  pump: number;
  filter: number;
}

const SILENT: TechnoLayerGains = {
  sub: 0,
  kick: 0,
  offbeatBass: 0,
  acid: 0,
  openHat: 0,
  arp: 0,
  pump: 0,
  filter: 0,
};

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function electronicGainsFromDrive(
  speedKmh: number,
  movement: MovementState,
  energy = 0,
): TechnoLayerGains {
  const cruise = smoothstep(72, 92, speedKmh);
  const highway = smoothstep(118, 155, speedKmh);
  const top = movement === "peak" || energy >= 0.82 ? 1 : 0;
  const open = Math.max(cruise, highway, top);
  if (open <= 0.001 && movement !== "decelerating") return { ...SILENT };

  const decel = movement === "decelerating";
  const strip = decel ? 0.2 : 1;
  const h = Math.max(highway, top * 0.85);

  return {
    sub: (0.5 * cruise + 0.22 * h) * strip,
    kick: (0.38 * cruise + 0.18 * h) * strip,
    offbeatBass: (0.22 * cruise + 0.2 * h) * strip,
    acid: (0.14 * cruise + 0.2 * h) * strip,
    openHat: (0.14 * cruise + 0.16 * h) * strip,
    arp: (0.1 * cruise + 0.14 * h) * strip,
    pump: (0.32 * cruise + 0.2 * h) * (decel ? 0.35 : 1),
    filter: Math.min(1, 0.35 * cruise + 0.65 * h) * (decel ? 0.45 : 1),
  };
}

function makeNoise(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const n = Math.max(1, Math.floor(seconds * ctx.sampleRate));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function envGain(ctx: BaseAudioContext, at: number, peak: number, attack: number, decay: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + Math.max(0.002, attack));
  g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(attack + 0.01, decay));
  return g;
}

/**
 * Web-Audio techno overlay for Viral Mix. Notes are scheduled against the
 * pack clock (107.666 BPM, 4-bar i–i–i–III). No extra sample assets.
 */
export function createViralTechno(
  ctx: BaseAudioContext,
  destination: AudioNode,
  clock: MusicClock,
  ducks: { bed: GainNode; hook: GainNode },
) {
  const bus = ctx.createGain();
  bus.gain.value = 1;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 700;
  filter.Q.value = 0.9;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 6;
  limiter.ratio.value = 3.5;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.12;
  bus.connect(filter);
  filter.connect(limiter);
  limiter.connect(destination);

  const subOsc = ctx.createOscillator();
  subOsc.type = "sine";
  subOsc.frequency.value = midiToHz(25);
  const subGain = ctx.createGain();
  subGain.gain.value = 0.0001;
  const subLp = ctx.createBiquadFilter();
  subLp.type = "lowpass";
  subLp.frequency.value = 90;
  subLp.Q.value = 0.7;
  subOsc.connect(subLp);
  subLp.connect(subGain);
  subGain.connect(bus);

  const acidFilter = ctx.createBiquadFilter();
  acidFilter.type = "lowpass";
  acidFilter.frequency.value = 500;
  acidFilter.Q.value = 9;
  const acidOut = ctx.createGain();
  acidOut.gain.value = 1;
  acidFilter.connect(acidOut);
  acidOut.connect(filter);

  const noise = makeNoise(ctx, 0.25);
  const click = makeNoise(ctx, 0.03);

  const layerGains: TechnoLayerGains = { ...SILENT };
  let scheduledUntil = -1;
  let started = false;
  let late = 0;
  const live: AudioNode[] = [];

  function setLayerGain(param: AudioParam, value: number, audioTime: number) {
    const v = Math.max(0.0001, value);
    try {
      param.setTargetAtTime(v, audioTime, 0.08);
    } catch {
      late += 1;
    }
  }

  function fireKick(at: number, gain: number) {
    if (gain < 0.02) return;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(148, at);
    osc.frequency.exponentialRampToValueAtTime(38, at + 0.055);
    const g = envGain(ctx, at, gain, 0.003, 0.13);
    osc.connect(g);
    g.connect(bus);
    const src = ctx.createBufferSource();
    src.buffer = click;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1800;
    const cg = envGain(ctx, at, gain * 0.18, 0.001, 0.014);
    src.connect(hp);
    hp.connect(cg);
    cg.connect(bus);
    try {
      osc.start(at);
      osc.stop(at + 0.16);
      src.start(at);
      src.stop(at + 0.03);
    } catch {
      late += 1;
    }
    live.push(osc, g, src, hp, cg);
  }

  function firePluck(
    at: number,
    midi: number,
    gain: number,
    dest: AudioNode,
    type: OscillatorType,
    decay: number,
  ) {
    if (gain < 0.015) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(midiToHz(midi), at);
    const g = envGain(ctx, at, gain, 0.004, decay);
    osc.connect(g);
    g.connect(dest);
    try {
      osc.start(at);
      osc.stop(at + decay + 0.02);
    } catch {
      late += 1;
    }
    live.push(osc, g);
  }

  function fireHat(at: number, gain: number, open: number) {
    if (gain < 0.015) return;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7500;
    const g = envGain(ctx, at, gain, 0.002, 0.05 + open * 0.08);
    src.connect(hp);
    hp.connect(g);
    g.connect(bus);
    try {
      src.start(at);
      src.stop(at + 0.2);
    } catch {
      late += 1;
    }
    live.push(src, hp, g);
  }

  function pump(at: number, depth: number, beatDur: number) {
    if (depth < 0.05) return;
    const bed = Math.max(0.0001, 1 - depth);
    // Pads/keys pump; leave the vocal hook unducked so it stays audible.
    const tau = Math.max(0.05, beatDur * 0.22);
    try {
      ducks.bed.gain.setValueAtTime(bed, at);
      ducks.bed.gain.setTargetAtTime(1, at + 0.012, tau);
    } catch {
      late += 1;
    }
  }

  return {
    start(audioTime: number) {
      if (started) return;
      started = true;
      try {
        subOsc.start(audioTime);
      } catch {
        late += 1;
      }
      scheduledUntil = audioTime;
    },
    setGains(next: TechnoLayerGains, audioTime: number) {
      Object.assign(layerGains, next);
      setLayerGain(subGain.gain, next.sub, audioTime);
      const cutoff = 550 + next.filter * 4200;
      try {
        filter.frequency.setTargetAtTime(cutoff, audioTime, 0.12);
        acidFilter.frequency.setTargetAtTime(420 + next.filter * 2800, audioTime, 0.1);
        acidFilter.Q.setTargetAtTime(8 + next.filter * 4, audioTime, 0.1);
      } catch {
        late += 1;
      }
    },
    schedule(audioTime: number) {
      if (!started) return;
      const beatDur = 60 / clock.config.bpm;
      const six = beatDur / 4;
      const origin = clock.origin;
      const from = Math.max(audioTime, scheduledUntil);
      const until = audioTime + 0.22;
      if (until <= from) return;

      const first = Math.ceil((from - origin - 1e-6) / six) * six + origin;
      for (let t = first; t < until; t += six) {
        const elapsed = t - origin;
        const absSix = Math.round(elapsed / six);
        const sixInBar = ((absSix % 16) + 16) % 16;
        const eighthInBar = Math.floor(sixInBar / 2);
        const barInLoop = Math.floor(elapsed / (beatDur * 4)) % 4;
        const onE = barInLoop === 3;
        const isBeat = sixInBar % 4 === 0;
        const isOffbeat8 = sixInBar % 4 === 2;

        if (isBeat) {
          fireKick(t, layerGains.kick);
          pump(t, layerGains.pump, beatDur);
        }

        if (sixInBar % 2 === 0) {
          const walk = (onE ? WALK_E : WALK_CS)[eighthInBar] ?? 37;
          try {
            subOsc.frequency.setValueAtTime(midiToHz(walk - 12), t);
          } catch {
            late += 1;
          }
        }

        if (layerGains.offbeatBass > 0.02) {
          if (layerGains.filter > 0.55) {
            const note = (onE ? ROLL_E : ROLL_CS)[sixInBar] ?? 37;
            firePluck(t, note, layerGains.offbeatBass * 0.85, bus, "square", 0.09);
          } else if (isOffbeat8) {
            const note = (onE ? WALK_E : WALK_CS)[eighthInBar] ?? 37;
            firePluck(t, note, layerGains.offbeatBass, bus, "square", 0.11);
          }
        }

        if (layerGains.acid > 0.02) {
          const note = (onE ? ACID_E : ACID_CS)[sixInBar] ?? 49;
          firePluck(t, note, layerGains.acid, acidFilter, "sawtooth", 0.1);
        }

        if (layerGains.arp > 0.02) {
          const note = (onE ? ARP_E : ARP_CS)[sixInBar] ?? 61;
          firePluck(t, note, layerGains.arp * 0.7, bus, "triangle", 0.08);
        }

        if (isOffbeat8) {
          fireHat(t, layerGains.openHat, layerGains.filter);
        }

        // keep the live-node list from growing without bound during long renders
        if (live.length > 400) {
          const drop = live.splice(0, 150);
          for (const node of drop) {
            try {
              node.disconnect();
            } catch {
              /* */
            }
          }
        }
      }
      scheduledUntil = until;
    },
    get gains(): TechnoLayerGains {
      return { ...layerGains };
    },
    get lateEvents() {
      return late;
    },
    dispose() {
      try {
        subOsc.stop();
      } catch {
        /* */
      }
      for (const node of [
        subOsc,
        subGain,
        subLp,
        acidFilter,
        acidOut,
        filter,
        limiter,
        bus,
        ...live,
      ]) {
        try {
          node.disconnect();
        } catch {
          /* */
        }
      }
      live.length = 0;
    },
  };
}

export type ViralTechno = ReturnType<typeof createViralTechno>;
