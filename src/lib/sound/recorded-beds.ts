/**
 * Recorded texture beds for non-engine-synth profiles (tractor, horse, dragon, UFO).
 * A bed is a small same-origin file with pre-crossfaded loops (and optional one-shots)
 * cut from free-licence recordings. Loops are cross-faded by a driver (engine rpm or
 * speed), pitched/time-scaled by playbackRate, and the profile's procedural layers are
 * ducked by `duck` × bed presence so the recording leads. Licences: RECORDED_BED_CREDITS.
 */
import type { DriveState } from "@/lib/drive/model";
import { fetchBytesWithRetry } from "@/lib/sound/fetch-bytes";
import type { RecordedCredit } from "@/lib/sound/realism/v2/recorded-loops";

const BASE = "/sample-packs/recorded/beds-v1";
const HORSE_LEVEL = 0.55;
const TRACTOR_LEVEL = 0.4;
const DRAGON_LEVEL = 0.12;
const UFO_LEVEL = 1;
const SR = 48000;
/** AAC priming; decoders that do not apply the edit list keep it at the head. */
const AAC_DELAY = 1024;

export interface BedLoop {
  start: number;
  end: number;
  /** Driver value (rpm or km/h) at which the loop plays at rate 1. */
  ref: number;
}

export interface BedOneShot {
  start: number;
  end: number;
  level: number;
  /** Throttle edge (> 0.72) fires it, at most once per cooldown seconds. */
  cooldown: number;
  /** Minimum speed (km/h) for a trigger. */
  minKmh: number;
}

export interface RecordedBedConfig {
  profileId: string;
  url: string;
  /** Decoded length without AAC priming, to detect decoders that keep the priming. */
  sourceSamples: number;
  driver: "rpm" | "kmh";
  loops: BedLoop[];
  /** rate = (driver / ref) ^ rateExponent, clamped. */
  rateExponent: number;
  minRate: number;
  maxRate: number;
  level: number;
  /** Bed presence vs km/h, piecewise linear [kmh, presence 0..1]. */
  presence: [number, number][];
  /** Extra presence per unit throttle. */
  throttleLift: number;
  /** Procedural layers are scaled by (1 - duck × presence). */
  duck: number;
  highpassHz: number;
  lowpassHz: number;
  oneShots?: BedOneShot[];
}


/**
 * Carriage bed (beds-v2/carriage.m4a, all CC0 Freesound): idle breathing, then walk / trot /
 * canter / gallop hoof loops crossfaded by speed, each with the wagon wheel rattle mixed in
 * louder as speed rises. From ~30-40 km/h a seamless gallop on a hard road fades in, clearly audible
 * about 7 dB under the wheels; its hoof rate rises gently with speed and caps near 60 km/h.
 * No pulse at idle: the procedural layers are almost fully ducked under the recording.
 */
function carriageBed(profileId: string, level: number): RecordedBedConfig {
  return {
    profileId,
    url: "/sample-packs/recorded/beds-v2/carriage.m4a",
    sourceSamples: 2710344,
    driver: "kmh",
    loops: [
      { start: 0.1, end: 14.1, ref: 2 },
      { start: 14.2, end: 26.2, ref: 6 },
      { start: 26.3, end: 38.3, ref: 14 },
      { start: 38.4, end: 43.6655, ref: 24 },
      { start: 43.7655, end: 56.3655, ref: 40 },
    ],
    rateExponent: 0.3,
    minRate: 0.85,
    maxRate: 1.15,
    level,
    presence: [[0, 1]],
    throttleLift: 0,
    duck: 0.95,
    highpassHz: 40,
    lowpassHz: 13000,
  };
}

export const RECORDED_BEDS: Record<string, RecordedBedConfig> = {
  "wild-west-carriage": carriageBed("wild-west-carriage", HORSE_LEVEL),
  "dracula-carriage": carriageBed("dracula-carriage", HORSE_LEVEL),
  "romanian-85-carriage": carriageBed("romanian-85-carriage", HORSE_LEVEL),
  "horse-gallop": {
    profileId: "horse-gallop",
    url: `${BASE}/horse.m4a`,
    sourceSamples: 343199,
    driver: "kmh",
    // Real gallop (Freesound 175356) at speed; coconut-shell gallop loop (807858) at trot pace.
    loops: [
      { start: 0.1, end: 4.69998, ref: 35 },
      { start: 4.79998, end: 7.04998, ref: 16 },
    ],
    rateExponent: 0.5,
    minRate: 0.8,
    maxRate: 1.25,
    level: HORSE_LEVEL,
    presence: [
      [0, 0],
      [3, 0],
      [8, 1],
    ],
    throttleLift: 0,
    duck: 0.7,
    highpassHz: 60,
    lowpassHz: 12000,
  },
  "wiesn-tractor": {
    profileId: "wiesn-tractor",
    url: `${BASE}/tractor.m4a`,
    sourceSamples: 344255,
    driver: "rpm",
    // Porsche Allgaier 1957 single-cylinder (Freesound 157839): idle ~846 rpm and a ~1,940 rpm
    // pull, mapped to the tractor model's 280 / 650 rpm scale; loops are whole putt cycles.
    loops: [
      { start: 0.1, end: 3.50558, ref: 280 },
      { start: 3.60558, end: 7.07198, ref: 650 },
    ],
    rateExponent: 1,
    minRate: 0.7,
    maxRate: 1.4,
    level: TRACTOR_LEVEL,
    presence: [[0, 1]],
    throttleLift: 0,
    duck: 0.75,
    highpassHz: 30,
    lowpassHz: 9000,
  },
  dragon: {
    profileId: "dragon",
    url: `${BASE}/dragon.m4a`,
    sourceSamples: 540000,
    driver: "kmh",
    // Wing beats (Freesound 735299) speed up gently with speed; a roar (651825) on hard throttle.
    loops: [{ start: 0.1, end: 6.1, ref: 40 }],
    rateExponent: 0.35,
    minRate: 0.75,
    maxRate: 1.35,
    level: DRAGON_LEVEL,
    presence: [
      [0, 0.35],
      [15, 0.8],
      [60, 1],
    ],
    throttleLift: 0,
    duck: 0.4,
    highpassHz: 40,
    lowpassHz: 14000,
    oneShots: [{ start: 6.2, end: 11.15, level: 0.9, cooldown: 14, minKmh: 0 }],
  },
  ufo: {
    profileId: "ufo",
    url: `${BASE}/ufo.m4a`,
    sourceSamples: 782400,
    driver: "kmh",
    // Two stretches of a waveform-generator UFO (Freesound 24351), cross-faded by speed.
    loops: [
      { start: 0.1, end: 8.1, ref: 30 },
      { start: 8.2, end: 16.2, ref: 110 },
    ],
    rateExponent: 0.3,
    minRate: 0.8,
    maxRate: 1.25,
    level: UFO_LEVEL,
    presence: [
      [0, 0.6],
      [30, 1],
    ],
    throttleLift: 0,
    duck: 0.5,
    highpassHz: 40,
    lowpassHz: 14000,
  },
};

export function getRecordedBed(profileId: string): RecordedBedConfig | null {
  return RECORDED_BEDS[profileId] ?? null;
}

export function piecewise(points: [number, number][], x: number): number {
  if (!points.length) return 0;
  if (x <= points[0]![0]) return points[0]![1];
  for (let i = 1; i < points.length; i += 1) {
    const [x1, y1] = points[i]!;
    const [x0, y0] = points[i - 1]!;
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / Math.max(1e-9, x1 - x0);
  }
  return points[points.length - 1]![1];
}

/** Equal-power weights of the loops for a driver value (two nearest refs in log space). */
export function bedLoopWeights(loops: BedLoop[], value: number): number[] {
  const w = loops.map(() => 0);
  if (!loops.length) return w;
  const order = loops.map((l, i) => ({ i, ref: l.ref })).sort((a, b) => a.ref - b.ref);
  const v = Math.max(1e-3, value);
  if (v <= order[0]!.ref) {
    w[order[0]!.i] = 1;
    return w;
  }
  const last = order[order.length - 1]!;
  if (v >= last.ref) {
    w[last.i] = 1;
    return w;
  }
  for (let k = 1; k < order.length; k += 1) {
    const lo = order[k - 1]!;
    const hi = order[k]!;
    if (v <= hi.ref) {
      const f = Math.log(v / lo.ref) / Math.log(hi.ref / lo.ref);
      w[lo.i] = Math.cos((f * Math.PI) / 2);
      w[hi.i] = Math.sin((f * Math.PI) / 2);
      return w;
    }
  }
  return w;
}

export function bedRate(cfg: RecordedBedConfig, loop: BedLoop, value: number): number {
  const r = Math.pow(Math.max(1e-3, value) / loop.ref, cfg.rateExponent);
  return Math.min(cfg.maxRate, Math.max(cfg.minRate, r));
}

const bufferCache = new Map<string, Promise<ArrayBuffer>>();

export class RecordedBed {
  private sources: { src: AudioBufferSourceNode; gain: GainNode; loop: BedLoop }[] = [];
  private out: GainNode;
  private hp: BiquadFilterNode;
  private lp: BiquadFilterNode;
  private buffer: AudioBuffer | null = null;
  private offset = 0;
  private lastThrottle = 0;
  private lastShotAt = -1e9;
  private disposed = false;
  presence = 0;

  constructor(
    private readonly ctx: BaseAudioContext,
    readonly cfg: RecordedBedConfig,
    destination: AudioNode,
  ) {
    this.hp = ctx.createBiquadFilter();
    this.hp.type = "highpass";
    this.hp.frequency.value = cfg.highpassHz;
    this.lp = ctx.createBiquadFilter();
    this.lp.type = "lowpass";
    this.lp.frequency.value = cfg.lowpassHz;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.hp.connect(this.lp);
    this.lp.connect(this.out);
    this.out.connect(destination);
  }

  async load(): Promise<void> {
    let p = bufferCache.get(this.cfg.url);
    if (!p) {
      p = fetchBytesWithRetry(this.cfg.url, "Recorded bed");
      p.catch(() => bufferCache.delete(this.cfg.url));
      bufferCache.set(this.cfg.url, p);
    }
    const bytes = await p;
    if (this.disposed) return;
    const buf = await this.ctx.decodeAudioData(bytes.slice(0));
    if (this.disposed) return;
    this.buffer = buf;
    this.offset = buf.length >= this.cfg.sourceSamples + AAC_DELAY ? AAC_DELAY / buf.sampleRate : 0;
    const at = this.ctx.currentTime;
    for (const loop of this.cfg.loops) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.loopStart = loop.start + this.offset;
      src.loopEnd = loop.end + this.offset;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain);
      gain.connect(this.hp);
      // Random phase so repeated sessions do not start on the same footfall / putt.
      src.start(at, loop.start + this.offset + Math.random() * (loop.end - loop.start) * 0.9);
      this.sources.push({ src, gain, loop });
    }
  }

  get ready(): boolean {
    return this.buffer !== null;
  }

  update(state: DriveState, t: number): number {
    const cfg = this.cfg;
    const kmh = Math.max(0, state.speed || 0) * 3.6;
    const throttle = Math.max(0, Math.min(1, state.throttle || 0));
    if (!this.buffer) {
      this.presence = 0;
      return 0;
    }
    const value = cfg.driver === "rpm" ? Math.max(1, state.rpm || 0) : kmh;
    const presence = Math.min(1, piecewise(cfg.presence, kmh) + cfg.throttleLift * throttle);
    this.presence = presence;
    const weights = bedLoopWeights(
      this.sources.map((s) => s.loop),
      value,
    );
    this.sources.forEach((s, i) => {
      s.src.playbackRate.setTargetAtTime(bedRate(cfg, s.loop, value), t, 0.12);
      s.gain.gain.setTargetAtTime(weights[i] ?? 0, t, 0.25);
    });
    this.out.gain.setTargetAtTime(Math.max(0.0001, cfg.level * presence), t, 0.2);
    if (cfg.oneShots?.length && throttle > 0.72 && this.lastThrottle <= 0.72) {
      const shot = cfg.oneShots[Math.floor(Math.random() * cfg.oneShots.length)]!;
      if (kmh >= shot.minKmh && t - this.lastShotAt >= shot.cooldown) {
        this.lastShotAt = t;
        this.fire(shot, t);
      }
    }
    this.lastThrottle = throttle;
    return presence;
  }

  private fire(shot: BedOneShot, t: number) {
    if (!this.buffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    const g = this.ctx.createGain();
    g.gain.value = shot.level;
    src.connect(g);
    g.connect(this.hp);
    const dur = shot.end - shot.start;
    src.start(t + 0.02, shot.start + this.offset, dur);
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
  }

  dispose(): void {
    this.disposed = true;
    for (const s of this.sources) {
      try {
        s.src.stop();
      } catch {
        /* already stopped */
      }
      s.src.disconnect();
      s.gain.disconnect();
    }
    this.sources = [];
    this.out.disconnect();
  }
}

export const RECORDED_BED_CREDITS: RecordedCredit[] = [
  {
    title: "Horse outside eating breathing stomping quiet (Freesound #574094)",
    author: "TRP",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/574094/",
    usedIn: "Carriages (idle breathing)",
    attribution: "Horse outside eating breathing stomping quiet by TRP (Freesound #574094), CC0 1.0, edited (trimmed, filtered, looped).",
  },
  {
    title: "Horse breathing (Freesound #619069)",
    author: "mrrap4food",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/619069/",
    usedIn: "Carriages (idle breathing)",
    attribution: "Horse breathing by mrrap4food (Freesound #619069), CC0 1.0, edited (trimmed, filtered, looped).",
  },
  {
    title: "G38-10-Horse Walks on Pavement (Freesound #437103)",
    author: "craigsmith",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/437103/",
    usedIn: "Carriages (walk)",
    attribution: "G38-10-Horse Walks on Pavement by craigsmith (Freesound #437103), CC0 1.0, edited (trimmed, filtered, looped).",
  },
  {
    title: "trotting horse in rural road (Freesound #139325)",
    author: "Oscar de Ávila",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/139325/",
    usedIn: "Carriages (trot)",
    attribution: "trotting horse in rural road by Oscar de Ávila (Freesound #139325), CC0 1.0, edited (trimmed, filtered, looped).",
  },
  {
    title: "G18-16- Horse and Wagon (Freesound #438194)",
    author: "craigsmith",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/438194/",
    usedIn: "Carriages (trot)",
    attribution: "G18-16- Horse and Wagon by craigsmith (Freesound #438194), CC0 1.0, edited (trimmed, filtered, looped).",
  },
  {
    title: "R14-05-Horses Gallop By (Freesound #479742)",
    author: "craigsmith",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/479742/",
    usedIn: "Carriages (canter)",
    attribution: "R14-05-Horses Gallop By by craigsmith (Freesound #479742), CC0 1.0, edited (trimmed, filtered, looped).",
  },
  {
    title: "G52-06-Buckboard Wagon (Freesound #437077)",
    author: "craigsmith",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/437077/",
    usedIn: "Carriages (wheel rattle)",
    attribution: "G52-06-Buckboard Wagon by craigsmith (Freesound #437077), CC0 1.0, edited (trimmed, filtered, looped).",
  },
  {
    title: "Horse Galloping (Freesound #175356)",
    author: "Max_Headroom",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/175356/",
    usedIn: "Horse Gallop (gallop bed), Carriages (high-speed gallop)",
    attribution:
      "Horse Galloping by Max_Headroom (Freesound #175356), CC0 1.0, edited (trimmed, filtered, looped).",
  },
  {
    title: "FEETHors Horse Galloping, Coconut Shells, Looped 03 (Freesound #807858)",
    author: "designerschoice (Nicholas Judy, TDC)",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    sourceUrl: "https://freesound.org/s/807858/",
    usedIn: "Horse Gallop (trot-pace bed)",
    attribution:
      "FEETHors-Samsung Galaxy Smartphone_Horse Galloping, Coconut Shells, Looped 03_Nicholas Judy_TDC by designerschoice (Freesound #807858), CC BY 4.0 (creativecommons.org/licenses/by/4.0), edited (mono, filtered, looped).",
  },
  {
    title: "Porsche Allgaier 1957 12 hp (Freesound #157839)",
    author: "viertelnachvier",
    licence: "CC BY 3.0",
    licenceUrl: "https://creativecommons.org/licenses/by/3.0/",
    sourceUrl: "https://freesound.org/s/157839/",
    usedIn: "Wiesn Tractor (idle and pull loops)",
    attribution:
      "Porsche Allgaier 1957 12 hp by viertelnachvier (Freesound #157839), CC BY 3.0 (creativecommons.org/licenses/by/3.0), edited (trimmed, filtered, looped, re-pitched).",
  },
  {
    title: "Dragon-Wings-3 (Freesound #735299)",
    author: "BenignChaos",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    sourceUrl: "https://freesound.org/s/735299/",
    usedIn: "Dragon (wing-beat bed)",
    attribution:
      "Dragon-Wings-3 by BenignChaos (Freesound #735299), CC BY 4.0 (creativecommons.org/licenses/by/4.0), edited (mono, filtered, looped).",
  },
  {
    title: "Dragon roar 7 (Freesound #651825)",
    author: "AMWD_Mortsel-Edegem-Kontich (made by Xander Bruyninckx)",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    sourceUrl: "https://freesound.org/s/651825/",
    usedIn: "Dragon (roar on hard throttle)",
    attribution:
      "Dragon roar 7 by AMWD_Mortsel-Edegem-Kontich / Xander Bruyninckx (Freesound #651825), credited under CC BY 4.0, edited (trimmed, filtered).",
  },
  {
    title: "CapturedUFO2 (Freesound #24351)",
    author: "dargoth",
    licence: "CC BY 3.0",
    licenceUrl: "https://creativecommons.org/licenses/by/3.0/",
    sourceUrl: "https://freesound.org/s/24351/",
    usedIn: "UFO (hover bed)",
    attribution:
      "CapturedUFO2 by dargoth (Freesound #24351), CC BY 3.0 (creativecommons.org/licenses/by/3.0), edited (trimmed, filtered, looped).",
  },
];
