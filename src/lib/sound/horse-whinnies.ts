/**
 * Horse neighs / whinnies for horse profiles only. Four CC0 Freesound recordings (trimmed,
 * loudness-matched to the snorts at -16 LUFS). Used sparingly, never on every event:
 *  - pull-away: after standing still >= 3 s, crossing 4 km/h whinnies with 50% chance;
 *  - steady speed: one whinny after a random 45-90 s holding speed (>= 6 km/h);
 *  - at most one whinny per 45 s, never within 3 s after a snort, and snorts are held
 *    back until the whinny has finished (+1 s), so the two never overlap.
 */
import { fetchBytesWithRetry } from "@/lib/sound/fetch-bytes";
import type { DriveState } from "@/lib/drive/model";
import type { RecordedCredit } from "@/lib/sound/realism/v2/recorded-loops";
import { isHorseSnortProfile, type SnortScheduler } from "@/lib/sound/horse-snorts";

const BASE = "/sample-packs/recorded/whinnies-v1";
export const WHINNY_URLS = [
  `${BASE}/whinny_a.m4a`,
  `${BASE}/whinny_b.m4a`,
  `${BASE}/whinny_c.m4a`,
  `${BASE}/whinny_d.m4a`,
] as const;

export const isHorseWhinnyProfile = isHorseSnortProfile;

export const WHINNY_TIMING = {
  minGap: 45,
  cruiseMin: 45,
  cruiseMax: 90,
  cruiseMinKmh: 6,
  standKmh: 2,
  standFor: 3,
  pullAwayKmh: 4,
  pullAwayChance: 0.5,
  snortClear: 3,
};

export type WhinnyReason = "pullaway" | "cruise";
export interface WhinnyEvent {
  reason: WhinnyReason;
  clip: number;
  rate: number;
  gain: number;
}

/** Pure trigger logic (unit-tested). `t` in seconds; `lastSnortAt` from the snort scheduler. */
export class WhinnyScheduler {
  private lastAny = -1e9;
  private standSince: number | null = null;
  private armed = false;
  private nextCruiseAt: number | null = null;
  private lastClip = -1;

  constructor(private readonly rand: () => number = Math.random) {}

  private cruiseGap() {
    const T = WHINNY_TIMING;
    return T.cruiseMin + this.rand() * (T.cruiseMax - T.cruiseMin);
  }

  private emit(reason: WhinnyReason, t: number): WhinnyEvent {
    this.lastAny = t;
    let clip = Math.floor(this.rand() * WHINNY_URLS.length) % WHINNY_URLS.length;
    if (clip === this.lastClip) clip = (clip + 1) % WHINNY_URLS.length;
    this.lastClip = clip;
    return { reason, clip, rate: 0.96 + this.rand() * 0.08, gain: 0.85 + this.rand() * 0.2 };
  }

  step(t: number, kmh: number, lastSnortAt = -1e9): WhinnyEvent | null {
    const T = WHINNY_TIMING;
    const ok = t - this.lastAny >= T.minGap && t - lastSnortAt >= T.snortClear;
    let ev: WhinnyEvent | null = null;

    if (kmh <= T.standKmh) {
      if (this.standSince === null) this.standSince = t;
      if (t - this.standSince >= T.standFor) this.armed = true;
    } else {
      this.standSince = null;
      if (this.armed && kmh >= T.pullAwayKmh) {
        this.armed = false;
        if (ok && this.rand() < T.pullAwayChance) ev = this.emit("pullaway", t);
      }
    }

    if (kmh >= T.cruiseMinKmh) {
      if (this.nextCruiseAt === null || ev) this.nextCruiseAt = t + this.cruiseGap();
      else if (t >= this.nextCruiseAt && ok) {
        ev = this.emit("cruise", t);
        this.nextCruiseAt = t + this.cruiseGap();
      }
    } else {
      this.nextCruiseAt = null;
    }
    return ev;
  }
}

/** Whinny level relative to the cabin bus (same bus and level family as the snorts). */
const WHINNY_LEVEL = 0.3;
const cache = new Map<string, Promise<ArrayBuffer>>();

export class HorseWhinnies {
  private buffers: (AudioBuffer | undefined)[] = [];
  private out: GainNode;
  private disposed = false;
  private playing = new Set<AudioBufferSourceNode>();
  readonly scheduler = new WhinnyScheduler();

  constructor(
    private readonly ctx: BaseAudioContext,
    destination: AudioNode,
    readonly profileId = "horse-gallop",
    private readonly snorts: SnortScheduler | null = null,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = WHINNY_LEVEL;
    this.out.connect(destination);
  }

  async load(): Promise<void> {
    await Promise.all(
      WHINNY_URLS.map(async (url, i) => {
        let p = cache.get(url);
        if (!p) {
          p = fetchBytesWithRetry(url, "whinny");
          p.catch(() => cache.delete(url));
          cache.set(url, p);
        }
        const bytes = await p;
        if (this.disposed) return;
        this.buffers[i] = await this.ctx.decodeAudioData(bytes.slice(0));
      }),
    );
  }

  update(state: DriveState, t: number) {
    if (this.disposed) return;
    const kmh = Math.max(0, state.speed || 0) * 3.6;
    const ev = this.scheduler.step(t, kmh, this.snorts?.lastSnortAt ?? -1e9);
    const buf = ev ? this.buffers[ev.clip] : undefined;
    if (!ev || !buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = ev.rate;
    const g = this.ctx.createGain();
    g.gain.value = ev.gain;
    src.connect(g);
    g.connect(this.out);
    src.start(t + 0.02);
    this.snorts?.holdUntil(t + 0.02 + buf.duration / ev.rate);
    this.playing.add(src);
    src.onended = () => {
      this.playing.delete(src);
      src.disconnect();
      g.disconnect();
    };
  }

  dispose() {
    this.disposed = true;
    for (const src of this.playing) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    this.playing.clear();
    this.out.disconnect();
  }
}

const CC0 = { licence: "CC0 1.0", licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/" };
export const HORSE_WHINNY_CREDITS: RecordedCredit[] = [
  { title: "G38-15-Perfect Horse Whinny (Freesound #437110)", author: "craigsmith", sourceUrl: "https://freesound.org/s/437110/" },
  { title: "Horse's whinny (Freesound #347036)", author: "Kubuzz", sourceUrl: "https://freesound.org/s/347036/" },
  { title: "Horse_Whinny (Freesound #149024)", author: "foxen10", sourceUrl: "https://freesound.org/s/149024/" },
  { title: "Horse neigh shortened (Freesound #269571)", author: "shadoWisp", sourceUrl: "https://freesound.org/s/269571/" },
].map((c) => ({
  ...c,
  ...CC0,
  usedIn: "Horse profiles (neigh / whinny)",
  attribution: `${c.title.replace(/ \(Freesound.*/, "")} by ${c.author} (${c.title.match(/#\d+/)![0].replace("#", "Freesound #")}), CC0 1.0`,
}));
