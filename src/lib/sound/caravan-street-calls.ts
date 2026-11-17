/**
 * Occasional Romanian scrap-collector street calls for Caravan Carriage only.
 *
 * Woman first, then the man a little later. The pair plays after a short delay
 * from session start, then at most once every few minutes. Routed into the
 * same cabin bus as snorts/whinnies so master volume and cabin processing apply.
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

/** Seconds. First pair after a sensible delay; then not more than once every few minutes. */
export const STREET_CALL_TIMING = {
  firstMin: 25,
  firstMax: 45,
  /** Gap after the woman finishes before the man starts. */
  manGapMin: 7,
  manGapMax: 12,
  /** Quiet period after the man finishes before the next woman. */
  cycleMin: 180,
  cycleMax: 300,
} as const;

const STREET_CALL_LEVEL = 0.72;

export interface StreetCallEvent {
  kind: StreetCallKind;
}

/** Pure trigger / cooldown logic (unit-tested). `t` is seconds. */
export class StreetCallScheduler {
  private startedAt: number | null = null;
  private nextWomanAt: number | null = null;
  private pendingManAt: number | null = null;

  constructor(private readonly rand: () => number = Math.random) {}

  private between(min: number, max: number): number {
    return min + this.rand() * (max - min);
  }

  /**
   * `durations` are the decoded clip lengths in seconds (woman, then man).
   * The man is scheduled from when the woman *finishes*, plus a short gap.
   */
  step(t: number, durations: { woman: number; man: number }): StreetCallEvent | null {
    const T = STREET_CALL_TIMING;
    if (this.startedAt === null) {
      this.startedAt = t;
      this.nextWomanAt = t + this.between(T.firstMin, T.firstMax);
    }
    if (this.pendingManAt !== null && t >= this.pendingManAt) {
      this.pendingManAt = null;
      this.nextWomanAt = t + Math.max(0.5, durations.man) + this.between(T.cycleMin, T.cycleMax);
      return { kind: "man" };
    }
    if (this.nextWomanAt !== null && t >= this.nextWomanAt) {
      this.nextWomanAt = null;
      this.pendingManAt = t + Math.max(0.5, durations.woman) + this.between(T.manGapMin, T.manGapMax);
      return { kind: "woman" };
    }
    return null;
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

  update(_state: DriveState, t: number) {
    if (this.disposed) return;
    const woman = this.buffers.woman;
    const man = this.buffers.man;
    if (!woman || !man) return;
    const ev = this.scheduler.step(t, { woman: woman.duration, man: man.duration });
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
