import type { CalibrationTrace, CalibrationTraceSample } from "@/lib/calibration/types";

export interface ShiftEventDetail {
  atMs: number;
  fromGear: number;
  toGear: number;
  direction: "up" | "down";
  speedBeforeKmh: number;
  speedAfterKmh: number;
  rpmBefore: number;
  rpmAfter: number;
  mechanicalRpmAfter: number;
  driverDemand: number;
  reason: string;
  durationMs: number;
  shiftPhasePeak: string;
}

export interface CalibrationMetrics {
  upshifts: number;
  downshifts: number;
  gearHuntingEvents: number;
  averageTimeBetweenShiftsMs: number | null;
  minimumGearHoldMs: number | null;
  rpmDiscontinuitiesOutsideShifts: number;
  largestShiftRpmError: number;
  redlineViolations: number;
  invalidDownshiftAttempts: number;
  kickdownResponseMs: number | null;
  sensorTransitionInducedShifts: number;
  shiftEvents: ShiftEventDetail[];
  flags: string[];
}

function sampleAt(samples: CalibrationTraceSample[], tMs: number): CalibrationTraceSample | null {
  if (!samples.length) return null;
  let best = samples[0]!;
  for (const s of samples) {
    if (Math.abs(s.tMs - tMs) < Math.abs(best.tMs - tMs)) best = s;
  }
  return best;
}

export function extractShiftEvents(samples: CalibrationTraceSample[]): ShiftEventDetail[] {
  const events: ShiftEventDetail[] = [];
  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1]!;
    const cur = samples[i]!;
    if (prev.gear === cur.gear) continue;
    if (prev.gear < 1 || cur.gear < 1) continue;
    if (Math.abs(cur.gear - prev.gear) !== 1) continue;
    const direction: "up" | "down" = cur.gear > prev.gear ? "up" : "down";
    // Estimate duration from shifting flag window
    let start = i - 1;
    while (start > 0 && samples[start]!.shifting) start -= 1;
    let end = i;
    while (end < samples.length - 1 && samples[end]!.shifting) end += 1;
    const durationMs = Math.max(0, samples[end]!.tMs - samples[start]!.tMs);
    events.push({
      atMs: cur.tMs,
      fromGear: prev.gear,
      toGear: cur.gear,
      direction,
      speedBeforeKmh: prev.fusedSpeedKmh || prev.speedKmh,
      speedAfterKmh: cur.fusedSpeedKmh || cur.speedKmh,
      rpmBefore: prev.rpm,
      rpmAfter: cur.rpm,
      mechanicalRpmAfter: cur.mechanicalRpm,
      driverDemand: cur.driverDemand,
      reason: cur.lastShiftReason || prev.lastShiftReason || "unknown",
      durationMs,
      shiftPhasePeak: cur.shiftPhase,
    });
  }
  return events;
}

export function computeCalibrationMetrics(
  trace: CalibrationTrace,
  opts?: { redlineRpm?: number },
): CalibrationMetrics {
  const samples = trace.samples;
  const shifts = extractShiftEvents(samples);
  const upshifts = shifts.filter((s) => s.direction === "up").length;
  const downshifts = shifts.filter((s) => s.direction === "down").length;
  const redline = opts?.redlineRpm ?? 7500;

  let hunting = 0;
  for (let i = 2; i < shifts.length; i += 1) {
    const a = shifts[i - 2]!;
    const b = shifts[i - 1]!;
    const c = shifts[i]!;
    if (a.toGear === c.toGear && b.toGear !== a.toGear && c.atMs - a.atMs < 2500) hunting += 1;
  }

  const holds: number[] = [];
  for (let i = 1; i < shifts.length; i += 1) {
    holds.push(shifts[i]!.atMs - shifts[i - 1]!.atMs);
  }
  const averageTimeBetweenShiftsMs = holds.length
    ? holds.reduce((a, b) => a + b, 0) / holds.length
    : null;
  const minimumGearHoldMs = holds.length ? Math.min(...holds) : null;

  let rpmDiscontinuitiesOutsideShifts = 0;
  let largestShiftRpmError = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1]!;
    const b = samples[i]!;
    if (a.shifting || b.shifting || a.gear !== b.gear) {
      if (a.gear !== b.gear && a.gear > 0 && b.gear > 0) {
        const err = Math.abs(b.rpm - b.mechanicalRpm);
        if (err > largestShiftRpmError) largestShiftRpmError = err;
      }
      continue;
    }
    if (b.gear > 0 && Math.abs(b.rpm - a.rpm) > 900) rpmDiscontinuitiesOutsideShifts += 1;
  }

  let redlineViolations = 0;
  for (const s of samples) {
    if (s.rpm > redline * 1.02 && !s.shifting) redlineViolations += 1;
  }

  let invalidDownshiftAttempts = 0;
  for (const s of samples) {
    if (s.lastShiftReason === "kickdown" && s.queuedTargetGear < s.gear) {
      // Count frames where queue wants lower but mechanical would exceed soft redline proxy
      if (s.mechanicalRpm > redline * 0.98) invalidDownshiftAttempts += 1;
    }
  }

  let kickdownResponseMs: number | null = null;
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1]!;
    const b = samples[i]!;
    if (b.driverDemand - a.driverDemand > 0.35 && b.driverDemand > 0.75) {
      const tipIn = b.tMs;
      const nextDown = shifts.find(
        (s) => s.direction === "down" && s.atMs >= tipIn && s.atMs < tipIn + 2500,
      );
      if (nextDown) {
        kickdownResponseMs = nextDown.atMs - tipIn;
        break;
      }
    }
  }

  let sensorTransitionInducedShifts = 0;
  for (const sh of shifts) {
    const near = sampleAt(samples, sh.atMs);
    if (near?.transitioning) sensorTransitionInducedShifts += 1;
  }

  const flags: string[] = [];
  if (hunting > 0) flags.push(`gear hunting ×${hunting}`);
  if (rpmDiscontinuitiesOutsideShifts > 0) {
    flags.push(`RPM discontinuities outside shifts ×${rpmDiscontinuitiesOutsideShifts}`);
  }
  if (redlineViolations > 0) flags.push(`redline violations ×${redlineViolations}`);
  if (minimumGearHoldMs != null && minimumGearHoldMs < 200) {
    flags.push(`very short gear hold ${minimumGearHoldMs} ms`);
  }
  if (sensorTransitionInducedShifts > 0) {
    flags.push(`shifts during sensor transition ×${sensorTransitionInducedShifts}`);
  }

  return {
    upshifts,
    downshifts,
    gearHuntingEvents: hunting,
    averageTimeBetweenShiftsMs,
    minimumGearHoldMs,
    rpmDiscontinuitiesOutsideShifts,
    largestShiftRpmError,
    redlineViolations,
    invalidDownshiftAttempts,
    kickdownResponseMs,
    sensorTransitionInducedShifts,
    shiftEvents: shifts,
    flags,
  };
}
