import type { DriveState } from "@/lib/drive/model";
import type { SoundProfile } from "@/lib/sound/profiles";

export type DemoSelector = "P" | "R" | "N" | "D";

export interface DemoControls {
  throttle: number;
  accel: number;
  regen: number;
  /** Park / Reverse / Neutral / Drive for demo listening. */
  selector: DemoSelector;
}

export const DEMO_DEFAULTS: DemoControls = {
  throttle: 0.3,
  accel: 0.5,
  regen: 0,
  selector: "D",
};

/** Demo-mode speed integration (P/R/N/D selector, throttle, regen). */
export function tickDemoSpeed(
  speedMs: number,
  dt: number,
  demo: DemoControls,
): { speedMs: number; accelerationMs2: number } {
  const { throttle, accel, regen, selector } = demo;
  const drag = 0.02 * speedMs + 0.25;
  const freewheeling = selector === "P" || selector === "N";
  const push = freewheeling ? 0 : throttle * (1.6 + accel * 4.4);
  const holdBrake =
    selector === "P"
      ? speedMs > 0.15
        ? 0.95
        : 0
      : selector === "N"
        ? speedMs > 0.15
          ? 0.55
          : 0
        : 0;
  const brake = Math.max(regen, holdBrake) * (selector === "P" ? 5.5 : 4.2);
  const a = push - brake - (speedMs > 0 ? drag : 0);
  const prev = speedMs;
  const nextSpeed = Math.max(0, Math.min(80, prev + a * dt));
  return {
    speedMs: nextSpeed,
    accelerationMs2: (nextSpeed - prev) / dt,
  };
}

/** Merge demo PRND/throttle overrides into computed drive state. */
export function applyDemoDriveOverrides(
  next: DriveState,
  opts: {
    demo: DemoControls;
    speedMs: number;
    profile: SoundProfile;
    dynamicDriveActive: boolean;
  },
): void {
  const { demo, speedMs, profile, dynamicDriveActive } = opts;
  const sel = demo.selector;
  const canRev = sel === "N" || sel === "D" || sel === "R";
  const throttle = canRev ? Math.min(1, Math.max(0, demo.throttle)) : 0;
  const regen = Math.min(1, Math.max(0, demo.regen));
  const neutralRev = sel === "N";

  next.throttle = Math.max(next.throttle, throttle);
  next.regen =
    sel === "P" && speedMs > 0.2 ? Math.max(next.regen, 0.85, regen) : Math.max(next.regen, regen);

  if (!dynamicDriveActive) {
    if (neutralRev && canRev && throttle > 0.02) {
      // Neutral only: free-rev; in D/R keep computeDriveState gear + RPM for shift feel.
      next.load = Math.max(next.load, Math.min(1, throttle * 0.98));
      const tx = profile.transmission;
      if (profile.drivetrainMode !== "continuous" && tx) {
        const revRpm = tx.idleRpm + throttle * (tx.redlineRpm - tx.idleRpm) * 0.96;
        next.rpm = Math.max(next.rpm, Math.min(tx.redlineRpm, revRpm));
      }
    } else if (sel === "P") {
      next.throttle = 0;
    }

    if (sel === "P" || sel === "N") next.gear = 0;
    else if (sel === "R") next.gear = -1;
  } else if (next.powertrain) {
    next.gear = next.powertrain.gear;
    next.rpm = next.powertrain.rpm;
    next.load = next.powertrain.load;
    next.throttle = next.powertrain.throttle;
    next.isShifting = next.powertrain.shifting;
    if (sel === "R") next.gear = -1;
    else if (sel === "P") next.throttle = 0;
  }
}
