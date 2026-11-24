/**
 * Private Jet Oberpfaffenhofen: turbo whistle on take-off.
 *
 * Reuses the hybrid synth's turbo maths (turbo-whistle.ts: spool from rpm × load, the
 * same two detuned compressor-blade sines) and adds a take-off gate on top:
 * - arms while slow (below TAKEOFF_ARM_KMH, e.g. parked or rolling at a light);
 * - opens on a strong launch (acceleration and throttle), so a normal crawl stays quiet;
 * - while open the whistle rises with spool (rpm × load) and with speed;
 * - fades on lift-off / braking, once the pull settles into cruise, or above TAKEOFF_END_KMH.
 * After a take-off it re-arms only when the car is slow again (next launch from a stop).
 *
 * CPU: two sine oscillators and one gain, a few AudioParam targets per frame.
 */
import type { DriveState } from "@/lib/drive/model";
import {
  TURBO_WHISTLE_DETUNE,
  followTurboSpool,
  turboBoostWant,
  turboWhistleHz,
  type TurboWhistleRange,
} from "@/lib/sound/realism/v2/turbo-whistle";

export const TAKEOFF_ARM_KMH = 30;
export const TAKEOFF_END_KMH = 170;
/** m/s² that counts as a take-off launch (with throttle). */
export const TAKEOFF_LAUNCH_ACCEL = 1.3;
export const TAKEOFF_LAUNCH_THROTTLE = 0.35;
/** Below this the pull is over (lift-off, braking or steady cruise). */
export const TAKEOFF_HOLD_ACCEL = 0.45;
export const TAKEOFF_HOLD_THROTTLE = 0.18;
/** Seconds the pull may sag below the hold levels (gear changes) before the whistle fades. */
export const TAKEOFF_GRACE_S = 0.6;
/** Peak whistle gain into the cabin bus. */
export const TAKEOFF_WHISTLE_LEVEL = 0.085;
/** Jet-like range: lower start than Ge-Squared's own small turbo, climbs with speed. */
export const TAKEOFF_WHISTLE_RANGE: TurboWhistleRange = { baseHz: 2300, spanHz: 2300 };
export const TAKEOFF_WHISTLE_SPEED_HZ = 900;
/** Ge-Squared spool lag (profile-experience-config aspirationDynamics). */
const SPOOL_ATTACK_S = 0.7;
const SPOOL_DECAY_S = 0.45;
/** Ge-Squared acoustic redline (BITURBO_V8_4X4). */
const REDLINE_RPM = 6200;

/** Per-aircraft tuning; every field defaults to the Private Jet values above. */
export interface TakeoffWhistleParams {
  armKmh: number;
  endKmh: number;
  launchAccel: number;
  launchThrottle: number;
  level: number;
  range: TurboWhistleRange;
  speedHz: number;
  /**
   * Gearless bases (rpm 0, e.g. Rocket Car): derive the spool rpm from speed instead,
   * idle → full rpm over 0 → fullKmh.
   */
  rpmFromSpeed?: { idleRpm: number; fullRpm: number; fullKmh: number };
}

export const PRIVATE_JET_WHISTLE: TakeoffWhistleParams = {
  armKmh: TAKEOFF_ARM_KMH,
  endKmh: TAKEOFF_END_KMH,
  launchAccel: TAKEOFF_LAUNCH_ACCEL,
  launchThrottle: TAKEOFF_LAUNCH_THROTTLE,
  level: TAKEOFF_WHISTLE_LEVEL,
  range: TAKEOFF_WHISTLE_RANGE,
  speedHz: TAKEOFF_WHISTLE_SPEED_HZ,
};

export interface TakeoffWhistleFrame {
  active: boolean;
  gate: number;
  spool: number;
  gain: number;
  hz: number;
}

export interface TakeoffWhistleModel {
  step(state: DriveState, dt: number): TakeoffWhistleFrame;
  readonly takeoffs: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Pure control model (no audio): testable frame by frame. */
export function createTakeoffWhistleModel(
  params: TakeoffWhistleParams = PRIVATE_JET_WHISTLE,
): TakeoffWhistleModel {
  const P = params;
  let armed = true;
  let active = false;
  let sag = 0;
  let gate = 0;
  let spool = 0;
  let takeoffs = 0;
  return {
    get takeoffs() {
      return takeoffs;
    },
    step(state, dt) {
      const pt = state.powertrain;
      const kmh = Math.max(0, state.speed || 0) * 3.6;
      const acc = state.accelerationEstimated ?? state.acceleration ?? 0;
      const throttle = pt?.driverDemand ?? state.throttle ?? 0;
      const load = pt?.engineLoad ?? state.load ?? 0;
      const rs = P.rpmFromSpeed;
      const rpm = rs
        ? rs.idleRpm + (rs.fullRpm - rs.idleRpm) * clamp01(kmh / rs.fullKmh)
        : (pt?.rpm ?? state.rpm ?? 0);
      if (!active && kmh < P.armKmh && throttle < TAKEOFF_HOLD_THROTTLE) armed = true;
      const launch = acc >= P.launchAccel && throttle >= P.launchThrottle;
      if (!active && armed && launch && kmh < P.armKmh + 20) {
        active = true;
        armed = false;
        sag = 0;
        takeoffs += 1;
      }
      if (active) {
        const holding = acc >= TAKEOFF_HOLD_ACCEL && throttle >= TAKEOFF_HOLD_THROTTLE;
        sag = holding ? 0 : sag + dt;
        if (sag > TAKEOFF_GRACE_S || kmh > P.endKmh || state.regen > 0.35) active = false;
      }
      const gateTau = active ? 0.35 : 0.7;
      gate += ((active ? 1 : 0) - gate) * (1 - Math.exp(-dt / gateTau));
      spool = followTurboSpool(
        spool,
        turboBoostWant(rpm, load, throttle, pt?.boost ?? 0),
        dt,
        SPOOL_ATTACK_S,
        SPOOL_DECAY_S,
      );
      const speedNorm = clamp01(kmh / 140);
      const gain =
        gate > 0.002
          ? P.level * gate * (0.35 + 0.65 * Math.pow(spool, 1.2)) * (0.75 + 0.25 * speedNorm)
          : 0;
      const hz = turboWhistleHz(spool, clamp01(rpm / REDLINE_RPM), P.range) + speedNorm * P.speedHz;
      return { active, gate, spool, gain, hz };
    },
  };
}

export interface TakeoffWhistleVoice {
  update(state: DriveState, t: number): void;
  dispose(): void;
  diagnostics(): TakeoffWhistleFrame & { takeoffs: number };
}

export function createTakeoffWhistleVoice(
  ctx: BaseAudioContext,
  destination: AudioNode,
  params: TakeoffWhistleParams = PRIVATE_JET_WHISTLE,
): TakeoffWhistleVoice {
  const model = createTakeoffWhistleModel(params);
  const out = ctx.createGain();
  out.gain.value = 0;
  const oscs = [1, TURBO_WHISTLE_DETUNE].map((ratio) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = params.range.baseHz * ratio;
    o.connect(out);
    o.start();
    return o;
  });
  out.connect(destination);
  let lastT: number | null = null;
  let frame: TakeoffWhistleFrame = { active: false, gate: 0, spool: 0, gain: 0, hz: 0 };
  let disposed = false;
  return {
    update(state, t) {
      if (disposed) return;
      const dt = lastT === null ? 0.016 : Math.min(0.25, Math.max(0, t - lastT));
      lastT = t;
      frame = model.step(state, dt);
      out.gain.setTargetAtTime(frame.gain, t, 0.12);
      oscs.forEach((o, i) =>
        o.frequency.setTargetAtTime(frame.hz * (i === 0 ? 1 : TURBO_WHISTLE_DETUNE), t, 0.15),
      );
    },
    diagnostics: () => ({ ...frame, takeoffs: model.takeoffs }),
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        const t = ctx.currentTime;
        out.gain.setTargetAtTime(0, t, 0.05);
        oscs.forEach((o) => o.stop(t + 0.3));
      } catch {
        /* closed context */
      }
      setTimeout(() => out.disconnect(), 400);
    },
  };
}
