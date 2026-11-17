import type { EffortZoneId } from "./types";

/** Effort colour scale used on the live route, legend, gauge and summary. */
export const EFFORT_ZONES: ReadonlyArray<{
  id: EffortZoneId;
  label: string;
  min: number;
  max: number;
  color: string;
}> = [
  { id: "walk", label: "Walk", min: 0, max: 25, color: "#8a8f98" },
  { id: "easy", label: "Easy", min: 25, max: 45, color: "#5eead4" },
  { id: "steady", label: "Steady", min: 45, max: 65, color: "#fbbf24" },
  { id: "push", label: "Push", min: 65, max: 80, color: "#f97316" },
  { id: "hard", label: "Hard", min: 80, max: 100, color: "#e53935" },
];

export function colorForEffort(effort: number): string {
  const e = Number.isFinite(effort) ? Math.min(100, Math.max(0, effort)) : 0;
  for (let i = EFFORT_ZONES.length - 1; i >= 0; i--) {
    const z = EFFORT_ZONES[i]!;
    if (e >= z.min) return z.color;
  }
  return EFFORT_ZONES[0]!.color;
}

export function zoneForEffort(effort: number): (typeof EFFORT_ZONES)[number] {
  const e = Number.isFinite(effort) ? Math.min(100, Math.max(0, effort)) : 0;
  for (let i = EFFORT_ZONES.length - 1; i >= 0; i--) {
    const z = EFFORT_ZONES[i]!;
    if (e >= z.min) return z;
  }
  return EFFORT_ZONES[0]!;
}
