/**
 * AdaptiveMusicSynth - plays the conductor/timeline output with preloaded note sprites.
 * Same public surface as SymphonySynth so the engine can swap it in for music profiles.
 */
import type { DriveState } from "@/lib/drive/model";
import type { StrategyBuses } from "@/lib/sound/realism/types";
import type { SoundProfile } from "@/lib/sound/profiles";
import { fetchBytesWithRetry } from "@/lib/sound/fetch-bytes";
import { createDriveEnergyTracker, type DriveEnergyTracker } from "../drive-energy";
import type { DriveEnergyState, MovementState, SymphonyDiagnostics } from "../types";
import { createConductor, cutoffForBrightness, type Conductor, type MusicMode } from "./conductor";
import { GENRES, type GenreId } from "./genres";
import { readGpsAltitude } from "./altitude-store";
import { resolveGenre, subscribeGenreChoice } from "./genre-store";
import { MUSIC_BANK, musicBankUrl, pickSample } from "./sample-bank";
import { createTimeline, type NoteEvent, type Timeline } from "./timeline";

const LOOKAHEAD_SEC = 0.35;
const MAX_VOICES = 56;

interface LoadedSprite {
  buffer: AudioBuffer;
  /** onset (s) inside each slot */
  onsets: number[];
}

const bank = new Map<string, LoadedSprite>();
let loading: Promise<void> | null = null;

function findOnsets(buffer: AudioBuffer, inst: string): number[] {
  const s = MUSIC_BANK[inst]!;
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  return s.notes.map((_, i) => {
    const start = Math.floor(i * s.slot * sr);
    const end = Math.min(data.length, start + Math.floor(0.4 * sr));
    let peak = 0;
    for (let j = start; j < end; j++) peak = Math.max(peak, Math.abs(data[j]!));
    const thr = peak * 0.02;
    for (let j = start; j < end; j++) {
      if (Math.abs(data[j]!) > thr) return Math.max(0, (j - start) / sr - 0.003);
    }
    return s.lead;
  });
}

/** Fetch + decode every sprite once (served from the service-worker cache after install). */
export function preloadMusicBank(ctx: BaseAudioContext): Promise<void> {
  if (loading) return loading;
  loading = Promise.all(
    Object.keys(MUSIC_BANK).map(async (inst) => {
      if (bank.has(inst)) return;
      try {
        const bytes = await fetchBytesWithRetry(musicBankUrl(inst), "music");
        const buffer = await ctx.decodeAudioData(bytes.slice(0));
        bank.set(inst, { buffer, onsets: findOnsets(buffer, inst) });
      } catch {
        /* missing sprite: its notes are skipped */
      }
    }),
  ).then(() => {
    if (bank.size === 0) loading = null; // allow a later retry
  });
  return loading;
}

export function isMusicBankReady() {
  return bank.size === Object.keys(MUSIC_BANK).length;
}

function movementFor(mode: MusicMode, intensity: number): MovementState {
  switch (mode) {
    case "stopped":
      return "stopped";
    case "brake":
      return "decelerating";
    case "cruise":
      return "cruise";
    case "surge":
      return intensity > 0.75 ? "peak" : "building";
    default:
      return intensity > 0.6 ? "energetic" : "calm";
  }
}

export class AdaptiveMusicSynth {
  private ctx: BaseAudioContext | null = null;
  private conductor: Conductor | null = null;
  private timeline: Timeline | null = null;
  private energy: DriveEnergyTracker | null = null;
  private lastEnergy: DriveEnergyState | null = null;
  private bus: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private shelf: BiquadFilterNode | null = null;
  private voices: { src: AudioBufferSourceNode; end: number }[] = [];
  private unsub: (() => void) | null = null;
  private lastTs = 0;
  private seed = 1;
  private late = 0;
  private genreId: GenreId = "classic";

  build(ctx: BaseAudioContext, profile: SoundProfile, buses: StrategyBuses, seed?: number): boolean {
    this.dispose();
    this.ctx = ctx;
    this.seed = seed ?? 1;
    this.genreId = resolveGenre(profile.id);
    const g = GENRES[this.genreId];
    this.conductor = createConductor({ bpmMin: g.bpmMin, bpmMax: g.bpmMax });
    const start = ("currentTime" in ctx ? ctx.currentTime : 0) + 0.1;
    this.timeline = createTimeline(this.genreId, start, this.seed);
    this.energy = createDriveEnergyTracker();

    this.bus = ctx.createGain();
    this.bus.gain.value = 0.55;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.Q.value = 0.6;
    this.filter.frequency.value = cutoffForBrightness(0.5);
    this.shelf = ctx.createBiquadFilter();
    this.shelf.type = "lowshelf";
    this.shelf.frequency.value = 70;
    this.shelf.gain.value = -6;
    this.bus.connect(this.filter);
    this.filter.connect(this.shelf);
    this.shelf.connect(buses.body);

    this.unsub = subscribeGenreChoice(() => {
      const next = resolveGenre(profile.id);
      if (next === this.genreId) return;
      this.genreId = next;
      this.timeline?.setGenre(next);
      const nd = GENRES[next];
      this.conductor?.setRange({ bpmMin: nd.bpmMin, bpmMax: nd.bpmMax });
    });
    void preloadMusicBank(ctx);
    return true;
  }

  setGenre(id: GenreId) {
    this.genreId = id;
    this.timeline?.setGenre(id);
    this.conductor?.setRange({ bpmMin: GENRES[id].bpmMin, bpmMax: GENRES[id].bpmMax });
  }

  update(state: DriveState, audioTime: number) {
    if (!this.ctx || !this.conductor || !this.timeline || !this.bus || !this.filter) return;
    const dt =
      this.lastTs > 0 ? Math.min(0.25, Math.max(0.001, (state.timestamp - this.lastTs) / 1000)) : 1 / 60;
    this.lastTs = state.timestamp || this.lastTs;
    this.lastEnergy = this.energy?.update(state, dt) ?? null;
    const alt = readGpsAltitude();
    const cs = this.conductor.update({
      speed: state.speed,
      acceleration: state.accelerationEstimated ?? state.acceleration,
      throttle: state.throttle,
      regen: state.regen,
      gear: state.powertrain?.gear ?? state.gear,
      dt,
      altitude: alt.altitude,
      altitudeAccuracy: alt.accuracy,
    });
    this.timeline.pushAccents(this.conductor.drainAccents());
    this.timeline.resync(audioTime);
    try {
      this.filter.frequency.setTargetAtTime(cutoffForBrightness(cs.brightness), audioTime, 0.15);
    } catch {
      this.late += 1;
    }
    const events = this.timeline.scheduleUntil(audioTime + LOOKAHEAD_SEC, cs);
    for (const ev of events) this.play(ev, audioTime);
  }

  private play(ev: NoteEvent, now: number) {
    const ctx = this.ctx!;
    const sprite = bank.get(ev.inst);
    const ref = pickSample(ev.inst, ev.midi);
    if (!sprite || !ref) return;
    const t = Math.max(ev.time, now);
    this.voices = this.voices.filter((v) => v.end > now);
    if (this.voices.length >= MAX_VOICES) return;
    const slotIdx = Math.round(ref.slotStart / ref.slotLen);
    const offset = ref.slotStart + (sprite.onsets[slotIdx] ?? 0);
    const playable = (ref.slotLen - (sprite.onsets[slotIdx] ?? 0) - 0.02) / ref.rate;
    const dur = Math.min(ev.dur + 0.25, playable);
    const mix = GENRES[this.genreId].mix[ev.inst] ?? 0.4;
    const gain = ev.vel * ev.vel * mix * ref.norm;
    const src = ctx.createBufferSource();
    src.buffer = sprite.buffer;
    src.playbackRate.value = ref.rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.setTargetAtTime(0, t + Math.min(ev.dur, dur), 0.08);
    let tail: AudioNode = g;
    if (ev.pan && "createStereoPanner" in ctx) {
      const p = ctx.createStereoPanner();
      p.pan.value = ev.pan;
      g.connect(p);
      tail = p;
    }
    src.connect(g);
    tail.connect(this.bus!);
    try {
      src.start(t, offset);
      src.stop(t + dur + 0.35);
    } catch {
      this.late += 1;
      return;
    }
    src.onended = () => {
      try {
        src.disconnect();
        g.disconnect();
        tail.disconnect();
      } catch {
        /* */
      }
    };
    this.voices.push({ src, end: t + dur + 0.35 });
  }

  getEnergy(): DriveEnergyState | null {
    if (!this.lastEnergy && !this.energy) return null;
    const base = this.lastEnergy ?? this.energy!.snapshot();
    const cs = this.conductor?.snapshot();
    return cs ? { ...base, energy: cs.intensity, movementState: movementFor(cs.mode, cs.intensity) } : base;
  }

  getDiagnosticsAt(_audioTime: number): SymphonyDiagnostics {
    const cs = this.conductor?.snapshot();
    const steps = this.timeline?.stepCount ?? 0;
    return {
      packId: `adaptive-${this.genreId}`,
      bpm: cs?.bpm ?? 0,
      bar: Math.floor(steps / 16),
      beat: Math.floor((steps % 16) / 4),
      energy: cs?.intensity ?? 0,
      movementState: cs ? movementFor(cs.mode, cs.intensity) : "stopped",
      activeStems: [],
      nextTransitionAt: null,
      pendingEvents: 0,
      bufferReady: isMusicBankReady(),
      seed: this.seed,
      lateEvents: this.late,
      lookaheadSec: LOOKAHEAD_SEC,
    };
  }

  getDiagnostics(): SymphonyDiagnostics {
    return this.getDiagnosticsAt(0);
  }

  getConductorState() {
    return this.conductor?.snapshot() ?? null;
  }

  dispose() {
    this.unsub?.();
    this.unsub = null;
    for (const v of this.voices) {
      try {
        v.src.stop();
      } catch {
        /* */
      }
    }
    this.voices = [];
    for (const n of [this.bus, this.filter, this.shelf]) {
      try {
        n?.disconnect();
      } catch {
        /* */
      }
    }
    this.bus = this.filter = this.shelf = null;
    this.conductor = null;
    this.timeline = null;
    this.energy = null;
    this.lastEnergy = null;
    this.ctx = null;
    this.lastTs = 0;
  }
}
