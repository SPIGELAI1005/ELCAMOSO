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
  },
};

type Phase = "off" | "climb" | "bounce" | "shift" | "blend";

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

  constructor(private readonly cfg: HardRevConfig) {}

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
      } else {
        return out;
      }
    }

    // Leave on a lift / easing off (after a short grace so GPS noise does not drop out).
    const easing = demand < c.exitDemand || accel < c.exitAccelMs2;
    this.lowMs = easing ? this.lowMs + dtMs : 0;
    if (this.phase !== "blend" && this.phase !== "shift" && this.lowMs > 300) {
      this.phase = "blend";
      this.phaseMs = 0;
      this.blendFromRpm = this.rpm;
    }

    this.phaseMs += dtMs;
    let limiterActive = false;
    let limiterCut = false;
    let shifting = false;
    let shiftPhase: NonNullable<VirtualPowertrainState["shiftPhase"]> = "idle";
    let shiftEvent: DrivetrainShiftEvent | null = null;

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
      if (p >= 1) {
        this.phase = "off";
        return out;
      }
      // Hand the gear back to the base map when the blend starts.
      this.gear = out.gear;
    }

    const res: VirtualPowertrainState = {
      ...out,
      rpm: this.rpm,
      gear: this.phase === "blend" ? out.gear : this.gear,
      targetGear: this.phase === "blend" ? out.targetGear : this.gear,
      shifting: shifting || (this.phase === "blend" && out.shifting),
      shiftPhase: (shifting ? shiftPhase : this.phase === "blend" ? out.shiftPhase : "idle") ?? "idle",
      lastShiftEvent: this.lastEvent ?? out.lastShiftEvent,
      shiftEvent: shiftEvent ?? (this.phase === "blend" ? out.shiftEvent : null),
      revMatchActive: this.phase === "blend" ? out.revMatchActive : false,
      shiftLoadMultiplier: shifting ? 0.3 : 1,
    };
    if (shifting) {
      res.shiftDirection = "up";
      res.shiftProgress = Math.min(1, this.phaseMs / c.shiftMs);
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
