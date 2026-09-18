import { computeCalibrationMetrics, extractShiftEvents } from "@/lib/calibration/metrics";
import type { CalibrationTrace } from "@/lib/calibration/types";

export interface ShiftComparisonRow {
  fromGear: number;
  toGear: number;
  beforeAtMs: number;
  afterAtMs: number;
  beforeSpeedKmh: number;
  afterSpeedKmh: number;
  beforeRpm: number;
  afterRpm: number;
  beforeDemand: number;
  afterDemand: number;
  deltaSpeedKmh: number;
  deltaMs: number;
}

export interface CalibrationComparisonReport {
  beforeLabel: string;
  afterLabel: string;
  beforeMetrics: ReturnType<typeof computeCalibrationMetrics>;
  afterMetrics: ReturnType<typeof computeCalibrationMetrics>;
  shiftRows: ShiftComparisonRow[];
  narrative: string[];
}

/**
 * Compare two replays of the same motion (or before/after code).
 * Does not claim objective "more realistic" - only reports deltas.
 */
export function compareCalibrationTraces(
  before: CalibrationTrace,
  after: CalibrationTrace,
): CalibrationComparisonReport {
  const beforeMetrics = computeCalibrationMetrics(before);
  const afterMetrics = computeCalibrationMetrics(after);
  const beforeShifts = extractShiftEvents(before.samples);
  const afterShifts = extractShiftEvents(after.samples);
  const n = Math.max(beforeShifts.length, afterShifts.length);
  const shiftRows: ShiftComparisonRow[] = [];
  for (let i = 0; i < n; i += 1) {
    const b = beforeShifts[i];
    const a = afterShifts[i];
    if (b && a) {
      shiftRows.push({
        fromGear: b.fromGear,
        toGear: b.toGear,
        beforeAtMs: b.atMs,
        afterAtMs: a.atMs,
        beforeSpeedKmh: b.speedBeforeKmh,
        afterSpeedKmh: a.speedBeforeKmh,
        beforeRpm: b.rpmBefore,
        afterRpm: a.rpmBefore,
        beforeDemand: b.driverDemand,
        afterDemand: a.driverDemand,
        deltaSpeedKmh: a.speedBeforeKmh - b.speedBeforeKmh,
        deltaMs: a.atMs - b.atMs,
      });
    }
  }

  const narrative: string[] = [];
  narrative.push(
    `Upshifts: ${beforeMetrics.upshifts} → ${afterMetrics.upshifts}; downshifts: ${beforeMetrics.downshifts} → ${afterMetrics.downshifts}.`,
  );
  narrative.push(
    `Gear hunting events: ${beforeMetrics.gearHuntingEvents} → ${afterMetrics.gearHuntingEvents}.`,
  );
  for (const row of shiftRows.slice(0, 12)) {
    narrative.push(
      `Gear ${row.fromGear}→${row.toGear}: before ${row.beforeSpeedKmh.toFixed(1)} km/h @ ${row.beforeAtMs} ms; after ${row.afterSpeedKmh.toFixed(1)} km/h @ ${row.afterAtMs} ms (Δspeed ${row.deltaSpeedKmh.toFixed(1)} km/h).`,
    );
  }
  if (beforeMetrics.kickdownResponseMs != null || afterMetrics.kickdownResponseMs != null) {
    narrative.push(
      `Kickdown response: ${beforeMetrics.kickdownResponseMs ?? "-"} ms → ${afterMetrics.kickdownResponseMs ?? "-"} ms.`,
    );
  }
  narrative.push(
    `Audio/backends in meta: before realism=${before.meta.realismEngine}, after realism=${after.meta.realismEngine}.`,
  );
  narrative.push(
    "Deltas describe behavior change under the same motion - not an automatic realism verdict.",
  );

  return {
    beforeLabel: before.meta.label,
    afterLabel: after.meta.label,
    beforeMetrics,
    afterMetrics,
    shiftRows,
    narrative,
  };
}
