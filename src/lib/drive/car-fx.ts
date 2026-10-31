/**
 * Drive page hero-car effects: headlights that switch on while driving and a subtle wheel-spin
 * overlay that scales with speed. Coordinates are in the hero image's own pixel space, one small
 * entry per profile. Profiles without an entry show no effect.
 */
export interface CarFxEllipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}
export interface CarFxConfig {
  image: { w: number; h: number };
  headlights: readonly CarFxEllipse[];
  /** Soft light pool on the floor ahead of the car. */
  beam?: CarFxEllipse & { angle: number };
  /** Visible wheel rims (ellipses because of the 3/4 view). */
  wheels: readonly CarFxEllipse[];
  /** Image y where the reflective floor starts (streak area). */
  floorTop: number;
}

export const CAR_FX: Readonly<Record<string, CarFxConfig>> = {
  "police-patrol": {
    image: { w: 1672, h: 941 },
    headlights: [
      { cx: 262, cy: 460, rx: 20, ry: 26 },
      { cx: 722, cy: 466, rx: 96, ry: 22 },
    ],
    beam: { cx: 330, cy: 800, rx: 360, ry: 70, angle: -6 },
    wheels: [
      { cx: 935, cy: 580, rx: 62, ry: 104 },
      { cx: 1381, cy: 530, rx: 42, ry: 86 },
    ],
    floorTop: 640,
  },
  "dracula-carriage": {
    image: { w: 1672, h: 941 },
    headlights: [],
    wheels: [
      { cx: 1076, cy: 594, rx: 50, ry: 104 },
      { cx: 1260, cy: 540, rx: 40, ry: 96 },
    ],
    floorTop: 700,
  },
};

export function carFxFor(profileId: string | null | undefined): CarFxConfig | null {
  return (profileId && CAR_FX[profileId]) || null;
}

/** Headlights on while the engine runs or the car moves. */
export function headlightsOn(engineRunning: boolean, kmh: number): boolean {
  return engineRunning || kmh > 0.5;
}

/**
 * Visual wheel rotation in turns per second. Eases in and caps at 2.2 turns/s so it never strobes
 * or looks cartoonish at motorway speed; 0 at standstill.
 */
export const WHEEL_MAX_TURNS = 2.2;
export function wheelTurnsPerSecond(kmh: number): number {
  const v = Number.isFinite(kmh) ? Math.max(0, kmh) : 0;
  if (v < 0.5) return 0;
  return WHEEL_MAX_TURNS * (1 - Math.exp(-v / 35));
}

/** Motion-blur strength 0..1 (ghost spread + blur disc), capped at 120 km/h. */
export function wheelBlur(kmh: number): number {
  const v = Number.isFinite(kmh) ? Math.max(0, kmh) : 0;
  return Math.min(1, v / 120);
}

/** SVG matrix rotating by `rad` in the plane of an ellipse (affine 3/4-view approximation). */
export function wheelMatrix(e: CarFxEllipse, rad: number): string {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const a = c, b = (s * e.ry) / e.rx, cc = (-s * e.rx) / e.ry, d = c;
  const tx = e.cx - (a * e.cx + cc * e.cy);
  const ty = e.cy - (b * e.cx + d * e.cy);
  return `matrix(${a.toFixed(5)} ${b.toFixed(5)} ${cc.toFixed(5)} ${d.toFixed(5)} ${tx.toFixed(2)} ${ty.toFixed(2)})`;
}

/**
 * ONE shared, eased speed signal for every Drive visual (headlights, wheels, floor, police lights).
 * Same exponential easing (tau 0.45 s) everywhere, sampled once per animation frame, so all effects
 * speed up and slow down together. Sound follows the raw speed; 0.45 s keeps visuals in step with it.
 */
export const DRIVE_FX_TAU_S = 0.45;
const fxClock = { last: -1, kmh: 0 };
export function sampleDriveFxSpeed(now: number, targetKmh: number): number {
  if (now === fxClock.last) return fxClock.kmh;
  const t = Number.isFinite(targetKmh) ? Math.max(0, targetKmh) : 0;
  const dt = fxClock.last < 0 ? 0 : Math.min(0.1, Math.max(0, (now - fxClock.last) / 1000));
  fxClock.last = now;
  fxClock.kmh += (t - fxClock.kmh) * (1 - Math.exp(-dt / DRIVE_FX_TAU_S));
  if (t === 0 && fxClock.kmh < 0.3) fxClock.kmh = 0;
  return fxClock.kmh;
}
export function resetDriveFxSpeed() {
  fxClock.last = -1;
  fxClock.kmh = 0;
}

/** Floor streak scroll speed in image px/s (cars face left, floor moves right). Capped. */
export const FLOOR_MAX_PX_S = 1400;
export function floorScrollPxPerSecond(kmh: number): number {
  const v = Number.isFinite(kmh) ? Math.max(0, kmh) : 0;
  if (v < 0.5) return 0;
  return FLOOR_MAX_PX_S * (1 - Math.exp(-v / 60));
}
/** Floor streak visibility 0..1. */
export function floorStreakOpacity(kmh: number): number {
  const v = Number.isFinite(kmh) ? Math.max(0, kmh) : 0;
  return Math.min(1, v / 80);
}
