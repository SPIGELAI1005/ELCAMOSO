/**
 * Explicit cylinder / collector topology for Realism V2 combustion (pilot).
 * Concepts adapted from Engine Simulator ignition + exhaust routing (MIT);
 * values are original ELCAMOSO characters - not OEM recreations.
 *
 * Live only when `VITE_COMBUSTION_TOPOLOGY_PILOT` is on and the profile has a preset.
 */

export const COMBUSTION_TOPOLOGY_VERSION = 1 as const;

export const TOPOLOGY_CYLINDER_MIN = 1;
export const TOPOLOGY_CYLINDER_MAX = 12;
export const TOPOLOGY_COLLECTOR_MAX = 4;
export const TOPOLOGY_PRIMARY_LENGTH_MAX_M = 2;
export const TOPOLOGY_SOUND_SPEED_DEFAULT = 343;

export interface CombustionCylinderTopology {
  id: number;
  firingAngleDegrees: number;
  collectorId: number;
  pulseWeight: number;
  /** Header / primary length used for delay = length / soundSpeed (bounded). */
  primaryLengthMetres: number;
}

export interface CombustionCollectorTopology {
  id: number;
}

export interface CombustionTopologyV1 {
  version: typeof COMBUSTION_TOPOLOGY_VERSION;
  cycleDegrees: 360 | 720;
  cylinderCount: number;
  cylinders: CombustionCylinderTopology[];
  collectors: CombustionCollectorTopology[];
  soundSpeedMetresPerSecond: number;
}

export type TopologyValidationIssue = { path: string; message: string };

function readEnv(name: string): string | undefined {
  if (typeof process !== "undefined" && process.env?.[name] != null) {
    return String(process.env[name]).trim().toLowerCase();
  }
  try {
    const meta = import.meta as ImportMeta & { env?: Record<string, string | undefined> };
    const value = meta.env?.[name];
    return value != null ? String(value).trim().toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}

function readFlag(name: string, defaultOn: boolean): boolean {
  const value = readEnv(name);
  if (value === "1" || value === "true" || value === "yes") return true;
  if (value === "0" || value === "false" || value === "no") return false;
  return defaultOn;
}

/** Opt-in pilot for american-muscle-v8 and race-car only. Default off. */
export function isCombustionTopologyPilotEnabled(): boolean {
  let viteLiteral = false;
  try {
    const raw = import.meta.env?.["VITE_COMBUSTION_TOPOLOGY_PILOT"];
    const v = raw != null ? String(raw).trim().toLowerCase() : "";
    viteLiteral = v === "1" || v === "true" || v === "yes";
  } catch {
    viteLiteral = false;
  }
  return (
    viteLiteral ||
    readFlag("VITE_COMBUSTION_TOPOLOGY_PILOT", false) ||
    readFlag("ELCAMOSO_COMBUSTION_TOPOLOGY_PILOT", false)
  );
}

export const TOPOLOGY_PILOT_PROFILE_IDS = [
  "american-muscle-v8",
  "race-car",
  "gt-v8",
  "flat-six-sport",
  "turbo-inline-6",
  "racing-v10",
  "rally-car",
  "motorcycle-superbike",
  "big-twin",
] as const;
export type TopologyPilotProfileId = (typeof TOPOLOGY_PILOT_PROFILE_IDS)[number];

export function isTopologyPilotProfileId(profileId: string): profileId is TopologyPilotProfileId {
  return (TOPOLOGY_PILOT_PROFILE_IDS as readonly string[]).includes(profileId);
}

export function validateCombustionTopology(input: unknown): {
  ok: boolean;
  topology: CombustionTopologyV1 | null;
  issues: TopologyValidationIssue[];
} {
  const issues: TopologyValidationIssue[] = [];
  if (!input || typeof input !== "object") {
    return { ok: false, topology: null, issues: [{ path: "", message: "topology must be an object" }] };
  }
  const t = input as Partial<CombustionTopologyV1>;
  if (t.version !== COMBUSTION_TOPOLOGY_VERSION) {
    issues.push({ path: "version", message: `expected ${COMBUSTION_TOPOLOGY_VERSION}` });
  }
  if (t.cycleDegrees !== 360 && t.cycleDegrees !== 720) {
    issues.push({ path: "cycleDegrees", message: "must be 360 or 720" });
  }
  const cycle = t.cycleDegrees === 360 || t.cycleDegrees === 720 ? t.cycleDegrees : 720;
  if (
    !Number.isInteger(t.cylinderCount) ||
    (t.cylinderCount ?? 0) < TOPOLOGY_CYLINDER_MIN ||
    (t.cylinderCount ?? 0) > TOPOLOGY_CYLINDER_MAX
  ) {
    issues.push({
      path: "cylinderCount",
      message: `integer ${TOPOLOGY_CYLINDER_MIN}..${TOPOLOGY_CYLINDER_MAX}`,
    });
  }
  if (!Array.isArray(t.cylinders) || t.cylinders.length !== t.cylinderCount) {
    issues.push({ path: "cylinders", message: "length must equal cylinderCount" });
  }
  if (!Array.isArray(t.collectors) || t.collectors.length < 1 || t.collectors.length > TOPOLOGY_COLLECTOR_MAX) {
    issues.push({
      path: "collectors",
      message: `1..${TOPOLOGY_COLLECTOR_MAX} collectors required`,
    });
  }
  const soundSpeed =
    Number.isFinite(t.soundSpeedMetresPerSecond) && (t.soundSpeedMetresPerSecond as number) > 0
      ? (t.soundSpeedMetresPerSecond as number)
      : TOPOLOGY_SOUND_SPEED_DEFAULT;

  const collectorIds = new Set<number>();
  for (const [i, c] of (t.collectors ?? []).entries()) {
    if (!c || !Number.isInteger(c.id)) {
      issues.push({ path: `collectors[${i}].id`, message: "integer id required" });
      continue;
    }
    if (collectorIds.has(c.id)) {
      issues.push({ path: `collectors[${i}].id`, message: "duplicate collector id" });
    }
    collectorIds.add(c.id);
  }

  const cylinderIds = new Set<number>();
  const cylinders: CombustionCylinderTopology[] = [];
  for (const [i, cyl] of (t.cylinders ?? []).entries()) {
    if (!cyl || typeof cyl !== "object") {
      issues.push({ path: `cylinders[${i}]`, message: "object required" });
      continue;
    }
    if (!Number.isInteger(cyl.id) || cylinderIds.has(cyl.id)) {
      issues.push({ path: `cylinders[${i}].id`, message: "unique integer id required" });
    } else {
      cylinderIds.add(cyl.id);
    }
    if (!Number.isFinite(cyl.firingAngleDegrees) || cyl.firingAngleDegrees < 0 || cyl.firingAngleDegrees >= cycle) {
      issues.push({
        path: `cylinders[${i}].firingAngleDegrees`,
        message: `finite in [0, ${cycle})`,
      });
    }
    if (!collectorIds.has(cyl.collectorId)) {
      issues.push({ path: `cylinders[${i}].collectorId`, message: "must reference a collector" });
    }
    if (!Number.isFinite(cyl.pulseWeight) || cyl.pulseWeight <= 0 || cyl.pulseWeight > 4) {
      issues.push({ path: `cylinders[${i}].pulseWeight`, message: "finite in (0, 4]" });
    }
    if (
      !Number.isFinite(cyl.primaryLengthMetres) ||
      cyl.primaryLengthMetres < 0 ||
      cyl.primaryLengthMetres > TOPOLOGY_PRIMARY_LENGTH_MAX_M
    ) {
      issues.push({
        path: `cylinders[${i}].primaryLengthMetres`,
        message: `finite in [0, ${TOPOLOGY_PRIMARY_LENGTH_MAX_M}]`,
      });
    }
    cylinders.push({
      id: cyl.id,
      firingAngleDegrees: cyl.firingAngleDegrees,
      collectorId: cyl.collectorId,
      pulseWeight: cyl.pulseWeight,
      primaryLengthMetres: cyl.primaryLengthMetres,
    });
  }

  if (issues.length) return { ok: false, topology: null, issues };

  return {
    ok: true,
    topology: {
      version: COMBUSTION_TOPOLOGY_VERSION,
      cycleDegrees: cycle,
      cylinderCount: t.cylinderCount as number,
      cylinders,
      collectors: (t.collectors as CombustionCollectorTopology[]).map((c) => ({ id: c.id })),
      soundSpeedMetresPerSecond: soundSpeed,
    },
    issues: [],
  };
}

function v8Cylinders(
  order: number[],
  collectorForCylinder: (cyl: number) => number,
  primaryForIndex: (i: number) => number,
  pulseWeight = 1,
): CombustionCylinderTopology[] {
  // Even 90° spacing over 720° in firing order.
  return order.map((cylId, i) => ({
    id: cylId,
    firingAngleDegrees: i * 90,
    collectorId: collectorForCylinder(cylId),
    pulseWeight,
    primaryLengthMetres: primaryForIndex(i),
  }));
}

/**
 * Cross-plane muscle V8: order 1-8-7-2-6-5-4-3, banks → collectors.
 * Odd cylinders → collector 0; even → collector 1. Mild primary-length stagger.
 */
export const MUSCLE_V8_TOPOLOGY: CombustionTopologyV1 = {
  version: 1,
  cycleDegrees: 720,
  cylinderCount: 8,
  collectors: [{ id: 0 }, { id: 1 }],
  soundSpeedMetresPerSecond: TOPOLOGY_SOUND_SPEED_DEFAULT,
  cylinders: v8Cylinders(
    [1, 8, 7, 2, 6, 5, 4, 3],
    (cyl) => (cyl % 2 === 1 ? 0 : 1),
    (i) => 0.06 + (i % 4) * 0.035,
  ),
};

/**
 * Flat-plane track V8: even 90° spacing, alternating collectors each fire,
 * matched primaries (balanced banks).
 */
export const FLAT_PLANE_V8_TOPOLOGY: CombustionTopologyV1 = {
  version: 1,
  cycleDegrees: 720,
  cylinderCount: 8,
  collectors: [{ id: 0 }, { id: 1 }],
  soundSpeedMetresPerSecond: TOPOLOGY_SOUND_SPEED_DEFAULT,
  cylinders: [1, 5, 3, 7, 4, 8, 2, 6].map((cylId, i) => ({
    id: cylId,
    firingAngleDegrees: i * 90,
    collectorId: i % 2,
    pulseWeight: 1,
    primaryLengthMetres: 0.12,
  })),
};

/**
 * GT V8: Cross-plane like Muscle but with slightly shorter primaries and
 * more even pulse weights for a refined character.
 */
export const GT_V8_TOPOLOGY: CombustionTopologyV1 = {
  version: 1,
  cycleDegrees: 720,
  cylinderCount: 8,
  collectors: [{ id: 0 }, { id: 1 }],
  soundSpeedMetresPerSecond: TOPOLOGY_SOUND_SPEED_DEFAULT,
  cylinders: v8Cylinders(
    [1, 8, 7, 2, 6, 5, 4, 3],
    (cyl) => (cyl % 2 === 1 ? 0 : 1),
    () => 0.1,
    1,
  ),
};

/**
 * Flat-six sport: 1-6-2-4-3-5 firing order (Porsche-style), 120° intervals,
 * collectors split banks (1-3-5 vs 2-4-6).
 */
export const FLAT_SIX_TOPOLOGY: CombustionTopologyV1 = {
  version: 1,
  cycleDegrees: 720,
  cylinderCount: 6,
  collectors: [{ id: 0 }, { id: 1 }],
  soundSpeedMetresPerSecond: TOPOLOGY_SOUND_SPEED_DEFAULT,
  cylinders: [1, 6, 2, 4, 3, 5].map((cylId, i) => ({
    id: cylId,
    firingAngleDegrees: i * 120,
    collectorId: cylId % 2 === 1 ? 0 : 1,
    pulseWeight: 1,
    primaryLengthMetres: 0.08,
  })),
};

/**
 * Turbo Inline-6: 1-5-3-6-2-4 firing order, 120° intervals, single collector.
 */
export const TURBO_I6_TOPOLOGY: CombustionTopologyV1 = {
  version: 1,
  cycleDegrees: 720,
  cylinderCount: 6,
  collectors: [{ id: 0 }],
  soundSpeedMetresPerSecond: TOPOLOGY_SOUND_SPEED_DEFAULT,
  cylinders: [1, 5, 3, 6, 2, 4].map((cylId, i) => ({
    id: cylId,
    firingAngleDegrees: i * 120,
    collectorId: 0,
    pulseWeight: 1,
    primaryLengthMetres: 0.06 + (cylId - 1) * 0.015,
  })),
};

/**
 * Racing V10: Even-firing 90° V10, 72° intervals, collectors split banks.
 * Order: 1-6-5-10-2-7-3-8-4-9
 */
export const V10_TOPOLOGY: CombustionTopologyV1 = {
  version: 1,
  cycleDegrees: 720,
  cylinderCount: 10,
  collectors: [{ id: 0 }, { id: 1 }],
  soundSpeedMetresPerSecond: TOPOLOGY_SOUND_SPEED_DEFAULT,
  cylinders: [1, 6, 5, 10, 2, 7, 3, 8, 4, 9].map((cylId, i) => ({
    id: cylId,
    firingAngleDegrees: i * 72,
    collectorId: cylId % 2 === 1 ? 0 : 1,
    pulseWeight: 1,
    primaryLengthMetres: 0.11,
  })),
};

/**
 * Rally Inline-3 turbo: 1-2-3 firing order, 240° intervals, single collector.
 * Has noticeable pulse irregularity (odd cylinder count).
 */
export const RALLY_I3_TOPOLOGY: CombustionTopologyV1 = {
  version: 1,
  cycleDegrees: 720,
  cylinderCount: 3,
  collectors: [{ id: 0 }],
  soundSpeedMetresPerSecond: TOPOLOGY_SOUND_SPEED_DEFAULT,
  cylinders: [1, 2, 3].map((cylId, i) => ({
    id: cylId,
    firingAngleDegrees: i * 240,
    collectorId: 0,
    pulseWeight: 1.1 - i * 0.05,
    primaryLengthMetres: 0.04 + i * 0.02,
  })),
};

/**
 * Superbike Inline-4: 1-3-4-2 firing order (crossplane), 180° intervals for smooth,
 * or 270-180-90-180 for MotoGP-style. Using even 180° here.
 */
export const SUPERBIKE_I4_TOPOLOGY: CombustionTopologyV1 = {
  version: 1,
  cycleDegrees: 720,
  cylinderCount: 4,
  collectors: [{ id: 0 }],
  soundSpeedMetresPerSecond: TOPOLOGY_SOUND_SPEED_DEFAULT,
  cylinders: [1, 3, 4, 2].map((cylId, i) => ({
    id: cylId,
    firingAngleDegrees: i * 180,
    collectorId: 0,
    pulseWeight: 1,
    primaryLengthMetres: 0.06,
  })),
};

/**
 * Big Twin V-twin (cruiser): 45° V-twin with uneven firing (315°/405° or similar).
 * Single collector for that classic loping sound.
 */
export const V_TWIN_TOPOLOGY: CombustionTopologyV1 = {
  version: 1,
  cycleDegrees: 720,
  cylinderCount: 2,
  collectors: [{ id: 0 }],
  soundSpeedMetresPerSecond: TOPOLOGY_SOUND_SPEED_DEFAULT,
  cylinders: [
    { id: 1, firingAngleDegrees: 0, collectorId: 0, pulseWeight: 1.15, primaryLengthMetres: 0.08 },
    { id: 2, firingAngleDegrees: 315, collectorId: 0, pulseWeight: 1.0, primaryLengthMetres: 0.1 },
  ],
};

export const TOPOLOGY_BY_PILOT_PROFILE: Record<TopologyPilotProfileId, CombustionTopologyV1> = {
  "american-muscle-v8": MUSCLE_V8_TOPOLOGY,
  "race-car": FLAT_PLANE_V8_TOPOLOGY,
  "gt-v8": GT_V8_TOPOLOGY,
  "flat-six-sport": FLAT_SIX_TOPOLOGY,
  "turbo-inline-6": TURBO_I6_TOPOLOGY,
  "racing-v10": V10_TOPOLOGY,
  "rally-car": RALLY_I3_TOPOLOGY,
  "motorcycle-superbike": SUPERBIKE_I4_TOPOLOGY,
  "big-twin": V_TWIN_TOPOLOGY,
};

export function combustionTopologyForProfile(profileId: string): CombustionTopologyV1 | null {
  if (!isTopologyPilotProfileId(profileId)) return null;
  const raw = TOPOLOGY_BY_PILOT_PROFILE[profileId];
  const checked = validateCombustionTopology(raw);
  return checked.ok ? checked.topology : null;
}

/** Expected fire count over one full cycle (for tests). */
export function firesPerCycle(topology: CombustionTopologyV1): number {
  return topology.cylinders.length;
}
