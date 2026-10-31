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
  /**
   * Ground contact line of the near-side tyres, front tyre first ([x, y] in image px). The car
   * travels from the rear point toward the front point, so the floor streaks run along this line
   * and scroll front -> rear, matching the car's real heading in the 3/4 perspective.
   */
  ground: readonly [readonly [number, number], readonly [number, number]];
}

/** Floor scroll direction (unit vector, front -> rear tyre contact) and its angle in degrees. */
export function floorHeading(cfg: CarFxConfig): { ux: number; uy: number; deg: number } {
  const [[fx, fy], [rx, ry]] = cfg.ground;
  const dx = rx - fx, dy = ry - fy;
  const len = Math.hypot(dx, dy) || 1;
  return { ux: dx / len, uy: dy / len, deg: (Math.atan2(dy, dx) * 180) / Math.PI };
}
/** Image y of the ground line at image x (extended linearly). */
export function groundYAt(cfg: CarFxConfig, x: number): number {
  const [[fx, fy], [rx, ry]] = cfg.ground;
  return rx === fx ? fy : fy + ((ry - fy) * (x - fx)) / (rx - fx);
}

/** Rim clip is a bit inside the measured tyre so the background never spins. */
const RIM_SCALE = 0.9;
type Quad = readonly [number, number, number, number];
/**
 * Build a config from measured headlight ellipses and tyre ellipses ([cx, cy, rx, ry], image px).
 * Tyres: near-side front first, near-side rear second, extra visible tyres after.
 */
function car(lights: readonly Quad[], tyres: readonly Quad[]): CarFxConfig {
  const [f, r] = tyres as [Quad, Quad];
  const ground = [[f[0], f[1] + f[3]], [r[0], r[1] + r[3]]] as const;
  const cfg: CarFxConfig = {
    image: { w: 1672, h: 941 },
    headlights: lights.map(([cx, cy, rx, ry]) => ({ cx, cy, rx, ry })),
    wheels: tyres.map(([cx, cy, rx, ry]) => ({ cx, cy, rx: rx * RIM_SCALE, ry: ry * RIM_SCALE })),
    floorTop: Math.min(ground[0][1], ground[1][1]) - 20,
    ground,
  };
  if (lights.length) {
    const lx = lights.reduce((a, l) => a + l[0], 0) / lights.length;
    const deg = floorHeading(cfg).deg;
    cfg.beam = { cx: lx - 40, cy: Math.min(925, groundYAt(cfg, lx) + 90), rx: 380, ry: 70, angle: deg };
  }
  return cfg;
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
    ground: [[926, 687], [1385, 613]],
  },
  "american-muscle-v8": car([[110, 530, 20, 22], [175, 530, 20, 22], [610, 535, 25, 25], [690, 535, 25, 25]], [[975, 625, 85, 135], [1510, 595, 55, 115]]),
  "big-twin": car([[522, 301, 35, 35]], [[375, 630, 215, 230], [1400, 608, 115, 180]]),
  "construction-monster": car([[255, 485, 18, 40], [640, 455, 30, 45]], [[920, 635, 185, 190], [1430, 643, 140, 150]]),
  "cyber-pulse": car([[200, 515, 110, 10], [620, 515, 150, 12]], [[940, 580, 95, 152], [1534, 558, 60, 128]]),
  "deep-bass-pulse": car([[240, 528, 70, 15], [850, 518, 110, 15]], [[1105, 583, 78, 148], [1560, 569, 50, 125]]),
  "electric-hypercar": car([[300, 560, 120, 10], [630, 560, 120, 10]], [[972, 576, 84, 157], [1551, 543, 60, 143]]),
  "f1-v10": car([], [[931, 570, 125, 152], [1523, 505, 106, 135]]),
  "formula-electric": car([], [[931, 570, 125, 152], [1523, 505, 106, 135]]),
  "farting-car": car([[204, 474, 35, 40], [565, 480, 70, 45]], [[759, 636, 102, 134], [1245, 627, 70, 116]]),
  "flat-six-sport": car([[207, 463, 35, 40], [694, 485, 70, 45]], [[907, 615, 92, 143], [1477, 592, 60, 120]]),
  "fusion-mechanical-symphony": car([[308, 521, 40, 45], [556, 528, 40, 45]], [[746, 602, 120, 150], [1523, 544, 105, 150]]),
  "fusion-midnight-boost": car([[127, 574, 25, 12], [470, 586, 100, 10]], [[805, 603, 98, 133], [1407, 568, 75, 133], [1569, 545, 70, 120]]),
  "fusion-road-anthem": car([[374, 626, 30, 30], [722, 602, 45, 40]], [[990, 657, 92, 130], [1514, 606, 60, 107]]),
  "ge-squared": car([[333, 463, 25, 18], [676, 465, 35, 20]], [[861, 636, 110, 134], [1282, 608, 70, 107]]),
  "gt-v8": car([[139, 496, 30, 20], [732, 491, 130, 18]], [[981, 602, 92, 148], [1505, 583, 52, 130]]),
  "heartbeat": car([[300, 520, 110, 14], [750, 510, 170, 14]], [[1023, 580, 88, 152], [1509, 548, 56, 130]]),
  "kazoo-kart": car([], [[838, 634, 125, 134], [1500, 542, 93, 125]]),
  "laughing-machine": car([[241, 493, 45, 25], [759, 502, 80, 25]], [[1018, 599, 92, 134], [1465, 595, 57, 130]]),
  "motorcycle-superbike": car([[481, 380, 50, 25]], [[491, 699, 185, 190], [1342, 639, 130, 185]]),
  "neon-drive": car([[222, 530, 60, 12], [778, 526, 80, 12]], [[1083, 580, 74, 143], [1518, 544, 47, 115]]),
  "open-wind": car([[120, 500, 25, 18], [685, 491, 130, 16]], [[912, 602, 97, 148], [1528, 565, 65, 130]]),
  "race-car": car([[176, 528, 30, 20], [861, 528, 55, 18]], [[1070, 556, 61, 139], [1509, 523, 47, 116]]),
  "racing-v10": car([[157, 511, 40, 18], [778, 502, 90, 18]], [[1000, 590, 83, 143], [1523, 553, 60, 125]]),
  "rain-drive": car([[204, 574, 40, 18], [778, 546, 100, 15]], [[1060, 578, 88, 152], [1560, 523, 51, 116]]),
  "rally-car": car([[241, 474, 30, 20], [759, 474, 75, 18], [310, 515, 25, 25], [380, 515, 25, 25], [450, 515, 25, 25], [530, 515, 25, 25]], [[1005, 631, 97, 148], [1444, 622, 83, 130]]),
  "retro-arcade": car([[208, 556, 35, 12], [521, 556, 50, 12]], [[880, 568, 70, 104], [1320, 561, 46, 87]]),
  "rocket-car": car([[266, 551, 40, 15]], [[203, 626, 98, 110], [967, 655, 120, 127]]),
  "santa-sleigh": car([[111, 519, 20, 25], [565, 528, 100, 15]], [[810, 611, 97, 148], [1528, 588, 65, 125]]),
  "space-ship": car([[167, 557, 50, 12], [630, 567, 130, 12]], [[1014, 567, 79, 148], [1569, 502, 51, 130]]),
  "symphony-cinematic-rock": car([[185, 441, 70, 12], [630, 437, 90, 12]], [[940, 593, 107, 148], [1500, 583, 83, 120]]),
  "symphony-latino-fiesta": car([[172, 432, 28, 32], [617, 437, 35, 38]], [[815, 599, 74, 116], [1370, 557, 47, 83]]),
  "symphony-motion-orchestra": car([[174, 544, 40, 15], [640, 540, 80, 14]], [[926, 579, 92, 150], [1563, 550, 58, 122]]),
  "symphony-neon-run": car([[232, 540, 60, 12], [764, 540, 80, 12]], [[1088, 580, 70, 145], [1517, 551, 46, 116]]),
  "synthwave-drive": car([[194, 537, 60, 12], [769, 537, 80, 12]], [[1078, 588, 78, 143], [1518, 542, 47, 115]]),
  "thunder-beast": car([[204, 520, 50, 12], [685, 530, 100, 12]], [[1056, 571, 92, 162], [1565, 539, 55, 139]]),
  "time-machine": car([[370, 541, 150, 12], [657, 485, 60, 14]], [[963, 560, 93, 134], [1449, 500, 51, 102]]),
  "traby": car([[422, 450, 30, 35], [774, 461, 33, 38]], [[912, 599, 51, 88], [1208, 548, 33, 65]]),
  "turbo-inline-6": car([[163, 500, 30, 18], [741, 504, 110, 18]], [[977, 602, 97, 148], [1514, 583, 60, 130]]),
  "wiesn-tractor": car([[411, 413, 35, 38], [639, 391, 35, 38], [504, 317, 22, 25]], [[755, 613, 135, 158], [1333, 562, 158, 190], [352, 618, 120, 125]]),
  "world-cyber-city": car([[240, 505, 130, 12], [630, 495, 120, 12]], [[857, 597, 107, 153], [1514, 583, 60, 130]]),
  "world-storm-run": car([[148, 465, 25, 18], [685, 461, 90, 16]], [[954, 604, 111, 148], [1528, 599, 65, 134]]),
  "zen-drive": car([[130, 519, 40, 12], [593, 519, 130, 12]], [[824, 620, 83, 139], [1490, 597, 56, 116]]),
};

/** Profiles whose still is replaced by a looping motion clip while driving. */
export const GALLOP_VIDEO: Readonly<Record<string, string>> = {
  "dracula-carriage": "/hero/video/dracula-gallop-loop.mp4",
};
export const GALLOP_MIN_RATE = 0.25;
export const GALLOP_MAX_RATE = 1.6;
/** Playback rate for the gallop loop, or 0 (paused on the still frame) when stopped. */
export function gallopPlaybackRate(kmh: number): number {
  const v = Number.isFinite(kmh) ? Math.max(0, kmh) : 0;
  if (v < 1) return 0;
  return Math.min(GALLOP_MAX_RATE, Math.max(GALLOP_MIN_RATE, v / 25));
}

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
