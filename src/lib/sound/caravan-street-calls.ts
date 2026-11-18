/**
 * Occasional Romanian scrap-collector street calls for Caravan Carriage only.
 *
 * The first cry (the woman) starts 2–4 s after speed first stays above 20 km/h,
 * so a brief spike does not trigger it. After that, cries alternate
 * woman / man / woman / man about every 30 s, measured start to start, with
 * about ±3 s of jitter. If a clip is longer than the gap, the next start waits
 * until the clip ends plus 2 s, so they never overlap. If speed drops below
 * about 17 km/h the schedule pauses; a playing clip is left to finish (no
 * cut-off). When speed goes back above 20 km/h, the next voice resumes after
 * another 2–4 s. Speed is the same GPS / Tesla / simulator source other Drive
 * features use (`state.speed` in m/s). Routed into the same cabin bus as
 * snorts/whinnies so master volume and cabin processing apply.
 *
 * Lines (exact text with diacritics):
 *   woman: "Fiare vechi. Fiare vechi luăm"
 *   man:   "Fiare vechi, frigidere vechi, calorifere, electronice luăm"
 *
 * TEST ONLY in this branch: the runtime m4a overlays are cut from George's
 * Suno song “Fiare Vechi Luam” (https://suno.com/s/vVWzRwhQvHSreHOw), made on
 * the free plan. Free-plan Output is not licensed for commercial use, and
 * upgrading later does not grant retroactive rights (see Suno help
 * https://help.suno.com/en/articles/2425729). These files must be replaced by
 * a paid-plan regeneration or the Piper v2 fallback in
 * assets/caravan-carriage/fiare-vechi-*-piper-v2.* before this is merged.
 *
 * Piper v2 fallback (kept in assets): official ro_RO-mihai-medium (CC0). There
 * is no official commercially licensed female Romanian Piper voice (third-party
 * female voices such as Lili/Sanda/Raluca are CC BY-NC 4.0 and were not used).
 * The clips have not been checked by ear.
 */
import { fetchBytesWithRetry } from "@/lib/sound/fetch-bytes";
import type { DriveState } from "@/lib/drive/model";
import type { RecordedCredit } from "@/lib/sound/realism/v2/recorded-loops";

export const CARAVAN_STREET_CALL_PROFILE_ID = "caravan-carriage";

export function isCaravanStreetCallProfile(id: string | null | undefined): boolean {
  return id === CARAVAN_STREET_CALL_PROFILE_ID;
}

/** DriveState.speed is metres per second; other speed-gated features use × 3.6. */
export function streetCallSpeedKmh(state: Pick<DriveState, "speed">): number {
  const mps = Number.isFinite(state.speed) ? Math.max(0, state.speed) : 0;
  return mps * 3.6;
}

export const STREET_CALL_TEXT = {
  woman: "Fiare vechi. Fiare vechi luăm",
  man: "Fiare vechi, frigidere vechi, calorifere, electronice luăm",
} as const;

export type StreetCallKind = keyof typeof STREET_CALL_TEXT;

const BASE = "/sample-packs/caravan-carriage";
export const STREET_CALL_URLS: Record<StreetCallKind, string> = {
  woman: `${BASE}/fiare-vechi-woman.m4a`,
  man: `${BASE}/fiare-vechi-man.m4a`,
};

/** Seconds and km/h. */
export const STREET_CALL_TIMING = {
  /** Start or resume arming when speed exceeds this. */
  enterKmh: 20,
  /** Pause the schedule when speed drops below this (hysteresis). */
  exitKmh: 17,
  /** Hold after crossing enterKmh before the next cry (avoids brief spikes). */
  armMin: 2,
  armMax: 4,
  /** Target start-to-start interval. */
  interval: 30,
  /** Jitter around the interval (± seconds). */
  jitter: 3,
  /** After a clip ends, wait at least this long before the next start. */
  afterClipGap: 2,
} as const;

const STREET_CALL_LEVEL = 0.72;

export interface StreetCallEvent {
  kind: StreetCallKind;
}

/** Pure trigger / cooldown logic (unit-tested). `t` is seconds, `kmh` is km/h. */
export class StreetCallScheduler {
  private active = false;
  private armStartedAt: number | null = null;
  private armHold = 0;
  private nextKind: StreetCallKind = "woman";
  private nextAt: number | null = null;
  private playingUntil: number | null = null;

  constructor(private readonly rand: () => number = Math.random) {}

  private between(min: number, max: number): number {
    return min + this.rand() * (max - min);
  }

  private speed(kmh: number): number {
    return Number.isFinite(kmh) ? Math.max(0, kmh) : 0;
  }

  /**
   * `durations` are the decoded clip lengths in seconds (woman, then man).
   * A playing clip is never cancelled here; the player lets it finish.
   */
  step(t: number, kmh: number, durations: { woman: number; man: number }): StreetCallEvent | null {
    const T = STREET_CALL_TIMING;
    const speed = this.speed(kmh);

    if (speed < T.exitKmh) {
      this.active = false;
      this.armStartedAt = null;
      this.nextAt = null;
      return null;
    }

    if (!this.active) {
      if (speed <= T.enterKmh) {
        // 17–20 km/h before first arm, or a dip during the 2–4 s hold: cancel.
        this.armStartedAt = null;
        return null;
      }
      if (this.armStartedAt === null) {
        this.armStartedAt = t;
        this.armHold = this.between(T.armMin, T.armMax);
      }
      if (t < this.armStartedAt + this.armHold) return null;
      this.active = true;
      this.armStartedAt = null;
      this.nextAt = t;
    }

    if (this.nextAt === null || t < this.nextAt) return null;

    const earliest =
      this.playingUntil !== null ? this.playingUntil + T.afterClipGap : Number.NEGATIVE_INFINITY;
    if (t < earliest) {
      this.nextAt = earliest;
      return null;
    }

    const kind = this.nextKind;
    const dur = Math.max(0, durations[kind] ?? 0);
    this.playingUntil = t + dur;
    const interval = this.between(T.interval - T.jitter, T.interval + T.jitter);
    this.nextAt = Math.max(t + interval, t + dur + T.afterClipGap);
    this.nextKind = kind === "woman" ? "man" : "woman";
    return { kind };
  }
}

const cache = new Map<string, Promise<ArrayBuffer>>();

export class CaravanStreetCalls {
  private buffers: Partial<Record<StreetCallKind, AudioBuffer>> = {};
  private out: GainNode;
  private disposed = false;
  readonly scheduler = new StreetCallScheduler();

  constructor(
    private readonly ctx: BaseAudioContext,
    destination: AudioNode,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = STREET_CALL_LEVEL;
    this.out.connect(destination);
  }

  async load(): Promise<void> {
    await Promise.all(
      (Object.keys(STREET_CALL_URLS) as StreetCallKind[]).map(async (kind) => {
        const url = STREET_CALL_URLS[kind];
        let p = cache.get(url);
        if (!p) {
          p = fetchBytesWithRetry(url, "street-call");
          p.catch(() => cache.delete(url));
          cache.set(url, p);
        }
        const bytes = await p;
        if (this.disposed) return;
        this.buffers[kind] = await this.ctx.decodeAudioData(bytes.slice(0));
      }),
    );
  }

  update(state: DriveState, t: number) {
    if (this.disposed) return;
    const woman = this.buffers.woman;
    const man = this.buffers.man;
    if (!woman || !man) return;
    const ev = this.scheduler.step(t, streetCallSpeedKmh(state), {
      woman: woman.duration,
      man: man.duration,
    });
    const buf = ev ? this.buffers[ev.kind] : undefined;
    if (!ev || !buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 1;
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

export const STREET_CALL_CREDITS: RecordedCredit[] = [
  {
    title: "Piper Romanian voice ro_RO-mihai-medium",
    author: "Piper / OHF-Voice (Mihai dataset; rdh base)",
    licence: "CC0 1.0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://huggingface.co/rhasspy/piper-voices/tree/main/ro/ro_RO/mihai/medium",
    usedIn: "Caravan Carriage (street calls “Fiare vechi. Fiare vechi luăm” and “Fiare vechi, frigidere vechi, calorifere, electronice luăm”)",
    attribution:
      "TEST ONLY: the runtime street-call overlays are currently cut from the Suno song “Fiare Vechi Luam” (https://suno.com/s/vVWzRwhQvHSreHOw), created on Suno’s free plan. Under Suno’s terms, free-tier Output may only be used for lawful, personal and non-commercial purposes, and starting a paid subscription later does not grant a retroactive commercial licence for songs made on the free plan (https://help.suno.com/en/articles/2425729, https://suno.com/terms). These files must be replaced by a paid-plan regeneration or the Piper v2 fallback (assets/caravan-carriage/fiare-vechi-*-piper-v2.*, official ro_RO-mihai-medium, CC0) before this profile is merged or shipped. The clips have not been checked by ear.",
  },
];
