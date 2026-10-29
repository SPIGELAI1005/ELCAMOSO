/**
 * Adaptive music conductor - turns the drive into musical intent.
 * Pure and deterministic so the browser player and offline demo renderer share it.
 *
 * - speed            -> tempo (bpmMin at rest .. bpmMax at highway), smoothed and rate limited
 * - sudden accel     -> "surge": intensity build, extra layers, riser into a crash
 * - hard braking     -> "brake": softer, low-pass filtered, sparse
 * - steady speed     -> "cruise": settles into a groove, variations rotate every 8 bars
 * - gear changes     -> accents/fills on the next beat (real gear when the profile has gears,
 *                       otherwise musical "gears" from speed bands with hysteresis)
 * - GPS elevation    -> climbing lifts the key (+2) and brightness, descending relaxes;
 *                       ignored when altitude is null/inaccurate
 */

export type MusicMode = "stopped" | "flow" | "cruise" | "surge" | "brake";
export type MusicAccent = "upshift" | "downshift" | "surge" | "brake";

export interface ConductorInput {
  /** m/s */
  speed: number;
  /** m/s² */
  acceleration: number;
  throttle: number;
  regen: number;
  /** real gear (0 for continuous profiles) */
  gear: number;
  /** seconds since last update */
  dt: number;
  /** metres above sea level, or null when the browser does not provide it */
  altitude?: number | null;
  altitudeAccuracy?: number | null;
}

export interface ConductorState {
  bpm: number;
  targetBpm: number;
  intensity: number;
  brightness: number;
  transpose: number;
  mode: MusicMode;
  grade: number | null;
  elevationTrend: "climb" | "flat" | "descent" | "unknown";
  cruiseSeconds: number;
  musicalGear: number;
}

export interface ConductorConfig {
  bpmMin: number;
  bpmMax: number;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const ema = (prev: number, next: number, dt: number, tau: number) =>
  prev + (next - prev) * (1 - Math.exp(-Math.max(dt, 1e-3) / Math.max(tau, 0.02)));
const smoothstep = (x: number) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};

/** km/h thresholds for musical gears on gearless profiles. */
export const MUSICAL_GEAR_BANDS = [18, 38, 60, 85, 112];

export function tempoForSpeed(speedKmh: number, cfg: ConductorConfig): number {
  return cfg.bpmMin + (cfg.bpmMax - cfg.bpmMin) * smoothstep(speedKmh / 130);
}

export function createConductor(initial: ConductorConfig) {
  let cfg = { ...initial };
  let speedKmh = 0;
  let accel = 0;
  let bpm = cfg.bpmMin;
  let targetBpm = cfg.bpmMin;
  let intensity = 0.12;
  let brightness = 0.5;
  let mode: MusicMode = "stopped";
  let modeHold = 0;
  let cruiseSeconds = 0;
  let realGear = 0;
  let musicalGear = 1;
  let transpose = 0;
  let climbSeconds = 0;
  let flatSeconds = 0;
  // elevation
  let altSm: number | null = null;
  let distance = 0;
  const altHistory: { d: number; a: number }[] = [];
  let grade: number | null = null;
  let trend: ConductorState["elevationTrend"] = "unknown";
  const accents: MusicAccent[] = [];
  let lastAltitudeSeen = Infinity;

  function updateElevation(input: ConductorInput, dt: number) {
    const alt = input.altitude;
    const acc = input.altitudeAccuracy;
    const usable =
      typeof alt === "number" && Number.isFinite(alt) && (acc == null || acc <= 30);
    lastAltitudeSeen = usable ? 0 : lastAltitudeSeen + dt;
    if (lastAltitudeSeen > 20) {
      grade = null;
      trend = "unknown";
      altHistory.length = 0;
      altSm = null;
      return;
    }
    if (!usable) return;
    altSm = altSm === null ? alt : ema(altSm, alt, dt, 4);
    altHistory.push({ d: distance, a: altSm });
    while (altHistory.length > 2 && distance - altHistory[0]!.d > 150) altHistory.shift();
    const first = altHistory[0]!;
    const span = distance - first.d;
    if (span >= 60) {
      grade = (altSm - first.a) / span;
      trend = grade > 0.03 ? "climb" : grade < -0.03 ? "descent" : "flat";
    } else if (speedKmh < 3) {
      trend = altHistory.length ? trend : "unknown";
    }
  }

  function updateGear(input: ConductorInput) {
    if (input.gear > 0) {
      if (realGear > 0 && input.gear !== realGear) {
        accents.push(input.gear > realGear ? "upshift" : "downshift");
      }
      realGear = input.gear;
      return;
    }
    // musical gears with 4 km/h hysteresis
    let g = musicalGear;
    while (g <= MUSICAL_GEAR_BANDS.length && speedKmh > MUSICAL_GEAR_BANDS[g - 1]! + 2) g += 1;
    while (g > 1 && speedKmh < MUSICAL_GEAR_BANDS[g - 2]! - 2) g -= 1;
    if (g !== musicalGear) {
      accents.push(g > musicalGear ? "upshift" : "downshift");
      musicalGear = g;
    }
  }

  return {
    /** Retune the tempo range (genre switch) without losing musical state. */
    setRange(next: ConductorConfig) {
      cfg = { ...next };
    },
    update(input: ConductorInput): ConductorState {
      const dt = clamp(input.dt, 0.001, 0.25);
      speedKmh = ema(speedKmh, Math.max(0, input.speed) * 3.6, dt, 0.6);
      accel = ema(accel, input.acceleration, dt, 0.35);
      distance += Math.max(0, input.speed) * dt;
      updateElevation(input, dt);
      updateGear(input);

      // ---- mode ----
      const prevMode = mode;
      modeHold = Math.max(0, modeHold - dt);
      const braking = accel < -2.0 || input.regen > 0.55;
      const surging = accel > 1.6 || (input.throttle > 0.75 && accel > 1.0);
      if (braking && speedKmh > 4) {
        mode = "brake";
        modeHold = 1.6;
      } else if (surging) {
        mode = "surge";
        modeHold = 1.8;
      } else if (modeHold <= 0 || (mode === "brake" && accel > -0.3) || (mode === "surge" && accel < 0.2)) {
        if (speedKmh < 2.5) mode = "stopped";
        else if (Math.abs(accel) < 0.4 && speedKmh > 20 && cruiseSeconds > 5) mode = "cruise";
        else mode = "flow";
      }
      if (Math.abs(accel) < 0.4 && speedKmh > 20) cruiseSeconds += dt;
      else cruiseSeconds = 0;
      if (mode !== prevMode && (mode === "surge" || mode === "brake")) accents.push(mode);

      // ---- elevation key / brightness ----
      if (trend === "climb") {
        climbSeconds += dt;
        flatSeconds = 0;
      } else {
        flatSeconds += dt;
        climbSeconds = Math.max(0, climbSeconds - dt);
      }
      if (climbSeconds > 4) transpose = 2;
      else if (flatSeconds > 12) transpose = 0;

      // ---- tempo ----
      targetBpm = tempoForSpeed(speedKmh, cfg) + (mode === "surge" ? 4 : 0);
      const wanted = ema(bpm, targetBpm, dt, 2.2);
      const maxStep = 5 * dt; // bpm per second
      bpm = clamp(wanted, bpm - maxStep, bpm + maxStep);
      bpm = clamp(bpm, cfg.bpmMin - 2, cfg.bpmMax + 6);

      // ---- intensity ----
      const speedN = smoothstep(speedKmh / 130);
      let target = 0.22 + 0.45 * speedN;
      let tau = 1.6;
      if (mode === "stopped") target = 0.1;
      if (mode === "cruise") target += 0.05;
      if (mode === "surge") {
        target = Math.min(1, target + 0.45);
        tau = 0.9;
      }
      if (mode === "brake") {
        target = 0.12;
        tau = 0.5;
      }
      if (trend === "climb") target += 0.08;
      if (trend === "descent") target -= 0.1;
      intensity = ema(intensity, clamp(target), dt, tau);

      let bTarget = 0.5 + 0.35 * intensity;
      if (mode === "brake") bTarget = 0.12;
      if (trend === "climb") bTarget += 0.12;
      if (trend === "descent") bTarget -= 0.12;
      brightness = ema(brightness, clamp(bTarget), dt, mode === "brake" ? 0.25 : 1.0);

      return this.snapshot();
    },
    snapshot(): ConductorState {
      return {
        bpm,
        targetBpm,
        intensity,
        brightness,
        transpose,
        mode,
        grade,
        elevationTrend: trend,
        cruiseSeconds,
        musicalGear,
      };
    },
    drainAccents(): MusicAccent[] {
      return accents.splice(0, accents.length);
    },
  };
}

export type Conductor = ReturnType<typeof createConductor>;

/** Low-pass cutoff (Hz) for a 0..1 brightness, log mapped 550 Hz .. 16 kHz. */
export function cutoffForBrightness(b: number): number {
  return 550 * Math.pow(16000 / 550, clamp(b));
}
