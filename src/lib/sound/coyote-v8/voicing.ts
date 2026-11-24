/**
 * Per-profile voicing of the Coyote V8 loop bank (Nov 2026, George: "apply for the two
 * Ge-Squared sounds the V8 sound, but have for the O))) a more brutal raw sound, matching to
 * the profile, and for the '90 a more classic mechanical sound").
 *
 * The bank, the crank-locked loops, the Racing V10 gear shift and the race-mode overrun are
 * shared; a voicing only adds a small fixed tone chain after the loops, scales the overrun
 * pops and can add a profile layer (O))) afterfire bangs, '90 valvetrain). American Muscle V8
 * (and Police Patrol through it) uses COYOTE_V8_VOICING: no extra nodes, every level x1, the
 * same random draws, so it renders exactly as before.
 */

/** Fixed tone chain after the loops and one-shots (null = none, the plain V8). */
export interface CoyoteToneChain {
  /** Parallel grit: drive into an asymmetric soft clipper, mixed under the dry signal. */
  grit: { drive: number; mix: number; asym: number; lowpassHz: number } | null;
  lowShelf: { hz: number; db: number };
  peak: { hz: number; db: number; q: number };
  highShelf: { hz: number; db: number };
  /** Final band limit: no high-frequency fizz, no metallic ring. */
  lowpassHz: number;
  /** Output trim (linear) so the voiced engine sits at the intended loudness. */
  trim: number;
}

/** Overrun pops / crackle (road lift-off, rev-match blips and race-mode sequences). */
export interface CoyotePopVoicing {
  /** level x for road lift-off pops and race pop sequences */
  level: number;
  /** playback rate x (below 1: deeper, boomier) */
  rate: number;
  /** extra pops on a road lift-off that already pops (O))) +1, '90 -1) */
  extraPops: number;
  /** race-mode lift / downshift sequence probability (V8: V10_RACE.liftPops.probability) */
  raceLiftProbability: number;
  /** race-mode crackle tail level x */
  crackle: number;
  /** race-mode upshift crack / limiter pop probabilities (V8: V10_RACE values) */
  raceCrackProbability: number;
  limiterPopProbability: number;
  /** race-mode limiter and upshift-cut gate floors (higher = softer cut) */
  limiterGateFloor: number;
  shiftGateFloor: number;
}

/** O))): the Ge-Squared afterfire bangs (already in the app, ge2_o_afterfire.m4a). */
export interface CoyoteAfterfire {
  url: string;
  /** bang windows inside the file (s) */
  bangs: readonly { start: number; end: number }[];
  /** at most this many bangs per lift */
  maxBangs: number;
  level: number;
  rate: number;
  /** rpm where bangs start / reach full strength */
  minRpm: number;
  fullRpm: number;
}

/** '90: lifters / valvetrain ticking with the crank, band-limited, under the exhaust. */
export interface CoyoteValvetrain {
  level: number;
  /** ticks per engine cycle (720 deg) */
  ticksPerCycle: number;
  bandHz: number;
  q: number;
}

export interface CoyoteVoicing {
  id: string;
  tone: CoyoteToneChain | null;
  pops: CoyotePopVoicing;
  afterfire: CoyoteAfterfire | null;
  valvetrain: CoyoteValvetrain | null;
}

/** American Muscle V8 / Police Patrol: the Coyote exactly as live (identity). */
export const COYOTE_V8_VOICING: CoyoteVoicing = {
  id: "american-muscle-v8",
  tone: null,
  pops: {
    level: 1,
    rate: 1,
    extraPops: 0,
    raceLiftProbability: 0.6,
    crackle: 1,
    raceCrackProbability: 0.5,
    limiterPopProbability: 0.4,
    limiterGateFloor: 0.12,
    shiftGateFloor: 0.3,
  },
  afterfire: null,
  valvetrain: null,
};

/**
 * Ge-Squared O))): brutal and raw. Grit (parallel asymmetric clipping, band-limited before it
 * is mixed in), more low-mid punch, a darker top (no fizz, no ring), louder and deeper
 * overrun, harder limiter cut, and the profile's own deep afterfire bangs on lift-off.
 */
export const GE_SQUARED_O_VOICING: CoyoteVoicing = {
  id: "ge-squared",
  tone: {
    grit: { drive: 12, mix: 0.6, asym: 0.25, lowpassHz: 3800 },
    lowShelf: { hz: 110, db: 2.5 },
    peak: { hz: 240, db: 2.5, q: 0.9 },
    highShelf: { hz: 3200, db: -4 },
    lowpassHz: 6500,
    trim: 0.8,
  },
  pops: {
    level: 1.45,
    rate: 0.86,
    extraPops: 1,
    raceLiftProbability: 0.85,
    crackle: 1.35,
    raceCrackProbability: 0.7,
    limiterPopProbability: 0.55,
    limiterGateFloor: 0.06,
    shiftGateFloor: 0.22,
  },
  afterfire: {
    url: "/sample-packs/recorded/v7/ge2_o_afterfire.m4a",
    bangs: [
      { start: 0, end: 0.45 },
      { start: 0.5, end: 0.95 },
      { start: 1.0, end: 1.45 },
      { start: 1.5, end: 1.95 },
      { start: 2.0, end: 2.45 },
      { start: 2.5, end: 2.95 },
      { start: 3.0, end: 3.45 },
      { start: 3.5, end: 3.95 },
    ],
    maxBangs: 2,
    level: 0.9,
    rate: 0.74,
    minRpm: 1800,
    fullRpm: 4500,
  },
  valvetrain: null,
};

/**
 * Ge-Squared '90: classic mechanical. Smoother and older-school: softer low end, an intake /
 * induction mid, a muffled top, audible lifters ticking with the crank, milder and fewer pops
 * and a gentler limiter / upshift cut in race mode.
 */
export const GE_SQUARED_90_VOICING: CoyoteVoicing = {
  id: "ge-squared-90",
  tone: {
    grit: null,
    lowShelf: { hz: 90, db: -1.5 },
    peak: { hz: 650, db: 3, q: 1.1 },
    highShelf: { hz: 2600, db: -3 },
    lowpassHz: 4300,
    trim: 1.05,
  },
  pops: {
    level: 0.5,
    rate: 0.9,
    extraPops: -1,
    raceLiftProbability: 0.35,
    crackle: 0.45,
    raceCrackProbability: 0.15,
    limiterPopProbability: 0.12,
    limiterGateFloor: 0.3,
    shiftGateFloor: 0.5,
  },
  afterfire: null,
  valvetrain: { level: 0.15, ticksPerCycle: 8, bandHz: 2400, q: 1.3 },
};

const BY_PROFILE: Readonly<Record<string, CoyoteVoicing>> = {
  "american-muscle-v8": COYOTE_V8_VOICING,
  "ge-squared": GE_SQUARED_O_VOICING,
  "ge-squared-90": GE_SQUARED_90_VOICING,
};

/**
 * Voicing for the profile the engine builds (after aliases), or null when it is not a Coyote
 * sound. Private Jet Oberpfaffenhofen plays the old Ge-Squared engine (alias base
 * "ge-squared"), so a request for it keeps the previous hybrid Ge-Squared, unchanged.
 */
export function coyoteVoicingFor(
  profileId: string | null | undefined,
  requestedId?: string | null,
): CoyoteVoicing | null {
  if (!profileId) return null;
  if (requestedId === "private-jet") return null;
  return BY_PROFILE[profileId] ?? null;
}

/**
 * Asymmetric soft-clip curve: unity gain for small signals, tanh compression from about
 * 1/drive up, harder on one side (even harmonics = grit). Input range -1..1.
 */
export function gritCurve(drive: number, asym: number, n = 1024): Float32Array {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * 2 - 1;
    const d = Math.max(1e-3, drive * (x >= 0 ? 1 + asym : 1 - asym));
    c[i] = Math.tanh(x * d) / d;
  }
  return c;
}

/** Afterfire bang strength for an rpm (0 below minRpm, 1 from fullRpm). */
export function afterfireStrength(af: CoyoteAfterfire, rpm: number): number {
  return Math.min(1, Math.max(0, (rpm - af.minRpm) / Math.max(1, af.fullRpm - af.minRpm)));
}
