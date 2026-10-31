/**
 * Horse snorts for horse profiles only. Two CC0 Freesound clips (trimmed, peak-normalised,
 * mixed low under the carriage). Never on a fixed loop: idle snorts at random 15-40 s gaps,
 * one snort on a hard throttle jump (cooldown 8 s), one "settling" snort when a fast
 * deceleration brings the horse to rest (cooldown 12 s), and a global 6 s minimum gap.
 */
import { fetchBytesWithRetry } from "@/lib/sound/fetch-bytes";
import type { DriveState } from "@/lib/drive/model";
import type { RecordedCredit } from "@/lib/sound/realism/v2/recorded-loops";

export const HORSE_SNORT_PROFILES = new Set([
  "wild-west-carriage",
  "dracula-carriage",
  "romanian-85-carriage",
  "horse-gallop",
]);

export function isHorseSnortProfile(id: string | null | undefined): boolean {
  return !!id && HORSE_SNORT_PROFILES.has(id);
}

const BASE = "/sample-packs/recorded/snorts-v1";
export const SNORT_URLS = { accel: `${BASE}/snort_4.m4a`, idle: `${BASE}/snort_6.m4a` } as const;
export type SnortClip = keyof typeof SNORT_URLS;
export type SnortReason = "idle" | "accel" | "settle" | "cruise";

const BASE_V2 = "/sample-packs/recorded/snorts-v2";
/** Carriages: two CC0 "brrr" lip-flutter snorts, used for every carriage snort. */
export const CARRIAGE_SNORT_URLS = {
  accel: `${BASE_V2}/brrr_a.m4a`,
  idle: `${BASE_V2}/brrr_b.m4a`,
} as const;
export const CARRIAGE_SNORT_PROFILES = new Set(["wild-west-carriage", "dracula-carriage", "romanian-85-carriage"]);

export interface SnortTiming {
  idleMin: number;
  idleMax: number;
  idleMaxKmh: number;
  accelCooldown: number;
  accelJump: number;
  accelMinThrottle: number;
  settleCooldown: number;
  settleFromKmh: number;
  settleStopKmh: number;
  settleWindow: number;
  globalGap: number;
  /** Steady-speed snorts: after cruiseMin..cruiseMax s holding speed (> cruiseMinKmh). */
  cruiseMin?: number;
  cruiseMax?: number;
  cruiseMinKmh?: number;
  /** Speed change (km/h) that resets the steady-speed timer. */
  cruiseTolKmh?: number;
}

export const SNORT_TIMING: SnortTiming = {
  idleMin: 15,
  idleMax: 40,
  idleMaxKmh: 3,
  accelCooldown: 8,
  accelJump: 0.35,
  accelMinThrottle: 0.6,
  settleCooldown: 12,
  settleFromKmh: 8,
  settleStopKmh: 2,
  settleWindow: 4,
  globalGap: 6,
};

/** Carriages: a brrr at idle every 10-18 s and every 10-15 s while holding a steady speed. */
export const CARRIAGE_SNORT_TIMING: SnortTiming = {
  ...SNORT_TIMING,
  idleMin: 10,
  idleMax: 18,
  globalGap: 6,
  cruiseMin: 10,
  cruiseMax: 15,
  cruiseMinKmh: 6,
  cruiseTolKmh: 4,
};

export function snortConfigFor(profileId: string) {
  return CARRIAGE_SNORT_PROFILES.has(profileId)
    ? { urls: CARRIAGE_SNORT_URLS, timing: CARRIAGE_SNORT_TIMING }
    : { urls: SNORT_URLS, timing: SNORT_TIMING };
}

export interface SnortEvent {
  reason: SnortReason;
  clip: SnortClip;
  rate: number;
  gain: number;
}

/** Pure trigger / cooldown logic (unit-tested). `t` is seconds. */
export class SnortScheduler {
  private lastAny = -1e9;
  private lastAccel = -1e9;
  private lastSettle = -1e9;
  private nextIdleAt: number | null = null;
  private lastThrottle = 0;
  private fastAt = -1e9;
  private wasMoving = false;
  private cruiseRef: number | null = null;
  private nextCruiseAt: number | null = null;

  constructor(
    private readonly rand: () => number = Math.random,
    private readonly timing: SnortTiming = SNORT_TIMING,
  ) {}

  /** Seconds of the last snort (or -1e9). Lets whinnies avoid overlapping a snort. */
  get lastSnortAt() {
    return this.lastAny;
  }

  /** A whinny is playing until `until`: no snort may start before it ends (+1 s). */
  holdUntil(until: number) {
    this.lastAny = Math.max(this.lastAny, until + 1 - this.timing.globalGap);
  }

  private cruiseGap() {
    const T = this.timing;
    const lo = T.cruiseMin ?? 10;
    return lo + this.rand() * ((T.cruiseMax ?? lo) - lo);
  }

  private idleGap() {
    return this.timing.idleMin + this.rand() * (this.timing.idleMax - this.timing.idleMin);
  }

  private emit(reason: SnortReason, t: number): SnortEvent {
    this.lastAny = t;
    const clip: SnortClip = reason === "accel" ? "accel" : "idle";
    return {
      reason,
      clip,
      rate: 0.95 + this.rand() * 0.1,
      gain: 0.85 + this.rand() * 0.3,
    };
  }

  step(t: number, kmh: number, throttle: number): SnortEvent | null {
    const T = this.timing;
    const dThrottle = throttle - this.lastThrottle;
    this.lastThrottle = throttle;
    if (kmh >= T.settleFromKmh) {
      this.fastAt = t;
      this.wasMoving = true;
    }
    const gapOk = t - this.lastAny >= T.globalGap;
    let ev: SnortEvent | null = null;

    if (dThrottle >= T.accelJump && throttle >= T.accelMinThrottle) {
      if (gapOk && t - this.lastAccel >= T.accelCooldown) {
        this.lastAccel = t;
        ev = this.emit("accel", t);
      }
    } else if (this.wasMoving && kmh <= T.settleStopKmh) {
      this.wasMoving = false;
      if (t - this.fastAt <= T.settleWindow && gapOk && t - this.lastSettle >= T.settleCooldown) {
        this.lastSettle = t;
        ev = this.emit("settle", t);
      }
    }

    if (kmh <= T.idleMaxKmh && throttle < 0.1) {
      if (this.nextIdleAt === null || ev) this.nextIdleAt = t + this.idleGap();
      else if (t >= this.nextIdleAt) {
        if (t - this.lastAny >= T.globalGap) ev = this.emit("idle", t);
        this.nextIdleAt = t + this.idleGap();
      }
    } else {
      this.nextIdleAt = null;
    }

    if (T.cruiseMin !== undefined && kmh >= (T.cruiseMinKmh ?? 6)) {
      const tol = T.cruiseTolKmh ?? 4;
      if (this.cruiseRef === null || Math.abs(kmh - this.cruiseRef) > tol || ev) {
        this.cruiseRef = kmh;
        this.nextCruiseAt = t + this.cruiseGap();
      } else if (this.nextCruiseAt !== null && t >= this.nextCruiseAt) {
        if (!ev && t - this.lastAny >= T.globalGap) ev = this.emit("cruise", t);
        this.nextCruiseAt = t + this.cruiseGap();
      }
    } else {
      this.cruiseRef = null;
      this.nextCruiseAt = null;
    }
    return ev;
  }
}

/** Snort level relative to the cabin bus (sits under the hooves / wheels). */
const SNORT_LEVEL = 0.32;
const cache = new Map<string, Promise<ArrayBuffer>>();

export class HorseSnorts {
  private buffers: Partial<Record<SnortClip, AudioBuffer>> = {};
  private out: GainNode;
  private disposed = false;
  readonly scheduler: SnortScheduler;
  private readonly urls: Record<SnortClip, string>;

  constructor(
    private readonly ctx: BaseAudioContext,
    destination: AudioNode,
    profileId = "horse-gallop",
  ) {
    const cfg = snortConfigFor(profileId);
    this.urls = cfg.urls;
    this.scheduler = new SnortScheduler(Math.random, cfg.timing);
    this.out = ctx.createGain();
    this.out.gain.value = SNORT_LEVEL;
    this.out.connect(destination);
  }

  async load(): Promise<void> {
    await Promise.all(
      (Object.keys(this.urls) as SnortClip[]).map(async (clip) => {
        const url = this.urls[clip];
        let p = cache.get(url);
        if (!p) {
          p = fetchBytesWithRetry(url, "snort");
          p.catch(() => cache.delete(url));
          cache.set(url, p);
        }
        const bytes = await p;
        if (this.disposed) return;
        this.buffers[clip] = await this.ctx.decodeAudioData(bytes.slice(0));
      }),
    );
  }

  update(state: DriveState, t: number) {
    if (this.disposed) return;
    const kmh = Math.max(0, state.speed || 0) * 3.6;
    const throttle = Math.max(0, Math.min(1, state.throttle || 0));
    const ev = this.scheduler.step(t, kmh, throttle);
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
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
  }

  dispose() {
    this.disposed = true;
    this.out.disconnect();
  }
}

export const HORSE_SNORT_CREDITS: RecordedCredit[] = [
  {
    title: "G38-16-Four Horse Snorts (Freesound #437111)",
    author: "craigsmith",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/437111/",
    usedIn: "Carriages (brrr snort)",
    attribution: "G38-16-Four Horse Snorts by craigsmith (Freesound #437111), CC0 1.0",
  },
  {
    title: "Horse snort (Freesound #475483)",
    author: "o_ciz",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/475483/",
    usedIn: "Horse profiles (acceleration snort)",
    attribution: "Horse snort by o_ciz (Freesound #475483), CC0 1.0",
  },
  {
    title: "Horse snort (Freesound #538697)",
    author: "bruno.auzet",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://freesound.org/s/538697/",
    usedIn: "Horse profiles (idle and settling snort), Carriages (brrr snort)",
    attribution: "Horse snort by bruno.auzet (Freesound #538697), CC0 1.0",
  },
];
