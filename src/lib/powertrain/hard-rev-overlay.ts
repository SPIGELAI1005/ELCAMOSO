import type { DrivetrainShiftEvent, VirtualPowertrainState } from "@/lib/powertrain/types";

/**
 * Superbike-only "hard rev" overlay (opt-in by powertrain profile id).
 *
 * Real road speeds (GPS, car-paced acceleration) keep a superbike at 4-6k rpm in
 * physical gearing, so the scream never plays. On a hard / full-throttle pull this
 * overlay runs a virtual rev ladder instead: revs climb to the limiter, bounce on
 * it briefly (over-rev), then a quickshifted upshift drops them to the next gear's
 * rpm. Gentle riding keeps the normal map. Road speed and the base simulator are
 * untouched; only the reported rpm / gear / shift flags change while active.
 * Every other profile never constructs this, so cars stay byte-identical.
 */
export interface HardRevConfig {
  enterDemand: number;
  enterAccelMs2: number;
  exitDemand: number;
  exitAccelMs2: number;
  limiterRpm: number;
  bounceMs: number;
  bounceHz: number;
  bounceRpm: number;
  shiftMs: number;
  /** rpm gained per km/h of road-speed gain in 1st; each higher gear by gearRateFalloff. */
  climbRpmPerKmh: number;
  /** Floor climb rate (rpm/s) so a GPS stall cannot freeze the revs mid-pull. */
  minClimbRpmPerSec: number;
  /** Top gear holds just under the limiter instead of bouncing on it. */
  topGearCapRpm: number;
  gearRateFalloff: number;
  gearRatios: number[];
  blendOutMs: number;
  /** Hard-braking downshift ladder: enter at this decel (m/s², positive) above brakeMinKmh. */
  brakeEnterMs2: number;
  brakeExitMs2: number;
  brakeMinKmh: number;
  brakeStopKmh: number;
  /** Downshift when revs fall to this (gentle..hard braking), flaring into the lower gear. */
  downRpm: [number, number];
  downFlareCapRpm: number;
  /** Flare target (rpm) for gentle..hard braking; the ratio jump can go higher up to the cap. */
  downFlare: [number, number];
  /** Auto-blip overshoot on top of the ratio jump (fraction). */
  downBlip: number;
  downShiftMs: number;
}

export const HARD_REV_BY_PROFILE: Record<string, HardRevConfig> = {
  "motorcycle-inline-4": {
    enterDemand: 0.5,
    enterAccelMs2: 2.6,
    exitDemand: 0.22,
    exitAccelMs2: 0.35,
    limiterRpm: 14200,
    bounceMs: 200,
    bounceHz: 16,
    bounceRpm: 380,
    shiftMs: 60,
    climbRpmPerKmh: 260,
    minClimbRpmPerSec: 900,
    topGearCapRpm: 13600,
    gearRateFalloff: 0.7,
    gearRatios: [3.5, 2.55, 1.95, 1.62, 1.38, 1.2],
    blendOutMs: 700,
    brakeEnterMs2: 2.5,
    brakeExitMs2: 1.5,
    brakeMinKmh: 55,
    brakeStopKmh: 30,
    downRpm: [8300, 9800],
    downFlareCapRpm: 13800,
    downFlare: [10500, 12800],
    downBlip: 0.05,
    downShiftMs: 90,
  },
};

type Phase = "off" | "climb" | "bounce" | "shift" | "blend" | "decel" | "dshift";

export class HardRevOverlay {
  private phase: Phase = "off";
  private gear = 1;
  private rpm = 0;
  private phaseMs = 0;
  private lowMs = 0;
  private shiftFromRpm = 0;
  private shiftToRpm = 0;
  private blendFromRpm = 0;
  private lastEvent: DrivetrainShiftEvent | null = null;
  private brake = 0;
  private brakeLowMs = 0;

  constructor(private readonly cfg: HardRevConfig) {}

  private pendingDown = false;
  private blendFromBrake = false;

  /** While blending out of a braking ladder, the base map's catch-up downshifts above the ladder gear are silent. */
  private hideBaseShift(out: VirtualPowertrainState): boolean {
    return this.blendFromBrake && out.gear >= this.gear;
  }

  private enterDecel() {
    this.blendFromBrake = false;
    this.phase = "decel";
    this.phaseMs = 0;
    this.brakeLowMs = 0;
    this.brake = 0;
    // An aggressive rider clicks down straight away when the brakes go on.
    this.pendingDown = true;
  }

  private beginDown(out: VirtualPowertrainState, nextSequenceId: () => number): DrivetrainShiftEvent {
    const c = this.cfg;
    this.pendingDown = false;
    const from = this.gear;
    const to = Math.max(1, from - 1);
    const jump = c.gearRatios[to - 1]! / c.gearRatios[from - 1]!;
    this.shiftFromRpm = this.rpm;
    // Engine-braking flare: the lower gear spins the engine up, the auto-blip adds a little more.
    const floor = c.downFlare[0] + (c.downFlare[1] - c.downFlare[0]) * this.brake;
    this.shiftToRpm = Math.min(c.downFlareCapRpm, Math.max(floor, this.rpm * jump * (1 + c.downBlip * (0.5 + this.brake))));
    this.gear = to;
    this.phase = "dshift";
    this.phaseMs = 0;
    const ev: DrivetrainShiftEvent = { sequenceId: nextSequenceId(), atMs: out.timestamp, fromGear: from, toGear: to, direction: "down", reason: "hard-rev-brake" };
    this.lastEvent = ev;
    return ev;
  }

  get active(): boolean {
    return this.phase !== "off";
  }

  reset() {
    this.phase = "off";
    this.lastEvent = null;
  }

  apply(out: VirtualPowertrainState, dtMs: number, nextSequenceId: () => number): VirtualPowertrainState {
    const c = this.cfg;
    const demand = out.driverDemand ?? 0;
    const accel = out.diagnostics?.accelerationFilteredMs2 ?? 0;
    const top = c.gearRatios.length;

    if (this.phase === "off") {
      if (out.gear >= 1 && out.gear < top && !out.shifting && demand >= c.enterDemand && accel >= c.enterAccelMs2) {
        this.phase = "climb";
        this.gear = out.gear;
        this.rpm = Math.max(out.rpm, 3000);
        this.phaseMs = 0;
        this.lowMs = 0;
      } else if (out.gear >= 2 && accel <= -c.brakeEnterMs2 && out.speedKmh >= c.brakeMinKmh) {
        this.gear = out.gear;
        this.rpm = out.rpm;
        this.enterDecel();
      } else {
        return out;
      }
    }
    // Hard braking during / right after a pull: go straight to the downshift ladder.
    if ((this.phase === "climb" || this.phase === "bounce" || (this.phase === "blend" && !this.blendFromBrake)) &&
        this.gear >= 2 && accel <= -c.brakeEnterMs2 && out.speedKmh >= c.brakeMinKmh) {
      if (this.phase === "blend") { this.gear = Math.max(this.gear, out.gear); }
      this.enterDecel();
    }
    const braking = this.phase === "decel" || this.phase === "dshift";
    if (braking) {
      const b = Math.min(1, Math.max(0, (-accel - c.brakeEnterMs2) / 4.5));
      this.brake = Math.max(b, this.brake - dtMs / 3000);
      this.brakeLowMs = -accel < c.brakeExitMs2 ? this.brakeLowMs + dtMs : 0;
      if (this.phase === "decel" && (this.brakeLowMs > 300 || out.speedKmh < c.brakeStopKmh || (this.gear <= 2 && this.phaseMs > 900))) {
        this.phase = "blend"; this.blendFromBrake = true;
        this.phaseMs = 0;
        this.blendFromRpm = this.rpm;
      }
    }

    // Leave on a lift / easing off (after a short grace so GPS noise does not drop out).
    const easing = demand < c.exitDemand || accel < c.exitAccelMs2;
    this.lowMs = easing ? this.lowMs + dtMs : 0;
    if ((this.phase === "climb" || this.phase === "bounce") && this.lowMs > 300) {
      this.blendFromBrake = false;
      this.phase = "blend";
      this.phaseMs = 0;
      this.blendFromRpm = this.rpm;
    }

    this.phaseMs += dtMs;
    let limiterActive = false;
    let limiterCut = false;
    let shifting = false;
    let shiftPhase: NonNullable<VirtualPowertrainState["shiftPhase"]> = "idle";
    let shiftEvent: DrivetrainShiftEvent | null = this.pendingDown ? this.beginDown(out, nextSequenceId) : null;

    let shiftDir: "up" | "down" = "up";
    let revMatch = false;
    if (this.phase === "decel") {
      // Revs bleed off with the road speed (engine braking), then the next downshift flares them.
      const kmhPerSec = Math.max(0, -accel) * 3.6;
      const rate = Math.max(1500, kmhPerSec * c.climbRpmPerKmh * Math.pow(c.gearRateFalloff, this.gear - 1));
      this.rpm = Math.max(3000, this.rpm - (rate * dtMs) / 1000);
      const downAt = c.downRpm[0] + (c.downRpm[1] - c.downRpm[0]) * this.brake;
      if ((this.rpm <= downAt || (this.rpm < c.downRpm[0] && this.phaseMs >= 700)) && this.gear > 2 && out.speedKmh >= c.brakeStopKmh) {
        shiftEvent = this.beginDown(out, nextSequenceId);
      }
    }
    if (this.phase === "dshift") {
      shifting = true;
      shiftDir = "down";
      const p = Math.min(1, this.phaseMs / c.downShiftMs);
      shiftPhase = p < 0.35 ? "disengage" : p < 0.8 ? "ratio_transition" : "reengage";
      revMatch = p < 0.8;
      this.rpm = this.shiftFromRpm + (this.shiftToRpm - this.shiftFromRpm) * (1 - Math.pow(1 - p, 2.2));
      if (p >= 1) {
        this.phase = "decel";
        this.phaseMs = 0;
      }
    }
    if (this.phase === "climb") {
      const kmhPerSec = Math.max(0, accel) * 3.6;
      const rate = Math.max(c.minClimbRpmPerSec, kmhPerSec * c.climbRpmPerKmh * Math.pow(c.gearRateFalloff, this.gear - 1));
      const cap = this.gear >= top ? c.topGearCapRpm : c.limiterRpm;
      this.rpm = Math.min(cap, this.rpm + (rate * dtMs) / 1000);
      if (this.gear < top && this.rpm >= c.limiterRpm) {
        this.phase = "bounce";
        this.phaseMs = 0;
      }
    }
    if (this.phase === "bounce") {
      limiterActive = true;
      const ph = ((this.phaseMs / 1000) * c.bounceHz) % 1;
      limiterCut = ph < 0.4;
      const dip = limiterCut ? ph / 0.4 : 1 - (ph - 0.4) / 0.6;
      this.rpm = c.limiterRpm - c.bounceRpm * dip;
      if (this.phaseMs >= c.bounceMs) {
        const from = this.gear;
        const to = this.gear + 1;
        this.shiftFromRpm = c.limiterRpm;
        this.shiftToRpm = c.limiterRpm * (c.gearRatios[to - 1]! / c.gearRatios[from - 1]!);
        this.gear = to;
        this.phase = "shift";
        this.phaseMs = 0;
        shiftEvent = { sequenceId: nextSequenceId(), atMs: out.timestamp, fromGear: from, toGear: to, direction: "up", reason: "hard-rev" };
        this.lastEvent = shiftEvent;
      }
    }
    if (this.phase === "shift") {
      shifting = true;
      const p = Math.min(1, this.phaseMs / c.shiftMs);
      shiftPhase = p < 0.6 ? "torque_cut" : "reengage";
      this.rpm = this.shiftFromRpm + (this.shiftToRpm - this.shiftFromRpm) * (1 - Math.pow(1 - p, 2));
      if (p >= 1) {
        this.phase = this.lowMs > 300 ? "blend" : "climb";
        this.phaseMs = 0;
        this.blendFromRpm = this.rpm;
      }
    }
    if (this.phase === "blend") {
      const p = Math.min(1, this.phaseMs / c.blendOutMs);
      const e = p * p * (3 - 2 * p);
      this.rpm = this.blendFromRpm + (out.rpm - this.blendFromRpm) * e;
      if (p >= 1 && (!this.blendFromBrake || out.gear <= this.gear || this.phaseMs > 4000)) {
        this.phase = "off";
        return out;
      }
      // Hand the gear back to the base map when the blend starts.
      // After a pull hand the gear back now; after a braking ladder never show a higher gear than the ladder reached.
      if (!this.blendFromBrake) this.gear = out.gear;
    }

    const res: VirtualPowertrainState = {
      ...out,
      rpm: this.rpm,
      gear: this.phase === "blend" ? (this.blendFromBrake ? Math.min(out.gear, this.gear) : out.gear) : this.gear,
      targetGear: this.phase === "blend" ? out.targetGear : this.gear,
      shifting: shifting || (this.phase === "blend" && out.shifting && !this.hideBaseShift(out)),
      shiftPhase: (shifting ? shiftPhase : this.phase === "blend" ? out.shiftPhase : "idle") ?? "idle",
      lastShiftEvent: this.lastEvent ?? out.lastShiftEvent,
      shiftEvent: shiftEvent ?? (this.phase === "blend" && !this.hideBaseShift(out) ? out.shiftEvent : null),
      revMatchActive: this.phase === "blend" ? out.revMatchActive : revMatch,
      ...(revMatch ? { revMatchProgress: Math.min(1, this.phaseMs / c.downShiftMs) } : {}),
      ...(braking && this.phase !== "blend" ? { overrun: true } : {}),
      shiftLoadMultiplier: shifting ? 0.3 : 1,
    };
    if (shifting) {
      res.shiftDirection = shiftDir;
      res.shiftProgress = Math.min(1, this.phaseMs / (shiftDir === "down" ? c.downShiftMs : c.shiftMs));
    } else if (this.phase !== "blend") {
      delete res.shiftDirection;
      delete res.shiftProgress;
    }
    if (limiterActive) {
      res.limiterActive = true;
      res.limiterCut = limiterCut;
    } else if (this.phase !== "blend") {
      delete res.limiterActive;
      delete res.limiterCut;
    }
    return res;
  }
}
