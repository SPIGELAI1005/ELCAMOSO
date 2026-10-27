/**
 * Horse snorts for horse profiles only. Two CC0 Freesound clips (trimmed, peak-normalised,
 * mixed low under the carriage). Never on a fixed loop: idle snorts at random 15-40 s gaps,
 * one snort on a hard throttle jump (cooldown 8 s), one "settling" snort when a fast
 * deceleration brings the horse to rest (cooldown 12 s), and a global 6 s minimum gap.
 */
import type { DriveState } from "@/lib/drive/model";
import type { RecordedCredit } from "@/lib/sound/realism/v2/recorded-loops";

export const HORSE_SNORT_PROFILES = new Set(["wild-west-carriage", "romanian-85-carriage", "horse-gallop"]);

export function isHorseSnortProfile(id: string | null | undefined): boolean {
  return !!id && HORSE_SNORT_PROFILES.has(id);
}

const BASE = "/sample-packs/recorded/snorts-v1";
export const SNORT_URLS = { accel: `${BASE}/snort_4.m4a`, idle: `${BASE}/snort_6.m4a` } as const;
export type SnortClip = keyof typeof SNORT_URLS;
export type SnortReason = "idle" | "accel" | "settle";

export const SNORT_TIMING = {
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
} as const;

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

  constructor(private readonly rand: () => number = Math.random) {}

  private idleGap() {
    return SNORT_TIMING.idleMin + this.rand() * (SNORT_TIMING.idleMax - SNORT_TIMING.idleMin);
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
    const T = SNORT_TIMING;
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
  readonly scheduler = new SnortScheduler();

  constructor(
    private readonly ctx: BaseAudioContext,
    destination: AudioNode,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = SNORT_LEVEL;
    this.out.connect(destination);
  }

  async load(): Promise<void> {
    await Promise.all(
      (Object.keys(SNORT_URLS) as SnortClip[]).map(async (clip) => {
        const url = SNORT_URLS[clip];
        let p = cache.get(url);
        if (!p) {
          p = fetch(url).then((r) => {
            if (!r.ok) throw new Error(`snort ${url} ${r.status}`);
            return r.arrayBuffer();
          });
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
    usedIn: "Horse profiles (idle and settling snort)",
    attribution: "Horse snort by bruno.auzet (Freesound #538697), CC0 1.0",
  },
];
