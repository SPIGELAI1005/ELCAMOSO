/**
 * American Muscle V8 "Coyote v2": one pre-rendered sound instead of two live engines.
 *
 * The bank (scripts/sound/coyote_v8_bank.py) holds seamless loops on an RPM x load grid
 * (light / on-load / overrun) plus one-shots (startup, bark, shifts, rev-match blip, pops)
 * in a single AAC file. At runtime this only crossfades a few looping
 * AudioBufferSourceNodes: the two RPM points around the current RPM, each with its three
 * phase-aligned load variants, and nudges their playback rate by at most ~±18 %.
 * Looping sources keep playing through main-thread stalls, and one-shots are scheduled
 * with start(when), so a busy car browser does not starve the audio.
 */
import type { DriveState } from "@/lib/drive/model";
import type { StrategyBuses } from "@/lib/sound/realism/types";
import { fetchBytesWithRetry } from "@/lib/sound/fetch-bytes";
import { audioRandom } from "@/lib/sound/rng";
import {
  COYOTE_BANK_URL,
  COYOTE_IDLE_RPM,
  COYOTE_MAX_RPM,
  COYOTE_RPM_POINTS,
  blendCoyoteLoopSeams,
  coyoteLoadTargets,
  coyoteLoopFor,
  coyoteLoopRate,
  coyoteOneShot,
  coyotePopCount,
  coyoteRpmWeights,
  type CoyoteLoad,
  type CoyoteLoadWeights,
} from "./model";

/** Output trim so the bank sits at the old V8's loudness through the shared master chain. */
export const COYOTE_OUTPUT_GAIN = 1.48;
/** Without the bank after this long, a tiny procedural idle loop covers until it arrives. */
export const COYOTE_FALLBACK_DELAY_MS = 1500;
/** Throttle must stay closed this long before a lift counts (not a shift's torque cut). */
const POP_LIFT_HOLD_S = 0.2;
/** No lift-off pops this soon after a gear change (no pop on every shift). */
const POP_SHIFT_GUARD_S = 0.8;
/** Minimum gap between pop clusters. */
const POP_COOLDOWN_S = 4;
/** Startup only plays when the bank is ready this soon after the profile was built. */
const STARTUP_WINDOW_S = 4;
const LOADS: readonly CoyoteLoad[] = ["light", "on", "over"];

interface PointVoice {
  index: number;
  rpm: number;
  sources: Record<CoyoteLoad, AudioBufferSourceNode>;
  loadGains: Record<CoyoteLoad, GainNode>;
  out: GainNode;
  lastRate: number;
  lastWeight: number;
  idleSince: number | null;
}

const bankCache = new Map<string, Promise<ArrayBuffer>>();

function fetchBank(url: string): Promise<ArrayBuffer> {
  let p = bankCache.get(url);
  if (!p) {
    p = fetchBytesWithRetry(url, "Coyote V8 bank", [300, 1200]);
    p.catch(() => bankCache.delete(url));
    bankCache.set(url, p);
  }
  return p;
}

/** Fetch + decode the bank (cached bytes, fresh decode per context). */
export async function loadCoyoteBank(ctx: BaseAudioContext): Promise<AudioBuffer> {
  const bytes = await fetchBank(COYOTE_BANK_URL);
  const buffer = await ctx.decodeAudioData(bytes.slice(0));
  blendCoyoteLoopSeams(buffer.getChannelData(0), buffer.sampleRate);
  return buffer;
}

export interface CoyoteDiagnostics {
  ready: boolean;
  fallback: boolean;
  activePoints: number[];
  liveSources: number;
  oneShotsFired: number;
  /** Last one-shots (id @ audio time), newest last, capped at 40. */
  recentOneShots: string[];
  rpm: number;
  loads: CoyoteLoadWeights;
}

function setParam(
  param: AudioParam,
  value: number,
  t: number,
  tau: number,
  last: number,
  eps: number,
) {
  if (Math.abs(value - last) <= eps) return last;
  param.setTargetAtTime(value, t, tau);
  return value;
}

export class CoyoteV8Synth {
  private ctx: BaseAudioContext | null = null;
  private loopBus: GainNode | null = null;
  private shotBus: GainNode | null = null;
  private popBus: GainNode | null = null;
  private buffer: AudioBuffer | null = null;
  private points = new Map<number, PointVoice>();
  private loads: CoyoteLoadWeights = { light: 1, on: 0, over: 0 };
  private rpm = COYOTE_IDLE_RPM;
  private builtAt = 0;
  private holdLoopsUntil = 0;
  private disposed = false;
  private fallback: { src: AudioBufferSourceNode; gain: GainNode; lastRate: number } | null = null;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private lastState: DriveState | null = null;
  private lastGear = 0;
  private thrHistory: { t: number; v: number }[] = [];
  private barkCooldownUntil = 0;
  private shiftCooldownUntil = 0;
  private liftArmed = false;
  private liftAt: number | null = null;
  private lastShiftAt = -10;
  private popCooldownUntil = 0;
  private oneShotsFired = 0;
  private shotLog: string[] = [];
  private shiftIntensity = 1;
  private popsEnabled = true;
  private startupAllowed = true;
  private live = new Set<AudioScheduledSourceNode>();
  private lastShiftSeq = -1;
  readonly ready: Promise<void>;
  private resolveReady: () => void = () => undefined;

  constructor(options?: { startup?: boolean }) {
    this.startupAllowed = options?.startup !== false;
    this.ready = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
  }

  build(ctx: BaseAudioContext, buses: StrategyBuses): boolean {
    this.ctx = ctx;
    this.builtAt = ctx.currentTime;
    const loopBus = ctx.createGain();
    loopBus.gain.value = COYOTE_OUTPUT_GAIN;
    loopBus.connect(buses.body);
    const shotBus = ctx.createGain();
    shotBus.gain.value = COYOTE_OUTPUT_GAIN;
    shotBus.connect(buses.body);
    const popBus = ctx.createGain();
    popBus.gain.value = COYOTE_OUTPUT_GAIN;
    popBus.connect(buses.accents);
    this.loopBus = loopBus;
    this.shotBus = shotBus;
    this.popBus = popBus;

    const load = loadCoyoteBank(ctx).then(
      (buffer) => {
        if (!this.disposed) this.attachBuffer(buffer);
      },
      (error) => {
        console.warn("[elcamoso] Coyote V8 bank unavailable", error);
        if (!this.disposed) this.startFallback();
      },
    );
    void load.finally(() => this.resolveReady());
    // A stalled fetch (weak in-car LTE) must never leave the drive silent.
    this.fallbackTimer = setTimeout(() => {
      this.fallbackTimer = null;
      if (!this.buffer && !this.disposed) this.startFallback();
    }, COYOTE_FALLBACK_DELAY_MS);
    return true;
  }

  setShiftIntensity(value: number) {
    this.shiftIntensity = Math.min(1.5, Math.max(0, value));
  }

  /** Drive+ extras (rev-match blips, overrun pops), same switch as the hybrid engines. */
  setAdvancedTransientsEnabled(enabled: boolean) {
    this.popsEnabled = enabled;
  }

  getDiagnostics(): CoyoteDiagnostics {
    return {
      ready: Boolean(this.buffer),
      fallback: Boolean(this.fallback),
      activePoints: [...this.points.keys()].map((i) => COYOTE_RPM_POINTS[i] ?? 0),
      liveSources: this.points.size * 3 + this.live.size + (this.fallback ? 1 : 0),
      oneShotsFired: this.oneShotsFired,
      recentOneShots: [...this.shotLog],
      rpm: this.rpm,
      loads: { ...this.loads },
    };
  }

  /** Test hook: use an already decoded bank. */
  attachBuffer(buffer: AudioBuffer) {
    const ctx = this.ctx;
    if (!ctx || this.disposed) return;
    if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
    this.fallbackTimer = null;
    this.buffer = buffer;
    const now = ctx.currentTime;
    const stationary = !this.lastState || (this.lastState.speed ?? 0) < 1;
    if (this.fallback) {
      const fb = this.fallback;
      this.fallback = null;
      fb.gain.gain.setTargetAtTime(0, now, 0.12);
      try {
        fb.src.stop(now + 0.8);
      } catch {
        /* already stopped */
      }
    } else if (this.startupAllowed && stationary && now - this.builtAt < STARTUP_WINDOW_S) {
      this.playStartup(now);
    }
  }

  private playStartup(now: number) {
    const shot = coyoteOneShot("startup");
    if (!shot || !this.loopBus) return;
    const at = now + 0.05;
    this.fireOneShot("startup", at, 1, 1, this.shotBus);
    // Hand over from the startup's settling idle to the idle loop near its end.
    const handover = at + shot.duration - 0.9;
    this.holdLoopsUntil = handover + 0.7;
    const g = this.loopBus.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(0, now);
    g.setValueAtTime(0, handover);
    g.linearRampToValueAtTime(COYOTE_OUTPUT_GAIN, handover + 0.7);
  }

  update(state: DriveState, t: number) {
    const ctx = this.ctx;
    if (!ctx || this.disposed) return;
    const rawRpm = state.rpm > 0 ? state.rpm : COYOTE_IDLE_RPM;
    const rpm = Math.min(COYOTE_MAX_RPM * 1.04, Math.max(COYOTE_IDLE_RPM * 0.9, rawRpm));
    this.rpm = rpm;
    const shiftScale = state.powertrain?.shiftLoadMultiplier ?? 1;
    const target = coyoteLoadTargets({
      rpm,
      throttle: state.throttle,
      load: state.load * Math.max(0.2, shiftScale),
      speedMs: state.speed,
      regen: state.regen,
    });
    // Asymmetric smoothing: throttle opens fast, closes a little slower.
    const dt = this.lastState
      ? Math.min(0.25, Math.max(0, (state.timestamp - this.lastState.timestamp) / 1000))
      : 0.016;
    const k = (tau: number) => 1 - Math.exp(-dt / tau);
    const on =
      this.loads.on + (target.on - this.loads.on) * k(target.on > this.loads.on ? 0.05 : 0.14);
    const over =
      this.loads.over +
      (target.over - this.loads.over) * k(target.over > this.loads.over ? 0.12 : 0.08);
    const sum = Math.max(1e-6, on + over + Math.max(0, 1 - on - over));
    this.loads = { on: on / sum, over: over / sum, light: Math.max(0, 1 - on - over) / sum };

    if (this.buffer) this.updateLoops(rpm, t);
    else if (this.fallback) this.updateFallback(rpm, t);
    this.updateEvents(state, rpm, t);
    this.lastState = state;
  }

  private updateLoops(rpm: number, t: number) {
    const weights = coyoteRpmWeights(rpm);
    const wanted = new Map(weights.map((w) => [w.index, w.weight]));
    for (const w of weights) {
      if (!this.points.has(w.index) && w.weight > 0.002) this.startPoint(w.index, t);
    }
    for (const [index, voice] of this.points) {
      const weight = wanted.get(index) ?? 0;
      voice.lastWeight = setParam(voice.out.gain, weight, t, 0.04, voice.lastWeight, 0.004);
      const rate = coyoteLoopRate(rpm, voice.rpm);
      if (Math.abs(rate - voice.lastRate) > 0.0015) {
        for (const load of LOADS) voice.sources[load].playbackRate.setTargetAtTime(rate, t, 0.025);
        voice.lastRate = rate;
      }
      for (const load of LOADS) {
        const g = voice.loadGains[load];
        const v = this.loads[load];
        const last = (g as GainNode & { __last?: number }).__last ?? -1;
        (g as GainNode & { __last?: number }).__last = setParam(g.gain, v, t, 0.03, last, 0.004);
      }
      if (weight <= 0.002) {
        voice.idleSince ??= t;
        if (t - voice.idleSince > 0.5) this.stopPoint(index, t);
      } else {
        voice.idleSince = null;
      }
    }
  }

  private startPoint(index: number, t: number) {
    const ctx = this.ctx!;
    const buffer = this.buffer!;
    const rpmNominal = COYOTE_RPM_POINTS[index];
    if (rpmNominal === undefined || !this.loopBus) return;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.loopBus);
    const sources = {} as Record<CoyoteLoad, AudioBufferSourceNode>;
    const loadGains = {} as Record<CoyoteLoad, GainNode>;
    const ref = coyoteLoopFor(index, "light")!;
    // Same loop length and timing for all three loads of a point: start them on one
    // offset so they stay sample-aligned (a load change is a timbre morph, not a doubling).
    const phase = audioRandom() * (ref.end - ref.start);
    const rate = coyoteLoopRate(this.rpm, ref.rpm);
    const at = Math.max(t, ctx.currentTime);
    for (const load of LOADS) {
      const def = coyoteLoopFor(index, load)!;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.loopStart = def.start;
      src.loopEnd = def.end;
      src.playbackRate.value = rate;
      const g = ctx.createGain();
      g.gain.value = this.loads[load];
      (g as GainNode & { __last?: number }).__last = this.loads[load];
      src.connect(g);
      g.connect(out);
      src.start(at, def.start + phase * ((def.end - def.start) / (ref.end - ref.start)));
      sources[load] = src;
      loadGains[load] = g;
    }
    this.points.set(index, {
      index,
      rpm: ref.rpm,
      sources,
      loadGains,
      out,
      lastRate: rate,
      lastWeight: 0,
      idleSince: null,
    });
  }

  private stopPoint(index: number, t: number) {
    const voice = this.points.get(index);
    if (!voice) return;
    this.points.delete(index);
    let pending = LOADS.length;
    for (const load of LOADS) {
      const src = voice.sources[load];
      // Disconnect on the audio clock (onended), never on a wall-clock timer: an offline
      // render or a stalled main thread would otherwise cut audio that is still scheduled.
      src.onended = () => {
        src.disconnect();
        voice.loadGains[load].disconnect();
        pending -= 1;
        if (pending === 0) voice.out.disconnect();
      };
      try {
        src.stop(t + 0.05);
      } catch {
        /* already stopped */
      }
    }
  }

  /* ------------------------------------------------------------------ events */

  private updateEvents(state: DriveState, rpm: number, t: number) {
    if (!this.buffer || t < this.holdLoopsUntil) {
      this.lastGear = state.gear;
      return;
    }
    // Sudden throttle: bark, separate from the RPM rise (that comes from the loops).
    const now = state.timestamp / 1000;
    this.thrHistory.push({ t: now, v: state.throttle });
    while (this.thrHistory.length && now - this.thrHistory[0]!.t > 0.25) this.thrHistory.shift();
    const minRecent = this.thrHistory.reduce((m, s) => Math.min(m, s.v), 1);
    const jump = state.throttle - minRecent;
    if (jump > 0.32 && state.throttle > 0.6 && t >= this.barkCooldownUntil) {
      // Pitched to the real RPM: a stab at low RPM in a tall gear stays deep and heavy.
      const rate = Math.min(1.6, Math.max(0.45, rpm / 2000));
      this.fireOneShot("bark", t + 0.01, rate, 0.45 + 0.55 * Math.min(1, jump), this.shotBus);
      this.barkCooldownUntil = t + 1.5;
      this.thrHistory = [];
    }

    // Shifts: prefer the powertrain's once-per-shift event, else a gear change.
    let dir: "up" | "down" | null = null;
    let fromGear = this.lastGear;
    let reason = "";
    const ev = state.powertrain?.shiftEvent ?? null;
    if (state.powertrain) {
      if (ev && ev.sequenceId !== this.lastShiftSeq) {
        this.lastShiftSeq = ev.sequenceId;
        fromGear = ev.fromGear;
        reason = ev.reason ?? "";
        if (ev.fromGear >= 1 && ev.toGear >= 1) dir = ev.direction;
      }
    } else if (state.gear !== this.lastGear && this.lastGear >= 1 && state.gear >= 1) {
      dir = state.gear > this.lastGear ? "up" : "down";
    }
    this.lastGear = state.gear;
    if (dir) this.lastShiftAt = t;
    if (dir && t >= this.shiftCooldownUntil && this.shiftIntensity > 0) {
      const intensity = this.shiftIntensity;
      const onLoad = this.loads.on;
      if (dir === "up") {
        // Throttle unloads -> note softens -> RPM drops (powertrain) -> power returns.
        // Light throttle: a soft, short dip only. Hard throttle: a deeper cut and, only
        // sometimes, the short re-engage "brup" one-shot. Never an explosion.
        this.dipLoops(t, (0.12 + 0.36 * onLoad) * Math.min(1, intensity), 0.07 + 0.06 * onLoad);
        if (onLoad > 0.75 && audioRandom() < 0.65) {
          const rate = Math.min(1.5, Math.max(0.55, rpm / 4000));
          this.fireOneShot(
            audioRandom() < 0.5 ? "upshift1" : "upshift2",
            t + 0.005,
            rate,
            (0.35 + 0.5 * onLoad) * intensity,
            this.shotBus,
          );
        }
      } else {
        // Rev-matched downshift while slowing: a short tonal blip. A kickdown (throttle
        // open) gets no blip: the RPM jump comes from the loops and the bark covers the
        // attack. Never near idle (the car is about to stop).
        const kickdown = reason === "kickdown" || state.throttle > 0.3 || onLoad > 0.35;
        if (this.popsEnabled && !kickdown && state.speed > 3 && fromGear >= 2 && rpm > 1000) {
          const rate = Math.min(1.6, Math.max(0.6, rpm / 2000));
          this.dipLoops(t, 0.35, 0.22);
          this.fireOneShot(
            audioRandom() < 0.5 ? "blip1" : "blip2",
            t + 0.005,
            rate,
            0.55 * intensity,
            this.shotBus,
          );
        }
      }
      this.shiftCooldownUntil = t + 0.35;
    }

    // Lift-off: a qualifying lift (from real load, held closed for a moment, not a shift's
    // torque cut) may give a sparse 0-3 pops, with a cooldown so a deceleration never
    // turns into a machine-gun sequence.
    if (state.throttle > 0.45 && rpm > 2300) {
      this.liftArmed = true;
      this.liftAt = null;
    }
    if (this.liftArmed && state.throttle < 0.1) {
      this.liftAt ??= t;
      if (t - this.liftAt >= POP_LIFT_HOLD_S) {
        this.liftArmed = false;
        this.liftAt = null;
        const nearShift = t - this.lastShiftAt < POP_SHIFT_GUARD_S;
        if (
          this.popsEnabled &&
          !nearShift &&
          t >= this.popCooldownUntil &&
          rpm > 2100 &&
          state.speed > 3
        ) {
          const count = coyotePopCount(audioRandom());
          let at = t + 0.05 + audioRandom() * 0.25;
          for (let i = 0; i < count; i += 1) {
            const variant = 1 + Math.floor(audioRandom() * 3);
            this.fireOneShot(
              `pop${variant}`,
              at,
              0.92 + audioRandom() * 0.16,
              0.35 + audioRandom() * 0.4,
              this.popBus,
            );
            at += 0.12 + audioRandom() * 0.5;
          }
          this.popCooldownUntil = t + POP_COOLDOWN_S;
        }
      }
    } else if (state.throttle >= 0.1) {
      this.liftAt = null;
    }
  }

  /** Brief loop-bus dip (shift torque cut / blip handover), restored on the audio clock. */
  private dipLoops(t: number, depth: number, hold: number) {
    if (!this.loopBus || depth <= 0 || t < this.holdLoopsUntil) return;
    const g = this.loopBus.gain;
    const base = COYOTE_OUTPUT_GAIN;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(base * (1 - Math.min(0.6, depth)), t, 0.02);
    g.setTargetAtTime(base, t + hold, 0.06);
  }

  private fireOneShot(id: string, at: number, rate: number, level: number, bus: GainNode | null) {
    const ctx = this.ctx;
    const shot = coyoteOneShot(id);
    if (!ctx || !this.buffer || !shot || !bus) return;
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = level * 10 ** (shot.gainDb / 20);
    src.connect(g);
    g.connect(bus);
    const when = Math.max(at, ctx.currentTime);
    src.start(when, shot.start, shot.duration);
    this.live.add(src);
    this.oneShotsFired += 1;
    this.shotLog.push(`${id}@${when.toFixed(2)}`);
    if (this.shotLog.length > 40) this.shotLog.shift();
    src.onended = () => {
      this.live.delete(src);
      src.disconnect();
      g.disconnect();
    };
  }

  /* ---------------------------------------------------------------- fallback */

  /** Tiny procedural idle loop (one buffer source) while the bank is unavailable. */
  private startFallback() {
    const ctx = this.ctx;
    if (!ctx || this.fallback || this.buffer || !this.loopBus) return;
    const sr = ctx.sampleRate;
    const cycles = 8;
    const rpm = 900;
    const n = Math.round((cycles * 120 * sr) / rpm);
    const buf = ctx.createBuffer(1, n, sr);
    const data = buf.getChannelData(0);
    const order = [0, 1, 0, 1, 1, 0, 1, 0];
    const tau = 0.0018 * sr;
    for (let e = 0; e < cycles * 8; e += 1) {
      const pos = (e * n) / (cycles * 8);
      const amp = (order[e % 8] ? 0.86 : 1) * (0.92 + 0.16 * audioRandom());
      for (let k = 0; k < tau * 12; k += 1) {
        const x = k / tau;
        const idx = Math.floor(pos + k) % n;
        data[idx] = (data[idx] ?? 0) + amp * x * x * Math.exp(-x) * 0.6;
      }
    }
    // remove DC and soften: two one-pole passes, circular warm-up
    let lp = 0;
    let mean = 0;
    for (let i = 0; i < n; i += 1) mean += data[i]!;
    mean /= n;
    for (let pass = 0; pass < 2; pass += 1) {
      for (let i = 0; i < n; i += 1) {
        lp += (data[i]! - mean - lp) * 0.18;
        if (pass === 1) data[i] = lp * 0.5;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain);
    gain.connect(this.loopBus);
    const now = ctx.currentTime;
    gain.gain.setTargetAtTime(0.5, now, 0.2);
    src.start(now);
    this.fallback = { src, gain, lastRate: 1 };
  }

  private updateFallback(rpm: number, t: number) {
    const fb = this.fallback!;
    const rate = Math.min(4, Math.max(0.6, rpm / 900));
    if (Math.abs(rate - fb.lastRate) > 0.004) {
      fb.src.playbackRate.setTargetAtTime(rate, t, 0.05);
      fb.lastRate = rate;
    }
    const level = 0.35 + 0.35 * this.loads.on - 0.15 * this.loads.over;
    fb.gain.gain.setTargetAtTime(level, t, 0.1);
  }

  dispose() {
    this.disposed = true;
    if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
    this.fallbackTimer = null;
    const t = this.ctx?.currentTime ?? 0;
    for (const index of [...this.points.keys()]) this.stopPoint(index, t);
    for (const src of this.live) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    this.live.clear();
    if (this.fallback) {
      try {
        this.fallback.src.stop();
      } catch {
        /* already stopped */
      }
      this.fallback = null;
    }
    for (const bus of [this.loopBus, this.shotBus, this.popBus]) {
      try {
        bus?.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.loopBus = this.shotBus = this.popBus = null;
    this.resolveReady();
  }
}

export function isCoyoteV8ProfileId(profileId: string | null | undefined): boolean {
  return profileId === "american-muscle-v8";
}
