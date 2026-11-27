import { EFFORT_ZONES } from "./colors";

export interface EffortChartPoint {
  x: number;
  y: number;
  effort: number;
}

export interface EffortGradientStop {
  offset: number;
  color: string;
}

/** Gradient stops along an effort 0–100 axis, at the five visible zone boundaries. */
export function effortZoneGradientStops(): EffortGradientStop[] {
  const last = EFFORT_ZONES[EFFORT_ZONES.length - 1]!;
  return [
    ...EFFORT_ZONES.map((z) => ({ offset: z.min / 100, color: z.color })),
    { offset: 1, color: last.color },
  ];
}

export function effortChartPoints(
  points: ReadonlyArray<{ atMs: number; effort: number }>,
  width: number,
  height: number,
  padY = 4,
): EffortChartPoint[] {
  if (points.length === 0) return [];
  const t0 = points[0]!.atMs;
  const span = Math.max(1, points[points.length - 1]!.atMs - t0);
  const usable = height - padY * 2;
  return points.map((p) => ({
    x: ((p.atMs - t0) / span) * width,
    y: height - (Math.min(100, Math.max(0, p.effort)) / 100) * usable - padY,
    effort: p.effort,
  }));
}

export function effortChartPath(points: EffortChartPoint[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
}

export function effortChartAreaPath(points: EffortChartPoint[], width: number, height: number): string {
  if (points.length === 0) return "";
  const line = effortChartPath(points);
  const last = points[points.length - 1]!;
  const first = points[0]!;
  return `${line} L${width.toFixed(1)},${height.toFixed(1)} L0,${height.toFixed(1)} L${first.x.toFixed(1)},${first.y.toFixed(1)} Z`;
}
