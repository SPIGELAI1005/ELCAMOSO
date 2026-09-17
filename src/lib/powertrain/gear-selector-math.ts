import type { PowertrainProfile } from "@/lib/powertrain/types-config";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Interpolated upshift RPM from load/throttle demand. */
export function upshiftRpmForLoad(
  load: number,
  throttle: number,
  profile: PowertrainProfile,
): number {
  const tx = profile.transmission;
  const demand = Math.max(load, throttle);
  const { lowLoad, mediumLoad, highLoad } = tx.upshiftRpm;
  const m = tx.upshiftLoadMedium;
  const h = tx.upshiftLoadHigh;

  if (demand <= m) return lowLoad;
  if (demand >= h) return highLoad;
  if (demand <= (m + h) * 0.5) {
    const t = (demand - m) / Math.max(0.001, (m + h) * 0.5 - m);
    return lowLoad + (mediumLoad - lowLoad) * t;
  }
  const t = (demand - (m + h) * 0.5) / Math.max(0.001, h - (m + h) * 0.5);
  return mediumLoad + (highLoad - mediumLoad) * clamp01(t);
}

/** Per-gear downshift RPM threshold. */
export function downshiftRpmForGear(gear: number, profile: PowertrainProfile): number {
  const d = profile.transmission.downshift;
  const offset = d.perGearOffsetRpm[gear - 1] ?? 0;
  return d.baseRpm + offset;
}
