/**
 * Tachometer themes for the Drive cockpit. Pure data + helpers (no React) so
 * the theme choice and intro curve are unit-testable.
 */
import type { SpeedUnitId } from "@/lib/drive/speed-units";
import { profileUsesKnots, profileUsesLightSpeed } from "@/lib/drive/speed-units";

export type TachThemeId =
  | "classic"
  | "city"
  | "touring"
  | "sport"
  | "race"
  | "nautical"
  | "aviation"
  | "rail"
  | "warp"
  | "rocket"
  | "stage";

export interface TachTheme {
  id: TachThemeId;
  label: string;
  /** Arc geometry in degrees (0 = 3 o'clock, clockwise). */
  start: number;
  sweep: number;
  accent: string;
  /** Secondary accent (gradients / glow). */
  accent2: string;
  track: string;
  /** Tick style: fine marks, chunky LED segments, or none. */
  ticks: "fine" | "segments" | "dots" | "none";
  majorTicks: number;
  minorPerMajor: number;
  /** Fraction where the warning zone begins (null = no zone). */
  zoneStart: number | null;
  zoneColor: string;
  glow: number;
  /** Shift-light row above the dial (Sport / Race). */
  shiftLights: boolean;
  /** Decorative extras rendered by the component. */
  decor: "none" | "bezel" | "compass" | "airspeed" | "rail" | "hud" | "flame";
  introMs: number;
}

const BASE = {
  start: 135,
  sweep: 270,
  track: "oklch(1 0 0 / 12%)",
  zoneColor: "#e53935",
  shiftLights: false,
  introMs: 1400,
} as const;

export const TACH_THEMES: Record<TachThemeId, TachTheme> = {
  classic: {
    ...BASE,
    id: "classic",
    label: "Classic",
    accent: "oklch(0.97 0.002 250)",
    accent2: "#c9ced6",
    ticks: "fine",
    majorTicks: 8,
    minorPerMajor: 4,
    zoneStart: 0.82,
    glow: 0.25,
    decor: "bezel",
  },
  city: {
    ...BASE,
    id: "city",
    label: "City",
    accent: "#5eead4",
    accent2: "#38bdf8",
    ticks: "dots",
    majorTicks: 10,
    minorPerMajor: 1,
    zoneStart: 0.86,
    zoneColor: "#fb923c",
    glow: 0.4,
    decor: "none",
    introMs: 1200,
  },
  touring: {
    ...BASE,
    id: "touring",
    label: "Touring",
    start: 150,
    sweep: 240,
    accent: "#f5c77e",
    accent2: "#d4a35a",
    ticks: "fine",
    majorTicks: 8,
    minorPerMajor: 2,
    zoneStart: 0.84,
    glow: 0.3,
    decor: "bezel",
    introMs: 1600,
  },
  sport: {
    ...BASE,
    id: "sport",
    label: "Sport",
    accent: "#ff3b30",
    accent2: "#ff9f0a",
    ticks: "segments",
    majorTicks: 30,
    minorPerMajor: 1,
    zoneStart: 0.8,
    glow: 0.6,
    shiftLights: true,
    decor: "none",
    introMs: 1100,
  },
  race: {
    ...BASE,
    id: "race",
    label: "Race",
    start: 180,
    sweep: 180,
    accent: "#e53935",
    accent2: "#ffd60a",
    ticks: "segments",
    majorTicks: 24,
    minorPerMajor: 1,
    zoneStart: 0.78,
    glow: 0.8,
    shiftLights: true,
    decor: "none",
    introMs: 900,
  },
  nautical: {
    ...BASE,
    id: "nautical",
    label: "Nautical",
    start: 0,
    sweep: 360,
    accent: "#7dd3fc",
    accent2: "#e0b872",
    ticks: "fine",
    majorTicks: 12,
    minorPerMajor: 3,
    zoneStart: null,
    glow: 0.35,
    decor: "compass",
    introMs: 1700,
  },
  aviation: {
    ...BASE,
    id: "aviation",
    label: "Airspeed",
    start: 270,
    sweep: 330,
    accent: "oklch(0.97 0.002 250)",
    accent2: "#22c55e",
    ticks: "fine",
    majorTicks: 10,
    minorPerMajor: 5,
    zoneStart: 0.88,
    glow: 0.2,
    decor: "airspeed",
  },
  rail: {
    ...BASE,
    id: "rail",
    label: "Rail",
    start: 150,
    sweep: 240,
    accent: "#f2b33d",
    accent2: "#b87333",
    ticks: "fine",
    majorTicks: 6,
    minorPerMajor: 5,
    zoneStart: 0.85,
    glow: 0.3,
    decor: "rail",
    introMs: 1800,
  },
  warp: {
    ...BASE,
    id: "warp",
    label: "Warp",
    accent: "#a78bfa",
    accent2: "#22d3ee",
    ticks: "dots",
    majorTicks: 36,
    minorPerMajor: 1,
    zoneStart: 0.9,
    zoneColor: "#f0abfc",
    glow: 0.9,
    decor: "hud",
    introMs: 1600,
  },
  rocket: {
    ...BASE,
    id: "rocket",
    label: "Rocket",
    accent: "#ff7a1a",
    accent2: "#ffd166",
    ticks: "segments",
    majorTicks: 20,
    minorPerMajor: 1,
    zoneStart: 0.85,
    zoneColor: "#ff2d55",
    glow: 0.85,
    decor: "flame",
    introMs: 1300,
  },
  stage: {
    ...BASE,
    id: "stage",
    label: "Stage",
    accent: "oklch(0.97 0.002 250)",
    accent2: "#9ca3af",
    ticks: "dots",
    majorTicks: 16,
    minorPerMajor: 1,
    zoneStart: null,
    glow: 0.3,
    decor: "none",
    introMs: 1200,
  },
};

const TRAIN_IDS = new Set(["steam-train", "bullet-train", "subway", "tram", "freight-train"]);
const RACE_MOODS = new Set([
  "ludicrous",
  "red-alert",
  "full-send",
  "intense",
  "storm-chase",
  "supersonic-snack",
]);

export interface TachThemeInput {
  profileId: string;
  category: string;
  /** "shift-map" (real gearbox) or "mood" (thematic persona). */
  modeBinding: "shift-map" | "mood";
  modeId: string;
  speedUnit?: SpeedUnitId | string;
}

/** Pick the tach design for the current sound + shift mode. */
export function resolveTachThemeId(input: TachThemeInput): TachThemeId {
  const { profileId, category, modeBinding, modeId } = input;
  if (modeBinding === "shift-map") {
    if (modeId === "race") return "race";
    if (modeId === "sport") return "sport";
    if (modeId === "touring") return "touring";
    if (modeId === "city") return "city";
    return "classic";
  }
  if (profileId === "rocket-car") return "rocket";
  if (input.speedUnit === "c" || profileUsesLightSpeed(profileId)) return "warp";
  if (TRAIN_IDS.has(profileId) || /train|rail|tram/.test(profileId)) return "rail";
  if (category === "Nautical") return "nautical";
  if (category === "Aviation" || profileUsesKnots(profileId) || input.speedUnit === "kn") {
    return "aviation";
  }
  if (category === "Future") return "warp";
  if (RACE_MOODS.has(modeId)) return "race";
  return "stage";
}

/**
 * Intro needle curve: 0 → 1 (sweep to redline) → settle back to `target`.
 * t in [0,1]. Ease-out up for the first 45%, brief hold, ease-in-out down.
 */
export function introNeedle(t: number, target: number): number {
  const c = Math.min(1, Math.max(0, t));
  const tg = Math.min(1, Math.max(0, target));
  if (c < 0.45) {
    const u = c / 0.45;
    return 1 - (1 - u) ** 3;
  }
  if (c < 0.55) return 1;
  const u = (c - 0.55) / 0.45;
  const e = u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2;
  return 1 + (tg - 1) * e;
}

/** Tick labels for the dial: rpm thousands for gearboxes, or generic scale. */
export function tachScaleLabels(theme: TachTheme, redlineRpm: number | null): string[] {
  if (theme.decor === "compass") return ["N", "E", "S", "W"];
  if (theme.decor === "hud") return ["0", ".25c", ".5c", ".75c", "c"];
  if (redlineRpm && redlineRpm > 0) {
    const top = Math.ceil(redlineRpm / 1000);
    return Array.from({ length: top + 1 }, (_, i) => String(i));
  }
  return [];
}
