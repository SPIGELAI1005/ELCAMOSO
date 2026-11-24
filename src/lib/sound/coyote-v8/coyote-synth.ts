/**
 * American Muscle V8 "Coyote v2": one pre-rendered sound instead of two live engines.
 *
 * The bank (scripts/sound/coyote_v8_bank.py) holds seamless loops on an RPM x load grid
 * (light / on-load / overrun) plus one-shots (startup, bark, rev-match blip, pops, crackle)
 * in a single AAC file. Gear shifts and the race-mode overrun are the Racing V10's
 * (./v10-shift.ts): short filtered-noise transients made per shift, no live filter chain. At runtime this only crossfades a few looping
 * AudioBufferSourceNodes: the two RPM points around the current RPM, each with its three
 * phase-aligned load variants, and nudges their playback rate by at most ~±18 %.
 * Above the idle range the neighbouring points are started crank-aligned on one shared
 * crank clock (all voices follow the same rpm automation), so a cruise between two grid
 * points is one engine morphing in timbre, not two engines playing at once.
 * Looping sources keep playing through main-thread stalls, and one-shots are scheduled
 * with start(when), so a busy car browser does not starve the audio.
 */
import type { DriveState } from "@/lib/drive/model";
import type { StrategyBuses } from "@/lib/sound/realism/types";
import { fetchBytesWithRetry } from "@/lib/sound/fetch-bytes";
import { getDrivetrainPersonality } from "@/lib/drive/drivetrain-personalities";
import type { DrivetrainShiftEvent } from "@/lib/powertrain/types";
import { getNoiseBuffer } from "@/lib/sound/dsp/noise";
import { audioRandom } from "@/lib/sound/rng";
import {
  COYOTE_BANK_URL,
  COYOTE_IDLE_RPM,
  COYOTE_MAX_RPM,
  COYOTE_RPM_POINTS,
  COYOTE_HEEL_TOE,
  blendCoyoteLoopSeams,
  coyoteAlignedOffset,
  coyoteHeelToeEnvelope,
  coyoteLoadTargets,
  coyoteLoopFor,
  coyoteLoopRate,
  coyoteOneShot,
  coyotePointAligned,
  coyotePopCount,
  coyoteRpmWeights,
  type CoyoteLoad,
  type CoyoteLoadWeights,
} from "./model";
import {
  V10_FILTER_WARMUP_S,
  V10_RACE,
  V10_REENGAGE_THUMP,
  V10_SHIFT_VOICES,
  coyoteV10ShiftPlan,
  v10BarkLevel,
  v10LimiterGateCycles,
  v10PopSequence,
  v10PulsePeak,
  v10ShiftIntensity,
  type V10VoiceId,
} from "./v10-shift";
import { COYOTE_V8_VOICING, afterfireStrength, gritCurve, type CoyoteVoicing } from "./voicing";

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
/** Pedal brake / regen above this is meaningfully braking (not a coast / overrun). */
const POP_BRAKE_THRESH = 0.15;
/** After the brake comes off, still no new pop clusters for this long. */
const POP_BRAKE_HOLD_S = 0.5;
/** Startup only plays when the bank is ready this soon after the profile was built. */
const STARTUP_WINDOW_S = 4;
const LOADS: readonly CoyoteLoad[] = ["light", "on", "over"];
/** Playback-rate glide (s): every loop voice gets the same rpm automation. */
const RATE_TAU_S = 0.025;
/** On-load smoothing (s): opening / closing. Long enough to morph, short enough to follow. */
const ON_TAU_OPEN_S = 0.11;
const ON_TAU_CLOSE_S = 0.22;
/** Redline of the american-v8 drivetrain (race-mode rpm / redline thresholds). */
const COYOTE_REDLINE_RPM = getDrivetrainPersonality("american-v8").engine.redlineRpm;
/**
 * V10 shift transients on the Coyote: same voices, -1.4 dB. Measured offline through the full
 * engine chain, the V10's master chain compresses its (louder) bed and the pulses with it;
 * this trim gives the same pulse level as the V10 at the same bed level (downshifts).
 */
const COYOTE_SHIFT_TRIM = 0.85;
/** Race-mode pops: V10 pop strength -> Coyote pop one-shot level (offline-calibrated). */
const RACE_POP_GAIN = 4.5;
/** Race-mode crackle tail: V10 crackle strength -> crackle one-shot level. */
const RACE_CRACKLE_GAIN = 4.5;

/**
 * Model of the rpm automation every loop voice follows, integrated to a crank position in
 * engine cycles. A new aligned voice starts at the loop offset of this crank position, so
 * it lands on the same cycle and crank angle as the voices already playing (they all
 * advance at rpm / 120 cycles per second).
 *
 * playbackRate is a k-rate param: the browser holds one value per 128-frame render
 * quantum, taken at the quantum's first frame. Glides and voice starts are therefore put
 * on quantum boundaries, and the clock sums the same per-quantum staircase of the
 * setTargetAtTime curve (a geometric series), so it matches what the sources really play.
 */
export class CoyoteCrankClock {
  private t0: number;
  private v0: number;
  private target: number;
  private tau: number;
  private acc = 0;
  readonly quantum: number;

  constructor(rpm: number, t = 0, sampleRate = 48000) {
    this.quantum = 128 / sampleRate;
    this.t0 = this.snap(t);
    this.v0 = rpm;
    this.target = rpm;
    this.tau = RATE_TAU_S;
  }

  /** First render-quantum boundary at or after t. */
  snap(t: number): number {
    return Math.ceil(t / this.quantum - 1e-6) * this.quantum;
  }

  private quanta(t: number): number {
    return Math.max(0, Math.round((this.snap(t) - this.t0) / this.quantum));
  }

  /** Automated rpm held during the quantum that starts at (snapped) t. */
  value(t: number): number {
    const r = Math.exp(-this.quantum / this.tau);
    return this.target + (this.v0 - this.target) * r ** this.quanta(t);
  }

  get targetRpm(): number {
    return this.target;
  }

  /** Sum of rpm x quantum over the quanta from t0 up to (snapped) t. */
  private integral(t: number): number {
    const k = this.quanta(t);
    const r = Math.exp(-this.quantum / this.tau);
    const geo = r < 1 ? (1 - r ** k) / (1 - r) : k;
    return this.quantum * (this.target * k + (this.v0 - this.target) * geo);
  }

  /** Crank position in engine cycles (720 degrees each) at the (snapped) time t. */
  cycles(t: number): number {
    return (this.acc + this.integral(t)) / 120;
  }

  /** A new glide towards rpm from the (snapped) time t: mirrors setTargetAtTime there. */
  glide(t: number, rpm: number, tau = RATE_TAU_S) {
    const at = Math.max(this.snap(t), this.t0);
    this.acc += this.integral(at);
    this.v0 = this.value(at);
    this.t0 = at;
    this.target = rpm;
    this.tau = tau;
  }
}

interface PointVoice {
  index: number;
  rpm: number;
  aligned: boolean;
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
  /** Loads sent to the loops right now (smoothed loads + any heel-toe blip). */
  mixLoads: CoyoteLoadWeights;
  /** Race-mode heel-and-toe downshifts played. */
  heelToes: number;
  /** Racing V10 shift transients (gear engagement + driveline thump) scheduled. */
  shiftPulses: number;
  /** Race-mode overrun pop sequences (lift-off, downshift, upshift crack, limiter). */
  racePopSequences: number;
  /** Race-mode limiter ignition-cut gate is running. */
  limiterGate: boolean;
  /** Active points that are crank-aligned. */
  alignedPoints: number[];
  /** Voicing id (american-muscle-v8 = the plain Coyote). */
  voicing: string;
  /** Ge-Squared O))) afterfire bangs played. */
  afterfireShots: number;
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
  /** Racing V10 shift transients go to the accents bus, as on the V10. */
  private accentBus: AudioNode | null = null;
  /** Race-mode ignition-cut gate on the loops (upshift cut, limiter bounce). */
  private raceGate: GainNode | null = null;
  private raceGateScheduledTo = 0;
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
  private brakeHeldUntil = -10;
  private pendingPops: { src: AudioBufferSourceNode; gain: GainNode; when: number; log: string }[] =
    [];
  private oneShotsFired = 0;
  private shotLog: string[] = [];
  private shiftIntensity = 1;
  private popsEnabled = true;
  private startupAllowed = true;
  private live = new Set<AudioScheduledSourceNode>();
  private lastShiftSeq = -1;
  private clock = new CoyoteCrankClock(COYOTE_IDLE_RPM);
  private clockReady = false;
  /** Race-mode heel-and-toe blip: audio time the shift began, and its strength. */
  private heelToeAt: number | null = null;
  private heelToeAmt = 0;
  private heelToes = 0;
  /** V10 recovery bark: the engine note snaps back after the engagement. */
  private barkAt = -10;
  private barkAmt = 0;
  private shiftPulses = 0;
  private pulseSeed = 0x5eed1;
  private lastShiftPhase = "";
  /** Race overrun (V10 updateRacePops / liftPops). */
  private racePopSequences = 0;
  private popPrevDemand = 0;
  private popPrevDownshift = false;
  private racePopLastAt = -10;
  private raceLastLimiterCut = false;
  private raceLastLimiterPopAt = -10;
  /** Loads actually sent to the loops (smoothed loads + heel-toe blip + bark). */
  private mixLoads: CoyoteLoadWeights = { light: 1, on: 0, over: 0 };
  readonly ready: Promise<void>;
  private resolveReady: () => void = () => undefined;

  /** Called once the startup flare is actually scheduled (the engine marks the drive). */
  private readonly onStartup: (() => void) | null;
  /** Per-profile voicing (Ge-Squared O))) / '90); the V8's own is the identity. */
  private readonly voicing: CoyoteVoicing;
  /** Redline of the drivetrain that drives this sound (race-mode rpm thresholds). */
  private readonly redlineRpm: number;
  private toneNodes: AudioNode[] = [];
  private afterfireBuffer: AudioBuffer | null = null;
  private afterfireLastAt = -10;
  private afterfireShots = 0;
  private valvetrain: { src: AudioBufferSourceNode; gain: GainNode; refRpm: number } | null = null;

  constructor(options?: {
    startup?: boolean;
    onStartup?: () => void;
    voicing?: CoyoteVoicing;
    redlineRpm?: number;
  }) {
    this.startupAllowed = options?.startup !== false;
    this.onStartup = options?.onStartup ?? null;
    this.voicing = options?.voicing ?? COYOTE_V8_VOICING;
    this.redlineRpm = options?.redlineRpm ?? COYOTE_REDLINE_RPM;
    this.ready = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
  }

  build(ctx: BaseAudioContext, buses: StrategyBuses): boolean {
    this.ctx = ctx;
    this.builtAt = ctx.currentTime;
    const loopBus = ctx.createGain();
    loopBus.gain.value = COYOTE_OUTPUT_GAIN;
    const raceGate = ctx.createGain();
    raceGate.gain.value = 1;
    loopBus.connect(raceGate);
    // Voiced profiles: loops and one-shots through the profile's fixed tone chain.
    const engineOut = this.buildTone(ctx, buses.body);
    raceGate.connect(engineOut);
    this.raceGate = raceGate;
    this.accentBus = buses.accents;
    // The V10 transients' noise, made now (not on the first shift, on a busy car browser).
    getNoiseBuffer(ctx, "pink");
    getNoiseBuffer(ctx, "brown");
    const shotBus = ctx.createGain();
    shotBus.gain.value = COYOTE_OUTPUT_GAIN;
    shotBus.connect(engineOut);
    const popBus = ctx.createGain();
    popBus.gain.value = COYOTE_OUTPUT_GAIN;
    popBus.connect(buses.accents);
    this.loopBus = loopBus;
    this.shotBus = shotBus;
    this.popBus = popBus;
    if (this.voicing.valvetrain) this.buildValvetrain(ctx, loopBus);
    if (this.voicing.afterfire) this.loadAfterfire(ctx, this.voicing.afterfire.url);

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
      mixLoads: { ...this.mixLoads },
      heelToes: this.heelToes,
      shiftPulses: this.shiftPulses,
      racePopSequences: this.racePopSequences,
      limiterGate: this.raceGateScheduledTo > 0,
      alignedPoints: [...this.points.values()]
        .filter((v) => v.aligned)
        .map((v) => COYOTE_RPM_POINTS[v.index] ?? 0),
      voicing: this.voicing.id,
      afterfireShots: this.afterfireShots,
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
    // The loops only start from update(). Before the first drive tick (e.g. Drive is still
    // waiting for motion / GPS while parked) start the idle loop now, so the V8 never sits
    // silent on a running context. update() takes over the same voices on its first tick.
    if (!this.lastState) this.updateLoops(this.rpm, now);
  }

  private playStartup(now: number) {
    const shot = coyoteOneShot("startup");
    if (!shot || !this.loopBus) return;
    const at = now + 0.05;
    this.fireOneShot("startup", at, 1, 1, this.shotBus);
    this.onStartup?.();
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
    let rpm = Math.min(COYOTE_MAX_RPM * 1.04, Math.max(COYOTE_IDLE_RPM * 0.9, rawRpm));
    const shiftScale = state.powertrain?.shiftLoadMultiplier ?? 1;
    const target = coyoteLoadTargets({
      rpm,
      throttle: state.throttle,
      load: state.load * Math.max(0.2, shiftScale),
      speedMs: state.speed,
      regen: state.regen,
    });
    // Asymmetric smoothing: throttle opens a little faster than it closes. Both are long
    // enough that a change of pedal morphs the note (no switch to "another engine").
    const dt = this.lastState
      ? Math.min(0.25, Math.max(0, (state.timestamp - this.lastState.timestamp) / 1000))
      : 0.016;
    const k = (tau: number) => 1 - Math.exp(-dt / tau);
    const on =
      this.loads.on +
      (target.on - this.loads.on) * k(target.on > this.loads.on ? ON_TAU_OPEN_S : ON_TAU_CLOSE_S);
    const over =
      this.loads.over +
      (target.over - this.loads.over) * k(target.over > this.loads.over ? 0.12 : 0.08);
    const sum = Math.max(1e-6, on + over + Math.max(0, 1 - on - over));
    this.loads = { on: on / sum, over: over / sum, light: Math.max(0, 1 - on - over) / sum };

    // Race-mode heel-and-toe: the blip opens the throttle (overrun -> on-load morph on the
    // same phase-aligned loops) and flares the rpm a little past the powertrain's rev-match.
    const blip =
      this.heelToeAt === null
        ? 0
        : this.heelToeAmt * coyoteHeelToeEnvelope(t - this.heelToeAt - COYOTE_HEEL_TOE.blipDelayS);
    if (this.heelToeAt !== null && t - this.heelToeAt > 1.3) this.heelToeAt = null;
    // Racing V10 recovery bark after a gear engagement: the note snaps back (on-load morph).
    const bark = v10BarkLevel(this.barkAmt, t - this.barkAt);
    if (blip > 0.001 || bark > 0.001) {
      rpm = Math.min(COYOTE_MAX_RPM * 1.04, rpm * (1 + COYOTE_HEEL_TOE.rpmFlare * blip));
      const lift = Math.max(blip, bark);
      const base = Math.max(this.loads.on, blip);
      const onMix = Math.min(1, base + bark * (1 - base));
      const overMix = this.loads.over * (1 - lift);
      this.mixLoads = { on: onMix, over: overMix, light: Math.max(0, 1 - onMix - overMix) };
    } else {
      this.mixLoads = this.loads;
    }
    this.rpm = rpm;

    if (this.buffer) this.updateLoops(rpm, t);
    else if (this.fallback) this.updateFallback(rpm, t);
    this.updateEvents(state, rpm, t);
    this.lastState = state;
  }

  /** Playback rate of a voice for an automated rpm (aligned voices are never clamped). */
  private rateFor(voice: { rpm: number; aligned: boolean }, rpm: number) {
    return voice.aligned ? rpm / voice.rpm : coyoteLoopRate(rpm, voice.rpm);
  }

  private updateLoops(rpm: number, t: number) {
    const ctx = this.ctx!;
    if (!this.clockReady) {
      this.clock = new CoyoteCrankClock(this.clock.targetRpm, ctx.currentTime, ctx.sampleRate);
      this.clockReady = true;
    }
    const at = this.clock.snap(Math.max(t, ctx.currentTime));
    // One rpm automation for every voice (and the crank clock that mirrors it), so aligned
    // voices advance in lockstep. Retarget only on a real change.
    const retarget = Math.abs(rpm - this.clock.targetRpm) > this.clock.targetRpm * 0.0008;
    if (retarget) {
      this.clock.glide(at, rpm, RATE_TAU_S);
      const vt = this.valvetrain;
      if (vt) {
        vt.src.playbackRate.setTargetAtTime(rpm / vt.refRpm, at, RATE_TAU_S);
        const norm = Math.min(1, rpm / this.redlineRpm);
        vt.gain.gain.setTargetAtTime(this.voicing.valvetrain!.level * (0.7 + 0.5 * norm), at, 0.05);
      }
    }
    const weights = coyoteRpmWeights(rpm, this.mixLoads);
    const wanted = new Map(weights.map((w) => [w.index, w.weight]));
    for (const w of weights) {
      if (!this.points.has(w.index) && w.weight > 0.002) this.startPoint(w.index, at);
    }
    for (const [index, voice] of this.points) {
      const weight = wanted.get(index) ?? 0;
      voice.lastWeight = setParam(voice.out.gain, weight, t, 0.04, voice.lastWeight, 0.004);
      if (retarget) {
        const rate = this.rateFor(voice, rpm);
        for (const load of LOADS) {
          voice.sources[load].playbackRate.setTargetAtTime(rate, at, RATE_TAU_S);
        }
        voice.lastRate = rate;
      }
      for (const load of LOADS) {
        const g = voice.loadGains[load];
        const v = this.mixLoads[load];
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
    const aligned = coyotePointAligned(index);
    const at = Math.max(t, ctx.currentTime);
    // Same loop length and timing for all three loads of a point: start them on one
    // offset so they stay sample-aligned (a load change is a timbre morph, not a doubling).
    // Aligned points start on the shared crank clock; idle points keep a random phase.
    const phase = aligned
      ? coyoteAlignedOffset(ref, this.clock.cycles(at))
      : audioRandom() * (ref.end - ref.start);
    const voiceRef = { rpm: ref.rpm, aligned };
    // Join the glide already running on the other voices: same value now, same target.
    const rateNow = this.rateFor(voiceRef, this.clock.value(at));
    const rate = this.rateFor(voiceRef, this.clock.targetRpm);
    for (const load of LOADS) {
      const def = coyoteLoopFor(index, load)!;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.loopStart = def.start;
      src.loopEnd = def.end;
      src.playbackRate.value = rateNow;
      if (Math.abs(rate - rateNow) > 1e-6) src.playbackRate.setTargetAtTime(rate, at, RATE_TAU_S);
      const g = ctx.createGain();
      g.gain.value = this.mixLoads[load];
      (g as GainNode & { __last?: number }).__last = this.mixLoads[load];
      src.connect(g);
      g.connect(out);
      src.start(at, def.start + phase * ((def.end - def.start) / (ref.end - ref.start)));
      sources[load] = src;
      loadGains[load] = g;
    }
    this.points.set(index, {
      index,
      rpm: ref.rpm,
      aligned,
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
    let shiftEv: DrivetrainShiftEvent | null = null;
    const pt = state.powertrain;
    const ev = pt?.shiftEvent ?? null;
    if (pt) {
      if (ev && ev.sequenceId !== this.lastShiftSeq) {
        this.lastShiftSeq = ev.sequenceId;
        fromGear = ev.fromGear;
        reason = ev.reason ?? "";
        if (ev.fromGear >= 1 && ev.toGear >= 1) {
          dir = ev.direction;
          shiftEv = ev;
        }
      }
    } else if (state.gear !== this.lastGear && this.lastGear >= 1 && state.gear >= 1) {
      dir = state.gear > this.lastGear ? "up" : "down";
      shiftEv = {
        sequenceId: -1,
        atMs: t * 1000,
        fromGear: this.lastGear,
        toGear: state.gear,
        direction: dir,
        reason: "gear-change",
      };
    }
    this.lastGear = state.gear;
    if (dir) this.lastShiftAt = t;
    const race = pt?.diagnostics?.shiftMapPreset === "race";
    if (dir && shiftEv && t >= this.shiftCooldownUntil) {
      // Every mode: the Racing V10's gear shift (engagement + driveline thump + recovery).
      this.playV10Shift(shiftEv, t);
      if (race) this.raceShift(dir, state, fromGear, reason, rpm, t);
      else this.roadShift(dir, state, fromGear, reason, rpm, t);
      this.shiftCooldownUntil = t + (race ? 0.3 : 0.35);
    }
    // Upshift reengage: the clutch takes up drive (V10 scheduler thump + reengage bark).
    const phase = pt?.shifting ? (pt.shiftPhase ?? "") : "";
    if (phase === "reengage" && this.lastShiftPhase !== "reengage") {
      const down = pt?.shiftDirection === "down";
      const demand = pt?.driverDemand ?? state.throttle;
      this.armBark(t, ((down ? 0.2 : 0.12) + demand * 0.16) * 0.16);
      if (!down && state.speed * 3.6 > 4 && audioRandom() < 0.55) {
        const strength = v10ShiftIntensity(this.shiftIntensity);
        const intensity = V10_REENGAGE_THUMP.intensity * 0.96 * 0.55 * strength;
        if (strength > 0.001) {
          this.firePulse(
            "thump",
            intensity,
            V10_REENGAGE_THUMP.filterHz,
            V10_REENGAGE_THUMP.decayMs,
            t,
          );
        }
      }
    }
    this.lastShiftPhase = phase;
    if (race) this.updateRace(state, rpm, t);
    else this.updateRaceGate(false, t, false);

    // Brake / regen: no new overrun pops, and silence any that were already scheduled.
    // Coasting lift-off (regen/brake at or below the threshold) can still pop.
    const brakeDemand = Math.max(state.regen, state.powertrain?.diagnostics?.braking ?? 0);
    if (brakeDemand > POP_BRAKE_THRESH) this.brakeHeldUntil = t + POP_BRAKE_HOLD_S;
    const brakeGate = t < this.brakeHeldUntil;
    if (brakeGate) this.cancelPendingPops(t);

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
          !race &&
          !nearShift &&
          !brakeGate &&
          t >= this.popCooldownUntil &&
          rpm > 2100 &&
          state.speed > 3
        ) {
          const pv = this.voicing.pops;
          const drawn = coyotePopCount(audioRandom());
          const count = drawn > 0 ? Math.max(0, Math.min(4, drawn + pv.extraPops)) : 0;
          let at = t + 0.05 + audioRandom() * 0.25;
          if (count > 0) at = this.playAfterfire(rpm, at);
          for (let i = 0; i < count; i += 1) {
            const variant = 1 + Math.floor(audioRandom() * 3);
            this.fireOneShot(
              `pop${variant}`,
              at,
              (0.92 + audioRandom() * 0.16) * pv.rate,
              (0.35 + audioRandom() * 0.4) * pv.level,
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

  /**
   * Road modes: the torque cut on the loops as before. Upshift: a soft, short dip at light
   * throttle, a deeper cut under load (the V10 recovery bark then brings the note back).
   * Downshift while slowing: the Drive+ rev-match blip, never on a kickdown or near idle.
   */
  private roadShift(
    dir: "up" | "down",
    state: DriveState,
    fromGear: number,
    reason: string,
    rpm: number,
    t: number,
  ) {
    const intensity = Math.max(0.35, Math.min(1, this.shiftIntensity));
    const onLoad = this.loads.on;
    if (dir === "up") {
      this.dipLoops(t, (0.12 + 0.36 * onLoad) * intensity, 0.07 + 0.06 * onLoad);
      return;
    }
    const kickdown = reason === "kickdown" || state.throttle > 0.3 || onLoad > 0.35;
    if (
      this.popsEnabled &&
      this.shiftIntensity > 0 &&
      !kickdown &&
      state.speed > 3 &&
      fromGear >= 2 &&
      rpm > 1000
    ) {
      const rate = Math.min(1.6, Math.max(0.6, rpm / 2000));
      this.dipLoops(t, 0.35, 0.22);
      this.fireOneShot(
        audioRandom() < 0.5 ? "blip1" : "blip2",
        t + 0.005,
        rate,
        0.55 * this.shiftIntensity,
        this.shotBus,
      );
    }
  }

  /**
   * Race mode, like the Racing V10. Up: torque-cut dip plus the ignition cut on the gate
   * (updateRace). Down: heel-and-toe, the throttle blip on the loops flares the rpm a little
   * past the powertrain's rev-match (a kickdown with the pedal open needs no blip).
   */
  private raceShift(
    dir: "up" | "down",
    state: DriveState,
    fromGear: number,
    reason: string,
    rpm: number,
    t: number,
  ) {
    const onLoad = this.loads.on;
    if (dir === "up") {
      this.dipLoops(
        t,
        (0.14 + 0.36 * onLoad) * Math.max(0.35, Math.min(1, this.shiftIntensity)),
        0.06 + 0.05 * onLoad,
      );
      return;
    }
    if (fromGear < 2 || state.speed < 1) return;
    const kickdown = reason === "kickdown" || state.throttle > 0.3 || onLoad > 0.35;
    if (!kickdown && rpm > 900) {
      this.heelToeAt = t;
      this.heelToeAmt = Math.min(0.95, 0.85 * Math.max(0.6, Math.min(1.2, this.shiftIntensity)));
      this.heelToes += 1;
    }
  }

  /* ------------------------------------------------------- Racing V10 shift */

  /** The V10 choreography: gear engagement, driveline thump 12 ms later, recovery bark. */
  private playV10Shift(event: DrivetrainShiftEvent, t: number) {
    const plan = coyoteV10ShiftPlan(event, this.shiftIntensity, t);
    for (const step of plan.steps) {
      if (step.kind && step.intensity > 0.001) {
        const voice: V10VoiceId = step.kind === "drivetrain-thump" ? "thump" : "shift";
        this.firePulse(voice, step.intensity, step.filterHz, step.decayMs, step.audioTime);
      }
      if (step.phase === "recovery" && step.envelopeScale > 0.001) {
        this.armBark(step.audioTime, step.envelopeScale);
      }
    }
  }

  private armBark(at: number, amount: number) {
    const active = at - this.barkAt >= 0 && at - this.barkAt < 0.16;
    this.barkAmt = Math.max(active ? this.barkAmt * 0.5 : 0, amount);
    this.barkAt = at;
  }

  /**
   * One V10 transient (firePulse): noise -> wide filter -> gain, 8 ms filter warm-up, a soft
   * ~25 ms attack (exponential then linear) and an exponential decay. Nodes live only for
   * the pulse (nothing runs between shifts).
   */
  private firePulse(
    voiceId: V10VoiceId,
    intensity: number,
    filterHz: number,
    decayMs: number,
    at: number,
  ) {
    const ctx = this.ctx;
    const bus = this.accentBus;
    if (!ctx || !bus || !this.buffer) return;
    const v = V10_SHIFT_VOICES[voiceId];
    const peak = v10PulsePeak(voiceId, intensity) * COYOTE_SHIFT_TRIM;
    if (peak <= 0.001) return;
    const t = Math.max(at, ctx.currentTime) + 0.002;
    const decayTau = Math.max(0.03, decayMs / 1000 / 3);
    const noise = getNoiseBuffer(ctx, v.color);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = v.type;
    filter.frequency.value = filterHz;
    filter.Q.value = v.q;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    src.connect(filter);
    filter.connect(g);
    g.connect(bus);
    const on = t + V10_FILTER_WARMUP_S;
    g.gain.setValueAtTime(0.0001, on);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak * 0.5), on + v.attackS * 0.4);
    g.gain.linearRampToValueAtTime(peak, on + v.attackS);
    g.gain.setTargetAtTime(0.0001, on + v.attackS, decayTau);
    // Own sequence for the noise offset: the shift setting must not move the pop dice.
    this.pulseSeed = (this.pulseSeed * 1664525 + 1013904223) >>> 0;
    src.start(t, (this.pulseSeed / 2 ** 32) * Math.max(0, noise.duration - 1));
    src.stop(on + v.attackS + decayTau * 9);
    this.live.add(src);
    this.shiftPulses += 1;
    const log = `${voiceId === "thump" ? "v10_thump" : "v10_shift"}@${t.toFixed(2)}`;
    this.shotLog.push(log);
    if (this.shotLog.length > 40) this.shotLog.shift();
    src.onended = () => {
      this.live.delete(src);
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }

  /* -------------------------------------------------------- race overrun */

  /**
   * Race mode, as the Racing V10: ignition cut through each upshift, the limiter bounce as an
   * 11 Hz ignition-cut gate, a crack on hard upshifts, pops on limiter cuts and overrun pops
   * with a crackle tail on lift-off and downshifts (not tied to the Drive+ extras switch).
   */
  private updateRace(state: DriveState, rpm: number, t: number) {
    const pt = state.powertrain;
    const demand = pt?.driverDemand ?? state.throttle;
    const shifting = Boolean(pt?.shifting || state.isShifting);
    const rpmNorm = Math.min(1, rpm / this.redlineRpm);
    const raceCut =
      shifting &&
      pt?.shiftDirection === "up" &&
      pt.shiftPhase !== "reengage" &&
      pt.shiftPhase !== "settle";
    this.updateRaceGate(Boolean(pt?.limiterActive), t, raceCut);
    const moving = state.speed * 3.6 > 4 || demand > 0.12;

    // Upshift crack at the top of the rev range.
    const ev = pt?.shiftEvent;
    if (
      ev &&
      ev.sequenceId === this.lastShiftSeq &&
      ev.direction === "up" &&
      ev.fromGear >= 1 &&
      this.lastShiftAt === t &&
      rpmNorm > V10_RACE.shiftCrackRpmNorm &&
      audioRandom() < this.voicing.pops.raceCrackProbability
    ) {
      this.playPopSequence("rev-match", V10_RACE.shiftCrackLevel * (0.7 + rpmNorm * 0.3), t + 0.02);
    }
    // Limiter: a pop on some ignition cuts.
    const cut = Boolean(pt?.limiterCut);
    if (
      cut &&
      !this.raceLastLimiterCut &&
      rpm > 2000 &&
      t - this.raceLastLimiterPopAt > V10_RACE.limiterPopGapS
    ) {
      if (audioRandom() < this.voicing.pops.limiterPopProbability) {
        this.raceLastLimiterPopAt = t;
        this.playPopSequence("rev-match", V10_RACE.limiterPopLevel, t);
      }
    }
    this.raceLastLimiterCut = cut;

    // Lift-off / downshift overrun pops (a lift is a drop from a recent peak demand).
    const lift =
      this.popPrevDemand > 0.18 &&
      this.popPrevDemand - demand > 0.15 &&
      demand < 0.06 &&
      rpm > 1500;
    const down = shifting && pt?.shiftDirection === "down";
    const downshift = down && !this.popPrevDownshift && rpm > 2000;
    if ((lift || downshift) && moving && t - this.racePopLastAt > V10_RACE.liftPopGapS) {
      if (audioRandom() < this.voicing.pops.raceLiftProbability) {
        this.racePopLastAt = t;
        const strength = V10_RACE.liftPops.level * (0.6 + rpmNorm * 0.6);
        const at = lift ? this.playAfterfire(rpm, t + 0.05) : t + 0.05;
        this.playPopSequence(downshift ? "rev-match" : "overrun", strength, at);
      }
      if (lift) this.popPrevDemand = 0;
    }
    this.popPrevDownshift = down;
    const dt = this.lastState
      ? Math.min(0.25, Math.max(0, (state.timestamp - this.lastState.timestamp) / 1000))
      : 0.016;
    this.popPrevDemand = Math.max(demand, this.popPrevDemand - dt * 0.05);
  }

  /** V10 updateRaceGate: limiter bounce at audio rate, ignition cut through an upshift. */
  private updateRaceGate(limiter: boolean, t: number, shiftCut: boolean) {
    const g = this.raceGate?.gain;
    const ctx = this.ctx;
    if (!g || !ctx) return;
    const now = Math.max(t, ctx.currentTime);
    if (!limiter) {
      if (shiftCut) {
        if (this.raceGateScheduledTo !== -1) {
          g.cancelScheduledValues(now);
          g.setTargetAtTime(this.voicing.pops.shiftGateFloor, now, 0.008);
          this.raceGateScheduledTo = -1;
        }
        return;
      }
      if (this.raceGateScheduledTo !== 0) {
        g.cancelScheduledValues(now);
        g.setTargetAtTime(1, now, 0.012);
        this.raceGateScheduledTo = 0;
      }
      return;
    }
    const from = Math.max(this.raceGateScheduledTo, now + 0.005);
    let next = from;
    for (const [cutAt, refireAt] of v10LimiterGateCycles(from, now + 0.12)) {
      g.setTargetAtTime(this.voicing.pops.limiterGateFloor, cutAt, 0.003);
      g.setTargetAtTime(1, refireAt, 0.005);
      next = cutAt + 1 / V10_RACE.limiterGateHz;
    }
    this.raceGateScheduledTo = next;
  }

  /** V10 firePopSequence on the bank: one to three pops, then a crackle tail. */
  private playPopSequence(kind: "rev-match" | "overrun", peak: number, at: number) {
    if (!this.buffer || !this.popBus) return;
    this.racePopSequences += 1;
    const pv = this.voicing.pops;
    for (const step of v10PopSequence(kind, peak, audioRandom)) {
      const crackle = step.id.startsWith("crackle");
      const level =
        step.level * (crackle ? RACE_CRACKLE_GAIN * pv.crackle : RACE_POP_GAIN * pv.level);
      this.fireOneShot(step.id, at + step.at, step.rate * pv.rate, level, this.popBus, false);
    }
  }

  /** Stop scheduled / still-playing overrun pops and drop unplayed ones from the log. */
  private cancelPendingPops(t: number) {
    if (this.pendingPops.length === 0) return;
    const now = Math.max(t, this.ctx?.currentTime ?? t);
    for (const pop of this.pendingPops) {
      const unplayed = pop.when > now + 1e-4;
      try {
        pop.gain.gain.cancelScheduledValues(now);
        pop.gain.gain.setValueAtTime(0, now);
        pop.src.stop(now);
      } catch {
        /* already stopped */
      }
      if (unplayed) {
        const idx = this.shotLog.lastIndexOf(pop.log);
        if (idx >= 0) this.shotLog.splice(idx, 1);
        if (this.oneShotsFired > 0) this.oneShotsFired -= 1;
      }
    }
    this.pendingPops = [];
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

  private fireOneShot(
    id: string,
    at: number,
    rate: number,
    level: number,
    bus: GainNode | null,
    cancellable = true,
  ) {
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
    const log = `${id}@${when.toFixed(2)}`;
    this.shotLog.push(log);
    if (this.shotLog.length > 40) this.shotLog.shift();
    if (cancellable && id.startsWith("pop")) this.pendingPops.push({ src, gain: g, when, log });
    src.onended = () => {
      this.live.delete(src);
      this.pendingPops = this.pendingPops.filter((p) => p.src !== src);
      src.disconnect();
      g.disconnect();
    };
  }

  /* ----------------------------------------------------------------- voicing */

  /** The voicing's fixed tone chain into dest; returns its input (dest itself for the V8). */
  private buildTone(ctx: BaseAudioContext, dest: AudioNode): AudioNode {
    const tone = this.voicing.tone;
    if (!tone) return dest;
    const input = ctx.createGain();
    const sum = ctx.createGain();
    input.connect(sum);
    const nodes: AudioNode[] = [input, sum];
    if (tone.grit) {
      // Parallel grit: the clipped copy is band-limited before it is mixed in (no fizz).
      const drive = ctx.createGain();
      drive.gain.value = 1;
      const shaper = ctx.createWaveShaper();
      shaper.curve = gritCurve(tone.grit.drive, tone.grit.asym) as Float32Array<ArrayBuffer>;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = tone.grit.lowpassHz;
      lp.Q.value = 0.6;
      const wet = ctx.createGain();
      wet.gain.value = tone.grit.mix;
      input.connect(drive);
      drive.connect(shaper);
      shaper.connect(lp);
      lp.connect(wet);
      wet.connect(sum);
      nodes.push(drive, shaper, lp, wet);
    }
    const low = ctx.createBiquadFilter();
    low.type = "lowshelf";
    low.frequency.value = tone.lowShelf.hz;
    low.gain.value = tone.lowShelf.db;
    const peak = ctx.createBiquadFilter();
    peak.type = "peaking";
    peak.frequency.value = tone.peak.hz;
    peak.gain.value = tone.peak.db;
    peak.Q.value = tone.peak.q;
    const high = ctx.createBiquadFilter();
    high.type = "highshelf";
    high.frequency.value = tone.highShelf.hz;
    high.gain.value = tone.highShelf.db;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = tone.lowpassHz;
    lp.Q.value = 0.5;
    const trim = ctx.createGain();
    trim.gain.value = tone.trim;
    sum.connect(low);
    low.connect(peak);
    peak.connect(high);
    high.connect(lp);
    lp.connect(trim);
    trim.connect(dest);
    nodes.push(low, peak, high, lp, trim);
    this.toneNodes = nodes;
    return input;
  }

  /**
   * '90 lifters: one looped buffer of short clicks (fixed number per engine cycle, uneven
   * strength), rate-locked to the rpm automation, band-passed so it stays a mechanical tick.
   * Locally seeded: does not move the shared random stream.
   */
  private buildValvetrain(ctx: BaseAudioContext, loopBus: GainNode) {
    const vt = this.voicing.valvetrain!;
    const refRpm = 1000;
    const cycles = 16;
    const sr = ctx.sampleRate;
    const n = Math.round((cycles * 120 * sr) / refRpm);
    const buf = ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    let seed = 0x90c1a5;
    const r = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    const ticks = cycles * vt.ticksPerCycle;
    const len = Math.round(0.0016 * sr);
    for (let k = 0; k < ticks; k += 1) {
      const pos = Math.round(((k + (r() - 0.5) * 0.12) * n) / ticks);
      const amp = (k % 2 ? 0.7 : 1) * (0.6 + 0.4 * r());
      for (let i = 0; i < len; i += 1) {
        const idx = (pos + i + n) % n;
        d[idx] = (d[idx] ?? 0) + amp * (r() * 2 - 1) * Math.exp(-i / (len / 5));
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = this.rpm / refRpm;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = vt.bandHz;
    band.Q.value = vt.q;
    const gain = ctx.createGain();
    gain.gain.value = vt.level * 0.7;
    src.connect(band);
    band.connect(gain);
    gain.connect(loopBus);
    src.start(ctx.currentTime);
    this.valvetrain = { src, gain, refRpm };
    this.toneNodes.push(band, gain);
  }

  private loadAfterfire(ctx: BaseAudioContext, url: string) {
    fetchBank(url)
      .then((bytes) => ctx.decodeAudioData(bytes.slice(0)))
      .then(
        (buffer) => {
          if (!this.disposed) this.afterfireBuffer = buffer;
        },
        () => {
          /* no afterfire: the Coyote pops still play */
        },
      );
  }

  /**
   * O))) lift-off: one or two of the profile's deep afterfire bangs, scaled by rpm, before the
   * pops. Returns when the pops should follow (unchanged when there is no afterfire).
   */
  private playAfterfire(rpm: number, at: number): number {
    const af = this.voicing.afterfire;
    const ctx = this.ctx;
    const buf = this.afterfireBuffer;
    if (!af || !ctx || !buf || !this.popBus) return at;
    const s = afterfireStrength(af, rpm);
    if (s <= 0 || at - this.afterfireLastAt < 1) return at;
    this.afterfireLastAt = at;
    const count = s > 0.5 && audioRandom() < 0.6 ? af.maxBangs : 1;
    let t = at;
    let level = af.level * (0.6 + 0.4 * s);
    for (let k = 0; k < count; k += 1) {
      const shot = af.bangs[Math.floor(audioRandom() * af.bangs.length) % af.bangs.length]!;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = af.rate * (0.94 + audioRandom() * 0.12);
      const g = ctx.createGain();
      g.gain.value = level;
      src.connect(g);
      g.connect(this.popBus);
      const when = Math.max(t, ctx.currentTime);
      src.start(when, shot.start, shot.end - shot.start);
      this.live.add(src);
      this.afterfireShots += 1;
      this.shotLog.push(`afterfire@${when.toFixed(2)}`);
      if (this.shotLog.length > 40) this.shotLog.shift();
      src.onended = () => {
        this.live.delete(src);
        src.disconnect();
        g.disconnect();
      };
      // Separate explosions, not one smeared bang.
      t += 0.09 + audioRandom() * 0.16;
      level *= 0.75;
    }
    return t + 0.06;
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
    if (this.valvetrain) {
      try {
        this.valvetrain.src.stop();
      } catch {
        /* already stopped */
      }
      this.valvetrain = null;
    }
    for (const node of this.toneNodes) {
      try {
        node.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.toneNodes = [];
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
