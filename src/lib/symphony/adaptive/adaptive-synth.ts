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
import { hallImpulseData } from "./hall-impulse";
import { readGpsAltitude } from "./altitude-store";
import { chooseAltitude, fuseAcceleration, readPhoneSample } from "@/lib/phone-sync/fusion";
import { isAutoDj, publishActiveGenre, resolveGenre, subscribeGenreChoice } from "./genre-store";
import { crossfadeBars, equalPowerCurves, genreTempo, nextAutoDjDelay, pickNextGenre, AUTO_DJ_INTERVAL_SEC } from "./auto-dj";
import { MUSIC_BANK, musicBankUrl, pickSample } from "./sample-bank";
import { createTimeline, type NoteEvent, type Timeline } from "./timeline";

const LOOKAHEAD_SEC = 0.35;
const MAX_VOICES = 56;

interface LoadedSprite {
  buffer: AudioBuffer;
  /** onset (s) inside each slot */
  onsets: number[];
}

/** One playing arrangement. Auto DJ runs two of them during a crossfade. */
interface Deck {
  timeline: Timeline;
  genreId: GenreId;
  /** crossfade gain -> high-pass -> low-pass -> music bus (both filters parked wide open) */
  gain: GainNode;
  hp: BiquadFilterNode;
  lp: BiquadFilterNode;
  /** trumpet FX send tap (post-fader twin of `gain`, so the wet tail crossfades with the deck); null when unused */
  send: GainNode | null;
  /** stop scheduling notes at this audio time (outgoing deck) */
  until: number;
  /** disconnect the deck nodes after this audio time */
  disposeAt: number;
}

let autoDjRange: readonly [number, number] = AUTO_DJ_INTERVAL_SEC;
/** Demo/QA hook: shorten the Auto DJ interval (seconds). Pass null to restore 2-3 min. */
export function setAutoDjIntervalForDemo(range: readonly [number, number] | null) {
  autoDjRange = range ?? AUTO_DJ_INTERVAL_SEC;
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
  private verbSend: GainNode | null = null;
  private verb: ConvolverNode | null = null;
  /** trumpet-only FX bus (warm hall + tempo-synced dotted-8th echo); built once per profile start, on first need */
  private tfx: TrumpetFx | null = null;
  private voices: { src: AudioBufferSourceNode; end: number }[] = [];
  private deck: Deck | null = null;
  private outgoing: Deck[] = [];
  private profileId = "";
  private autoDj = false;
  private nextSwitchAt = 0;
  private pendingSwitch: { target: GenreId; bpm: number } | null = null;
  private publishAt = 0;
  private publishGenre: GenreId | null = null;
  private recent: GenreId[] = [];
  private rand: () => number = Math.random;
  private unsub: (() => void) | null = null;
  private lastTs = 0;
  private seed = 1;
  private late = 0;
  private genreId: GenreId = "classic";

  build(
    ctx: BaseAudioContext,
    profile: SoundProfile,
    buses: StrategyBuses,
    seed?: number,
  ): boolean {
    this.dispose();
    this.ctx = ctx;
    this.seed = seed ?? 1;
    this.genreId = resolveGenre(profile.id);
    const g = GENRES[this.genreId];
    this.conductor = createConductor({ bpmMin: g.bpmMin, bpmMax: g.bpmMax });
    const start = ("currentTime" in ctx ? ctx.currentTime : 0) + 0.1;
    this.timeline = createTimeline(this.genreId, start, this.seed);
    this.profileId = profile.id;
    let r = (this.seed * 2654435761) >>> 0 || 1;
    this.rand = () => ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296);
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
    this.deck = this.makeDeck(ctx, this.timeline, this.genreId);
    this.recent = [this.genreId];
    this.autoDj = isAutoDj(profile.id);
    this.nextSwitchAt = start + nextAutoDjDelay(this.rand, autoDjRange);
    publishActiveGenre(this.genreId);
    this.filter.connect(this.shelf);
    this.shelf.connect(buses.body);
    // concert-hall reverb send: impulse generated on the device (decaying filtered noise)
    try {
      this.verb = ctx.createConvolver();
      this.verb.buffer = hallImpulse(ctx, 2.8);
      this.verbSend = ctx.createGain();
      this.verbSend.gain.value = g.reverb ?? 0.12;
      this.shelf.connect(this.verbSend);
      this.verbSend.connect(this.verb);
      this.verb.connect(buses.body);
    } catch {
      this.verb = null;
      this.verbSend = null;
    }

    this.unsub = subscribeGenreChoice(() => {
      this.autoDj = isAutoDj(profile.id);
      if (this.autoDj && this.ctx) this.nextSwitchAt = this.ctx.currentTime + nextAutoDjDelay(this.rand, autoDjRange);
      const next = resolveGenre(profile.id);
      if (next === this.genreId) return;
      this.setGenre(next);
    });
    void preloadMusicBank(ctx);
    return true;
  }

  /** Scale the music bus (default 0.55), e.g. for a background bed under a profile. */
  setLevel(level: number) {
    if (this.bus) this.bus.gain.value = Math.max(0, level);
  }

  /** Smoothly move the music bus level (state changes only, not per frame). */
  rampLevel(level: number, at: number, tau = 0.5) {
    if (!this.bus) return;
    const g = this.bus.gain;
    g.cancelScheduledValues(at);
    g.setValueAtTime(g.value, at);
    g.setTargetAtTime(Math.max(0, level), at, tau);
  }

  /** Manual pick: switch on the next bar line (no crossfade) and cancel any Auto DJ mix. */
  setGenre(id: GenreId) {
    this.genreId = id;
    this.pendingSwitch = null;
    this.timeline?.releaseTempo();
    this.timeline?.setGenre(id);
    if (this.deck) {
      this.deck.genreId = id;
      if (GENRES[id].mix["trumpet"] && !this.deck.send && this.ctx) {
        const fx = this.ensureTrumpetFx(this.ctx);
        if (fx) {
          this.deck.send = this.ctx.createGain();
          this.deck.send.connect(fx.input);
        }
      }
    }
    publishActiveGenre(id);
    this.conductor?.setRange({ bpmMin: GENRES[id].bpmMin, bpmMax: GENRES[id].bpmMax });
    this.setReverb(GENRES[id].reverb);
  }

  private setReverb(amount = 0.12) {
    if (!this.ctx || !this.verbSend) return;
    try {
      this.verbSend.gain.setTargetAtTime(amount, this.ctx.currentTime, 0.8);
    } catch {
      /* */
    }
  }

  update(state: DriveState, audioTime: number) {
    if (!this.ctx || !this.conductor || !this.timeline || !this.bus || !this.filter) return;
    const dt =
      this.lastTs > 0
        ? Math.min(0.25, Math.max(0.001, (state.timestamp - this.lastTs) / 1000))
        : 1 / 60;
    this.lastTs = state.timestamp || this.lastTs;
    this.lastEnergy = this.energy?.update(state, dt) ?? null;
    const phone = readPhoneSample();
    const alt = chooseAltitude(
      readGpsAltitude(),
      phone ? { altitude: phone.altitude, accuracy: phone.altitudeAccuracy } : null,
    );
    const cs = this.conductor.update({
      speed: state.speed,
      acceleration: fuseAcceleration(
        state.accelerationEstimated ?? state.acceleration,
        phone?.longAccel,
      ),
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
    const until = audioTime + LOOKAHEAD_SEC;
    for (const d of this.outgoing) {
      if (until <= d.until) for (const ev of d.timeline.scheduleUntil(Math.min(until, d.until), cs)) this.play(ev, audioTime, d);
    }
    const deck = this.deck!;
    for (const ev of this.timeline.scheduleUntil(until, cs)) this.play(ev, audioTime, deck);
    this.autoDjTick(audioTime, cs.bpm);
    if (this.tfx) syncEcho(this.tfx, this.timeline.bpm, audioTime);
    this.reapDecks(audioTime);
  }

  private makeDeck(ctx: BaseAudioContext, timeline: Timeline, genreId: GenreId): Deck {
    const gain = ctx.createGain();
    gain.gain.value = 1;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 20;
    hp.Q.value = 0.7;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 20000;
    lp.Q.value = 0.7;
    gain.connect(hp);
    hp.connect(lp);
    lp.connect(this.bus!);
    let send: GainNode | null = null;
    if (GENRES[genreId].mix["trumpet"]) {
      const fx = this.ensureTrumpetFx(ctx);
      if (fx) {
        send = ctx.createGain();
        send.gain.value = 1;
        send.connect(fx.input);
      }
    }
    return { timeline, genreId, gain, send, hp, lp, until: Infinity, disposeAt: Infinity };
  }

  private ensureTrumpetFx(ctx: BaseAudioContext): TrumpetFx | null {
    if (this.tfx || !this.bus) return this.tfx;
    try {
      this.tfx = buildTrumpetFx(ctx, this.bus, this.timeline?.bpm ?? 120);
    } catch {
      this.tfx = null;
    }
    return this.tfx;
  }

  /** Auto DJ: pick, beat-match, then crossfade on the bar line. Only schedules AudioParam ramps. */
  private autoDjTick(now: number, bpm: number) {
    if (this.publishGenre && now >= this.publishAt) {
      publishActiveGenre(this.publishGenre);
      this.publishGenre = null;
    }
    if (!this.autoDj || !this.deck || !this.ctx || this.outgoing.length) return;
    if (!this.pendingSwitch) {
      if (now < this.nextSwitchAt) return;
      const cur = this.deck.timeline.bpm || bpm;
      const target = pickNextGenre(this.deck.genreId, cur, this.recent, this.rand);
      if (target === this.deck.genreId) {
        this.nextSwitchAt = now + nextAutoDjDelay(this.rand, autoDjRange);
        return;
      }
      const tBpm = genreTempo(target, cur);
      this.pendingSwitch = { target, bpm: tBpm };
      this.deck.timeline.rampTempo(tBpm);
      // give the pitch ride ~2 bars (longer for big tempo gaps) before the mix starts
      this.deck.timeline.requestHandoff(Math.min(4, 2 + Math.floor(Math.abs(tBpm - cur) / 13)));
      return;
    }
    const h = this.deck.timeline.takeHandoff();
    if (!h) return;
    this.startCrossfade(this.pendingSwitch.target, h);
    this.pendingSwitch = null;
  }

  private startCrossfade(target: GenreId, h: { time: number; barDur: number; bpm: number }) {
    const ctx = this.ctx!;
    const old = this.deck!;
    const tl = createTimeline(target, h.time, this.seed + this.recent.length);
    tl.lockTempo(h.bpm);
    tl.releaseTempo(); // glide on to the new genre's own tempo
    const inc = this.makeDeck(ctx, tl, target);
    const D = crossfadeBars(h.barDur) * h.barDur;
    const t0 = h.time;
    const curves = equalPowerCurves();
    try {
      // equal-power crossfade
      old.gain.gain.cancelScheduledValues(t0);
      old.gain.gain.setValueAtTime(1, t0);
      old.gain.gain.setValueCurveAtTime(curves.out, t0, D);
      inc.gain.gain.setValueAtTime(0, 0);
      inc.gain.gain.setValueCurveAtTime(curves.in, t0, D);
      if (old.send) {
        old.send.gain.cancelScheduledValues(t0);
        old.send.gain.setValueAtTime(1, t0);
        old.send.gain.setValueCurveAtTime(curves.out, t0, D);
      }
      if (inc.send) {
        inc.send.gain.setValueAtTime(0, 0);
        inc.send.gain.setValueCurveAtTime(curves.in, t0, D);
      }
      // outgoing: high-pass sweep pulls the bass out (classic DJ bass swap) with a resonant edge
      old.hp.Q.setValueAtTime(0.7, t0);
      old.hp.Q.linearRampToValueAtTime(4, t0 + D * 0.8);
      old.hp.frequency.setValueAtTime(20, t0);
      old.hp.frequency.exponentialRampToValueAtTime(1400, t0 + D);
      // incoming: opens from a low-pass, ends fully open
      inc.lp.Q.setValueAtTime(3, 0);
      inc.lp.Q.setValueAtTime(3, t0);
      inc.lp.Q.linearRampToValueAtTime(0.7, t0 + D * 0.6);
      inc.lp.frequency.setValueAtTime(320, 0);
      inc.lp.frequency.setValueAtTime(320, t0);
      inc.lp.frequency.exponentialRampToValueAtTime(20000, t0 + D * 0.6);
    } catch {
      this.late += 1;
    }
    old.until = t0 + D;
    old.disposeAt = t0 + D + 3; // let the last notes and their releases finish
    this.outgoing.push(old);
    this.deck = inc;
    this.timeline = tl;
    this.genreId = target;
    this.recent = [...this.recent, target].slice(-4);
    const nd = GENRES[target];
    this.conductor?.setRange({ bpmMin: nd.bpmMin, bpmMax: nd.bpmMax });
    this.setReverb(nd.reverb);
    this.publishGenre = target;
    this.publishAt = t0 + D / 2;
    this.nextSwitchAt = t0 + D + nextAutoDjDelay(this.rand, autoDjRange);
  }

  private reapDecks(now: number) {
    if (!this.outgoing.length) return;
    this.outgoing = this.outgoing.filter((d) => {
      if (now < d.disposeAt) return true;
      try {
        d.gain.disconnect();
        d.send?.disconnect();
        d.hp.disconnect();
        d.lp.disconnect();
      } catch {
        /* */
      }
      return false;
    });
  }

  private play(ev: NoteEvent, now: number, deck: Deck) {
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
    const mix = GENRES[deck.genreId].mix[ev.inst] ?? 0.4;
    const gain = ev.vel * ev.vel * mix * ref.norm;
    const src = ctx.createBufferSource();
    src.buffer = sprite.buffer;
    src.playbackRate.value = ref.rate * (ev.detune ? Math.pow(2, ev.detune / 1200) : 1);
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
    tail.connect(deck.gain);
    if (deck.send && ev.inst === "trumpet") tail.connect(deck.send);
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
    return cs
      ? { ...base, energy: cs.intensity, movementState: movementFor(cs.mode, cs.intensity) }
      : base;
  }

  getDiagnosticsAt(_audioTime: number): SymphonyDiagnostics {
    const cs = this.conductor?.snapshot();
    const steps = this.timeline?.stepCount ?? 0;
    return {
      packId: `adaptive-${this.genreId}`,
      bpm: cs?.bpm ?? 0,
      bar: this.timeline?.bar ?? Math.floor(steps / 16),
      beat: Math.floor((steps % (GENRES[this.genreId].stepsPerBar ?? 16)) / 4),
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
    for (const d of [this.deck, ...this.outgoing]) {
      try {
        d?.gain.disconnect();
        d?.send?.disconnect();
        d?.hp.disconnect();
        d?.lp.disconnect();
      } catch {
        /* */
      }
    }
    this.deck = null;
    this.outgoing = [];
    this.pendingSwitch = null;
    this.publishGenre = null;
    for (const n of [this.bus, this.filter, this.shelf, this.verbSend, this.verb]) {
      try {
        n?.disconnect();
      } catch {
        /* */
      }
    }
    this.bus = this.filter = this.shelf = null;
    this.verbSend = null;
    this.verb = null;
    for (const n of this.tfx?.nodes ?? []) {
      try {
        n.disconnect();
      } catch {
        /* */
      }
    }
    this.tfx = null;
    this.conductor = null;
    this.timeline = null;
    this.energy = null;
    this.lastEnergy = null;
    this.ctx = null;
    this.lastTs = 0;
  }
}

function hallImpulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const [l, r] = hallImpulseData(ctx.sampleRate, seconds);
  const buf = ctx.createBuffer(2, l.length, ctx.sampleRate);
  buf.getChannelData(0).set(l);
  buf.getChannelData(1).set(r);
  return buf;
}

/** Trumpet send: 300 Hz high-pass (no mud) feeding a 2.3 s warm hall (~33 % wet) and a dotted-8th
 *  echo (fb 0.3, 3.5 kHz low-passed in the loop, ~22 % wet). Mono delay + decorrelated hall = mono-safe. */
interface TrumpetFx {
  input: GainNode;
  delay: DelayNode;
  nodes: AudioNode[];
}
export const TRUMPET_FX = { reverbSec: 2.3, reverbWet: 0.33, echoWet: 0.22, feedback: 0.3, echoLp: 3500, hp: 300, beats: 0.75 } as const;
export function echoSeconds(bpm: number) {
  return (TRUMPET_FX.beats * 60) / Math.max(40, bpm);
}
function buildTrumpetFx(ctx: BaseAudioContext, out: AudioNode, bpm: number): TrumpetFx {
  const input = ctx.createGain();
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = TRUMPET_FX.hp;
  hp.Q.value = 0.6;
  input.connect(hp);
  // warm hall
  const verbIn = ctx.createGain();
  verbIn.gain.value = TRUMPET_FX.reverbWet;
  const verb = ctx.createConvolver();
  verb.buffer = hallImpulse(ctx, TRUMPET_FX.reverbSec);
  const warm = ctx.createBiquadFilter();
  warm.type = "lowpass";
  warm.frequency.value = 5200;
  warm.Q.value = 0.5;
  hp.connect(verbIn);
  verbIn.connect(verb);
  verb.connect(warm);
  warm.connect(out);
  // tempo-synced echo
  const echoIn = ctx.createGain();
  echoIn.gain.value = TRUMPET_FX.echoWet;
  const delay = ctx.createDelay(2);
  delay.delayTime.value = echoSeconds(bpm);
  const loopLp = ctx.createBiquadFilter();
  loopLp.type = "lowpass";
  loopLp.frequency.value = TRUMPET_FX.echoLp;
  loopLp.Q.value = 0.5;
  const fb = ctx.createGain();
  fb.gain.value = TRUMPET_FX.feedback;
  hp.connect(echoIn);
  echoIn.connect(delay);
  delay.connect(loopLp);
  loopLp.connect(fb);
  fb.connect(delay);
  loopLp.connect(out);
  // echoes bloom into the hall a little, so repeats sit in the same room
  const echoToVerb = ctx.createGain();
  echoToVerb.gain.value = 0.35;
  loopLp.connect(echoToVerb);
  echoToVerb.connect(verb);
  return { input, delay, nodes: [input, hp, verbIn, verb, warm, echoIn, delay, loopLp, fb, echoToVerb] };
}
function syncEcho(fx: TrumpetFx, bpm: number, now: number) {
  const want = echoSeconds(bpm);
  if (Math.abs(fx.delay.delayTime.value - want) > 0.004) fx.delay.delayTime.setTargetAtTime(want, now, 0.3);
}
