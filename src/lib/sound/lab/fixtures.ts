/**
 * Deterministic synthetic telemetry fixtures for the audio comparison lab (Prompt 01).
 * Speed-driven fixtures are acceptance-oriented; RPM/load sweeps are diagnosis-only.
 */

export type LabFixtureKind = "speed-driven" | "rpm-load-diagnostic";

export interface LabTelemetrySample {
  /** Seconds from fixture start. */
  t: number;
  speedKmh: number;
  accelerationMs2: number;
  throttle: number;
  braking: number;
  /** 0 = GPS/telemetry lost for this sample. */
  motionConfidence: number;
  primarySource: "simulator" | "tesla-browser" | "phone" | "vehicle-telemetry";
  /** Diagnosis-only overrides — never used by speed-driven acceptance fixtures. */
  rpmOverride?: number;
  loadOverride?: number;
}

export interface LabFixture {
  id: string;
  label: string;
  kind: LabFixtureKind;
  durationSeconds: number;
  description: string;
  /** When true, harness must switch profiles mid-run (not a pure telemetry curve). */
  abruptProfileSwitch?: boolean;
  sampleAt: (t: number) => LabTelemetrySample;
}

const STEP = 1 / 60;

function lerp(a: number, b: number, amount: number) {
  return a + (b - a) * Math.max(0, Math.min(1, amount));
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function baseSample(
  t: number,
  partial: Omit<LabTelemetrySample, "t" | "motionConfidence" | "primarySource"> &
    Partial<Pick<LabTelemetrySample, "motionConfidence" | "primarySource">>,
): LabTelemetrySample {
  return {
    t,
    motionConfidence: partial.motionConfidence ?? 1,
    primarySource: partial.primarySource ?? "simulator",
    speedKmh: partial.speedKmh,
    accelerationMs2: partial.accelerationMs2,
    throttle: partial.throttle,
    braking: partial.braking,
    ...(partial.rpmOverride !== undefined ? { rpmOverride: partial.rpmOverride } : {}),
    ...(partial.loadOverride !== undefined ? { loadOverride: partial.loadOverride } : {}),
  };
}

function steadyAt(speedKmh: number, durationSeconds: number, id: string, label: string): LabFixture {
  return {
    id,
    label,
    kind: "speed-driven",
    durationSeconds,
    description: `Steady ${speedKmh} km/h cruise for ${durationSeconds}s.`,
    sampleAt: (t) =>
      baseSample(t, {
        speedKmh,
        accelerationMs2: 0,
        throttle: speedKmh <= 0 ? 0.04 : 0.22,
        braking: 0,
      }),
  };
}

export const LAB_FIXTURES: readonly LabFixture[] = [
  {
    id: "idle",
    label: "Idle / stopped",
    kind: "speed-driven",
    durationSeconds: 4,
    description: "Stationary idle with light throttle hold.",
    sampleAt: (t) =>
      baseSample(t, { speedKmh: 0, accelerationMs2: 0, throttle: 0.04, braking: 0 }),
  },
  {
    id: "gentle-0-80",
    label: "Gentle 0–80 km/h",
    kind: "speed-driven",
    durationSeconds: 14,
    description: "Progressive 0→80 km/h acceleration then brief settle.",
    sampleAt: (t) => {
      if (t < 12) {
        const p = t / 12;
        return baseSample(t, {
          speedKmh: lerp(0, 80, p),
          accelerationMs2: 1.85,
          throttle: lerp(0.28, 0.55, p),
          braking: 0,
        });
      }
      return baseSample(t, {
        speedKmh: 80,
        accelerationMs2: 0,
        throttle: 0.24,
        braking: 0,
      });
    },
  },
  {
    id: "assertive-accel",
    label: "Assertive acceleration",
    kind: "speed-driven",
    durationSeconds: 10,
    description: "Hard 0→100 km/h demand for shift and load stress.",
    sampleAt: (t) => {
      if (t < 8) {
        const p = t / 8;
        return baseSample(t, {
          speedKmh: lerp(0, 100, p),
          accelerationMs2: 3.5,
          throttle: 0.95,
          braking: 0,
        });
      }
      return baseSample(t, {
        speedKmh: 100,
        accelerationMs2: 0,
        throttle: 0.3,
        braking: 0,
      });
    },
  },
  steadyAt(30, 6, "steady-30", "Steady 30 km/h"),
  steadyAt(50, 6, "steady-50", "Steady 50 km/h"),
  steadyAt(80, 6, "steady-80", "Steady 80 km/h"),
  {
    id: "lift-off",
    label: "Lift-off",
    kind: "speed-driven",
    durationSeconds: 8,
    description: "Cruise then abrupt throttle lift at constant high speed.",
    sampleAt: (t) => {
      if (t < 3) {
        return baseSample(t, {
          speedKmh: 70,
          accelerationMs2: 0,
          throttle: 0.35,
          braking: 0,
        });
      }
      return baseSample(t, {
        speedKmh: lerp(70, 62, clamp01((t - 3) / 5)),
        accelerationMs2: -0.9,
        throttle: 0.02,
        braking: 0,
      });
    },
  },
  {
    id: "decel-80-0",
    label: "80–0 deceleration",
    kind: "speed-driven",
    durationSeconds: 10,
    description: "Braking / regen from 80 km/h to stop.",
    sampleAt: (t) => {
      if (t < 1) {
        return baseSample(t, {
          speedKmh: 80,
          accelerationMs2: 0,
          throttle: 0.22,
          braking: 0,
        });
      }
      if (t < 9) {
        const p = (t - 1) / 8;
        return baseSample(t, {
          speedKmh: lerp(80, 0, p),
          accelerationMs2: -2.8,
          throttle: 0,
          braking: 0.75,
        });
      }
      return baseSample(t, {
        speedKmh: 0,
        accelerationMs2: 0,
        throttle: 0,
        braking: 0.1,
      });
    },
  },
  {
    id: "threshold-hover",
    label: "Threshold hovering",
    kind: "speed-driven",
    durationSeconds: 12,
    description: "Repeated ±2 km/h oscillation around a likely upshift band (~28 km/h).",
    sampleAt: (t) => {
      const center = 28;
      const wobble = Math.sin(t * Math.PI * 2) * 2;
      return baseSample(t, {
        speedKmh: center + wobble,
        accelerationMs2: Math.cos(t * Math.PI * 2) * 0.6,
        throttle: 0.32 + Math.sin(t * Math.PI * 2) * 0.08,
        braking: 0,
      });
    },
  },
  {
    id: "gps-loss-recovery",
    label: "GPS loss / recovery",
    kind: "speed-driven",
    durationSeconds: 10,
    description: "Valid 50 km/h, mid-run confidence drop to 0, then recovery. Missing data is not treated as speed zero.",
    sampleAt: (t) => {
      if (t < 3) {
        return baseSample(t, {
          speedKmh: 50,
          accelerationMs2: 0,
          throttle: 0.24,
          braking: 0,
          motionConfidence: 1,
          primarySource: "tesla-browser",
        });
      }
      if (t < 7) {
        // Hold last speed numerically for the fixture curve, but mark confidence 0 so the
        // harness can apply loss policy without inventing a zero-speed stop.
        return baseSample(t, {
          speedKmh: 50,
          accelerationMs2: 0,
          throttle: 0.24,
          braking: 0,
          motionConfidence: 0,
          primarySource: "tesla-browser",
        });
      }
      return baseSample(t, {
        speedKmh: 50,
        accelerationMs2: 0,
        throttle: 0.24,
        braking: 0,
        motionConfidence: 1,
        primarySource: "tesla-browser",
      });
    },
  },
  {
    id: "profile-switch",
    label: "Abrupt profile switching",
    kind: "speed-driven",
    durationSeconds: 8,
    abruptProfileSwitch: true,
    description: "Steady cruise while the harness switches Sound Profile mid-render.",
    sampleAt: (t) =>
      baseSample(t, {
        speedKmh: 55,
        accelerationMs2: 0,
        throttle: 0.26,
        braking: 0,
      }),
  },
  {
    id: "rpm-sweep",
    label: "RPM sweep (diagnosis)",
    kind: "rpm-load-diagnostic",
    durationSeconds: 8,
    description: "Direct RPM sweep at fixed load — diagnosis only, not speed-driven acceptance.",
    sampleAt: (t) => {
      const p = clamp01(t / 8);
      return baseSample(t, {
        speedKmh: 0,
        accelerationMs2: 0,
        throttle: 0.5,
        braking: 0,
        rpmOverride: lerp(800, 6500, p),
        loadOverride: 0.45,
      });
    },
  },
  {
    id: "load-sweep",
    label: "Load sweep (diagnosis)",
    kind: "rpm-load-diagnostic",
    durationSeconds: 8,
    description: "Direct load sweep at fixed RPM — diagnosis only, not speed-driven acceptance.",
    sampleAt: (t) => {
      const p = clamp01(t / 8);
      return baseSample(t, {
        speedKmh: 0,
        accelerationMs2: 0,
        throttle: p,
        braking: 0,
        rpmOverride: 2800,
        loadOverride: lerp(0.05, 0.95, p),
      });
    },
  },
] as const;

export const SPEED_DRIVEN_FIXTURE_IDS = LAB_FIXTURES.filter((f) => f.kind === "speed-driven").map(
  (f) => f.id,
);

export const DIAGNOSTIC_FIXTURE_IDS = LAB_FIXTURES.filter(
  (f) => f.kind === "rpm-load-diagnostic",
).map((f) => f.id);

export function getLabFixture(id: string): LabFixture {
  const fixture = LAB_FIXTURES.find((entry) => entry.id === id);
  if (!fixture) throw new Error(`Unknown lab fixture: ${id}`);
  return fixture;
}

/** Deterministic sample stream at 60 Hz for hashing / harness replay. */
export function materializeFixture(
  fixture: LabFixture,
  stepSeconds: number = STEP,
): LabTelemetrySample[] {
  const samples: LabTelemetrySample[] = [];
  for (let t = 0; t <= fixture.durationSeconds + 1e-9; t += stepSeconds) {
    const at = Math.min(t, fixture.durationSeconds);
    samples.push(fixture.sampleAt(at));
  }
  return samples;
}

/** Stable fingerprint of a fixture curve for determinism tests (no audio). */
export function fixtureFingerprint(fixtureId: string): string {
  const samples = materializeFixture(getLabFixture(fixtureId));
  let acc = 0;
  for (const sample of samples) {
    acc =
      (acc * 33 +
        Math.round(sample.speedKmh * 100) +
        Math.round(sample.throttle * 1000) +
        Math.round(sample.motionConfidence * 10) +
        Math.round((sample.rpmOverride ?? -1) * 10) +
        Math.round((sample.loadOverride ?? -1) * 1000)) |
      0;
  }
  return `${fixtureId}:${samples.length}:${acc >>> 0}`;
}
