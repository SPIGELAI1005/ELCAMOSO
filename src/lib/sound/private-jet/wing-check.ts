/**
 * Private Jet Oberpfaffenhofen: pre-flight wing check while parked.
 *
 * Every 10-18 s while the car stands still, the flaps run out and back in (or the
 * ailerons twitch): an electro-hydraulic actuator whine that glides up under load,
 * a soft mechanical stop clunk at the end of travel, then the return stroke.
 * Heard from inside the cabin: band-limited and well under the idle wind bed.
 * Stops (short fade) the moment the car moves; re-arms after a few seconds parked.
 *
 * Built from one-shot nodes only while a check plays; the noise for the clunk is a
 * small locally seeded buffer (does not touch the shared audioRandom stream).
 */
import type { DriveState } from "@/lib/drive/model";

export const WING_CHECK_PARKED_KMH = 2;
/** Seconds parked before the first check. */
export const WING_CHECK_FIRST_S = 2.5;
export const WING_CHECK_EVERY_S: readonly [number, number] = [10, 18];
export const WING_CHECK_LEVEL = 0.16;

export type WingCheckKind = "flaps" | "ailerons";

export interface WingCheckStroke {
  /** start offset (s) from the check start */
  at: number;
  dur: number;
  /** actuator motor pitch (Hz) at start / end of the stroke */
  fromHz: number;
  toHz: number;
  level: number;
  clunk: number;
}

/** Deterministic stroke plan for one check (r = 0..1 random draws). */
export function wingCheckPlan(kind: WingCheckKind, r: () => number): WingCheckStroke[] {
  if (kind === "ailerons") {
    const a = 0.32 + r() * 0.1;
    return [0, 1, 2, 3].map((i) => ({
      at: i * (a + 0.22),
      dur: a,
      fromHz: 190 + (i % 2) * 15,
      toHz: 235 + (i % 2) * 15,
      level: 0.6,
      clunk: 0.35,
    }));
  }
  const extend = 1.7 + r() * 0.7;
  const pause = 0.7 + r() * 0.6;
  const retract = extend * (0.85 + r() * 0.1);
  return [
    { at: 0, dur: extend, fromHz: 150, toHz: 205, level: 1, clunk: 1 },
    { at: extend + pause, dur: retract, fromHz: 165, toHz: 190, level: 0.85, clunk: 0.8 },
  ];
}

export interface WingCheckVoice {
  update(state: DriveState, t: number): void;
  dispose(): void;
  diagnostics(): { checks: number; playing: boolean; nextAt: number | null };
}

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function createWingCheckVoice(
  ctx: BaseAudioContext,
  destination: AudioNode,
  seed = 20261124,
): WingCheckVoice {
  const rand = lcg(seed);
  // Cabin perspective: band-limit the actuators.
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 70;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2800;
  lp.Q.value = 0.6;
  const out = ctx.createGain();
  out.gain.value = WING_CHECK_LEVEL;
  hp.connect(lp);
  lp.connect(out);
  out.connect(destination);

  const noiseLen = Math.floor(ctx.sampleRate * 0.4);
  const noise = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
  {
    const d = noise.getChannelData(0);
    const nr = lcg(seed ^ 0x5bd1e995);
    for (let i = 0; i < noiseLen; i++) d[i] = nr() * 2 - 1;
  }

  let parkedFor = 0;
  let nextAt: number | null = null;
  let lastT: number | null = null;
  let checks = 0;
  let playingUntil = 0;
  let active: { nodes: AudioScheduledSourceNode[]; bus: GainNode } | null = null;
  let disposed = false;

  const stopActive = (t: number) => {
    if (!active) return;
    const a = active;
    active = null;
    playingUntil = 0;
    a.bus.gain.cancelScheduledValues(t);
    a.bus.gain.setTargetAtTime(0, t, 0.05);
    for (const n of a.nodes) {
      try {
        n.stop(t + 0.3);
      } catch {
        /* already stopped */
      }
    }
  };

  const playCheck = (t: number) => {
    const kind: WingCheckKind = rand() < 0.7 ? "flaps" : "ailerons";
    const plan = wingCheckPlan(kind, rand);
    const bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(hp);
    const nodes: AudioScheduledSourceNode[] = [];
    let end = t;
    for (const s of plan) {
      const t0 = t + s.at;
      const t1 = t0 + s.dur;
      // Actuator motor: buzzy saw + its octave through a resonant band (gear whine).
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(s.level, t0 + 0.08);
      env.gain.setValueAtTime(s.level, t1 - 0.1);
      env.gain.linearRampToValueAtTime(0.0001, t1);
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.Q.value = 2.4;
      band.frequency.setValueAtTime(s.fromHz * 4, t0);
      band.frequency.linearRampToValueAtTime(s.toHz * 4, t1);
      band.connect(env);
      env.connect(bus);
      for (const [type, mul, lvl] of [
        ["sawtooth", 1, 0.5],
        ["triangle", 2, 0.35],
      ] as const) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(s.fromHz * mul, t0);
        o.frequency.linearRampToValueAtTime(s.toHz * mul, t1);
        const g = ctx.createGain();
        g.gain.value = lvl;
        o.connect(g);
        g.connect(band);
        o.start(t0);
        o.stop(t1 + 0.05);
        nodes.push(o);
      }
      // End-of-travel stop: low lowpassed knock + short thump.
      if (s.clunk > 0) {
        const n = ctx.createBufferSource();
        n.buffer = noise;
        const nl = ctx.createBiquadFilter();
        nl.type = "lowpass";
        nl.frequency.value = 420;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.0001, t1);
        ng.gain.linearRampToValueAtTime(0.9 * s.clunk, t1 + 0.004);
        ng.gain.setTargetAtTime(0.0001, t1 + 0.004, 0.035);
        n.connect(nl);
        nl.connect(ng);
        ng.connect(bus);
        n.start(t1, rand() * 0.2, 0.18);
        nodes.push(n);
        const th = ctx.createOscillator();
        th.type = "sine";
        th.frequency.setValueAtTime(95, t1);
        th.frequency.exponentialRampToValueAtTime(55, t1 + 0.12);
        const tg = ctx.createGain();
        tg.gain.setValueAtTime(0.0001, t1);
        tg.gain.linearRampToValueAtTime(0.7 * s.clunk, t1 + 0.006);
        tg.gain.setTargetAtTime(0.0001, t1 + 0.006, 0.05);
        th.connect(tg);
        tg.connect(bus);
        th.start(t1);
        th.stop(t1 + 0.3);
        nodes.push(th);
      }
      end = Math.max(end, t1 + 0.3);
    }
    active = { nodes, bus };
    playingUntil = end;
    checks += 1;
    const [lo, hi] = WING_CHECK_EVERY_S;
    nextAt = end + lo + rand() * (hi - lo);
    const mine = active;
    nodes[nodes.length - 1]!.onended = () => {
      if (active === mine) active = null;
      setTimeout(() => bus.disconnect(), 0);
    };
  };

  return {
    update(state, t) {
      if (disposed) return;
      const dt = lastT === null ? 0 : Math.min(0.25, Math.max(0, t - lastT));
      lastT = t;
      const kmh = Math.max(0, state.speed || 0) * 3.6;
      const parked = kmh < WING_CHECK_PARKED_KMH && (state.throttle ?? 0) < 0.25;
      if (!parked) {
        parkedFor = 0;
        nextAt = null;
        stopActive(t);
        return;
      }
      parkedFor += dt;
      if (nextAt === null && parkedFor >= WING_CHECK_FIRST_S) nextAt = t;
      if (nextAt !== null && t >= nextAt && t >= playingUntil) playCheck(t);
    },
    diagnostics: () => ({ checks, playing: lastT !== null && lastT < playingUntil, nextAt }),
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        const t = ctx.currentTime;
        stopActive(t);
        out.gain.setTargetAtTime(0, t, 0.05);
      } catch {
        /* closed context */
      }
      setTimeout(() => out.disconnect(), 400);
    },
  };
}
