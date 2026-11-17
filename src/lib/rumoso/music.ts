/**
 * Light music adapter: maps RUMOSO effort 0–100 onto the existing Viral Epic
 * Party speed gates (as a synthetic km/h) and crossfades a small subset of
 * already-shipped loop stems. No worklets, no Drive/Symphony engine changes.
 */
import { gainsFromSpeedGates } from "@/lib/symphony/speed-layers";
import type { MovementState, StemGainTargets, StemId } from "@/lib/symphony/types";
import { VIRAL_MIX_PACK } from "@/lib/symphony/packs/viral-mix";
import type { SymphonyPack } from "@/lib/symphony/types";

/** Effort 0–100 maps onto the Viral Mix 0–130 km/h gate window. */
export const EFFORT_TO_KMH = 1.3;

export const RUMOSO_STEM_IDS: readonly StemId[] = [
  "drumsLow",
  "rhythm",
  "piano",
  "atmosphere",
  "bass",
  "kit",
  "brass",
  "lead",
];

export interface RumosoMusicProfile {
  id: string;
  name: string;
  tagline: string;
  pack: SymphonyPack;
  stemIds: readonly StemId[];
}

export const RUMOSO_MUSIC_PROFILES: readonly RumosoMusicProfile[] = [
  {
    id: VIRAL_MIX_PACK.id,
    name: VIRAL_MIX_PACK.name,
    tagline: VIRAL_MIX_PACK.tagline,
    pack: VIRAL_MIX_PACK,
    stemIds: RUMOSO_STEM_IDS,
  },
];

export function getRumosoMusicProfile(id: string): RumosoMusicProfile {
  return RUMOSO_MUSIC_PROFILES.find((p) => p.id === id) ?? RUMOSO_MUSIC_PROFILES[0]!;
}

export function effortToSpeedKmh(effort: number): number {
  const e = Number.isFinite(effort) ? Math.min(100, Math.max(0, effort)) : 0;
  return e * EFFORT_TO_KMH;
}

export function movementFromEffort(effort: number, dEffortPerSec: number): MovementState {
  if (effort < 8) return "stopped";
  if (dEffortPerSec <= -8) return "decelerating";
  if (effort >= 88) return "peak";
  if (dEffortPerSec >= 8 || effort >= 70) return "building";
  if (effort >= 50) return "energetic";
  if (effort >= 28) return "cruise";
  return "calm";
}

export function rumosoStemGains(effort: number, dEffortPerSec: number): StemGainTargets {
  const profile = RUMOSO_MUSIC_PROFILES[0]!;
  return gainsFromSpeedGates(
    profile.pack,
    effortToSpeedKmh(effort),
    movementFromEffort(effort, dEffortPerSec),
    effort / 100,
  );
}

const GAIN_TAU_S = 0.32;

export class RumosoMusicPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private duck: GainNode | null = null;
  private voices = new Map<StemId, { gain: GainNode; source: AudioBufferSourceNode }>();
  private started = false;
  private profileId = RUMOSO_MUSIC_PROFILES[0]!.id;

  get isStarted(): boolean {
    return this.started;
  }

  async start(ctx: AudioContext, profileId = this.profileId): Promise<void> {
    await this.stop();
    this.ctx = ctx;
    this.profileId = profileId;
    const profile = getRumosoMusicProfile(profileId);
    if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);

    const master = ctx.createGain();
    master.gain.value = 0.9;
    const duck = ctx.createGain();
    duck.gain.value = 1;
    duck.connect(master);
    master.connect(ctx.destination);
    this.master = master;
    this.duck = duck;

    const buffers = await Promise.all(
      profile.stemIds.map(async (id) => {
        const stem = profile.pack.stems.find((s) => s.id === id);
        const path = stem?.assetPath;
        if (!path) return null;
        const res = await fetch(path);
        if (!res.ok) return null;
        const buf = await res.arrayBuffer();
        const audio = await ctx.decodeAudioData(buf.slice(0));
        return { id, audio };
      }),
    );

    const t0 = ctx.currentTime + 0.05;
    for (const item of buffers) {
      if (!item) continue;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const source = ctx.createBufferSource();
      source.buffer = item.audio;
      source.loop = true;
      source.connect(gain);
      gain.connect(duck);
      source.start(t0);
      this.voices.set(item.id, { gain, source });
    }
    this.started = this.voices.size > 0;
    if (!this.started) throw new Error("RUMOSO music stems failed to load");
  }

  setEffort(effort: number, dEffortPerSec: number): void {
    if (!this.ctx || !this.started) return;
    const gains = rumosoStemGains(effort, dEffortPerSec);
    const t = this.ctx.currentTime;
    for (const [id, voice] of this.voices) {
      const target = Math.max(0, Math.min(1, gains[id] ?? 0));
      voice.gain.gain.cancelScheduledValues(t);
      voice.gain.gain.setTargetAtTime(target, t, GAIN_TAU_S);
    }
  }

  setDuck(active: boolean, attackS: number, releaseS: number, duckGain: number): void {
    if (!this.ctx || !this.duck) return;
    const t = this.ctx.currentTime;
    const param = this.duck.gain;
    param.cancelScheduledValues(t);
    param.setTargetAtTime(active ? duckGain : 1, t, active ? attackS : releaseS);
  }

  setMaster(gain: number): void {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(Math.max(0, Math.min(1, gain)), this.ctx.currentTime, 0.05);
  }

  async stop(): Promise<void> {
    for (const voice of this.voices.values()) {
      try {
        voice.source.stop();
      } catch {
        /* already stopped */
      }
      try {
        voice.source.disconnect();
        voice.gain.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.voices.clear();
    try {
      this.duck?.disconnect();
      this.master?.disconnect();
    } catch {
      /* ignore */
    }
    this.duck = null;
    this.master = null;
    this.started = false;
    // Do not close the context — the voice player may share it.
  }
}
