import type { ResolvedDrivetrain } from "@/lib/drive/drivetrain-resolve";
import type { TransientAudioConfig } from "@/lib/drive/drivetrain-personalities";
import type { VirtualPowertrainState } from "@/lib/powertrain/types";
import type { DynamicLayerId } from "@/lib/sound/dynamic-drive/types";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export type TransientAspiration = "na" | "turbo" | "electric";

export type TransientKind =
  | "upshift"
  | "rev-match"
  | "downshift"
  | "overrun"
  | "exhaust-pop"
  | "turbo-flutter"
  | "wastegate"
  | "drivetrain-thump";

export interface TransientVariant {
  id: string;
  intensity: number;
  filterHz: number;
  decayMs: number;
}

export interface TransientSchedulerProfile {
  upshift: { probability: number; cooldownMs: number; minLoad: number };
  revMatch: {
    probability: number;
    cooldownMs: number;
    minSpeedKmh: number;
    minSpeedDeltaKmh: number;
    minThrottle: number;
    minLoad: number;
    minProgress: number;
  };
  downshift: { probability: number; cooldownMs: number; minLoad: number };
  overrun: {
    probability: number;
    cooldownMs: number;
    minPriorThrottle: number;
    minSpeedKmh: number;
  };
  exhaustPop: {
    probability: number;
    cooldownMs: number;
    minPriorThrottle: number;
    minSpeedKmh: number;
    minThrottleDrop: number;
  };
  turboFlutter: { probability: number; cooldownMs: number; minLoad: number; minRpmNorm: number };
  wastegate: { probability: number; cooldownMs: number; minLoad: number; minRpmNorm: number };
  drivetrainThump: {
    probability: number;
    cooldownMs: number;
    minLoad: number;
    minSpeedKmh: number;
  };
}

export interface ActiveTransientPulse {
  kind: TransientKind;
  layerId: DynamicLayerId;
  variantId: string;
  startedAtMs: number;
  durationMs: number;
  peakIntensity: number;
  filterHz: number;
}

export interface TransientSchedulerState {
  lastFiredAt: Partial<Record<TransientKind, number>>;
  active: ActiveTransientPulse[];
  rng: number;
}

export interface ScheduledTransientLayers {
  layers: Partial<Record<DynamicLayerId, number>>;
  variants: Partial<Record<DynamicLayerId, TransientVariant>>;
}

export interface PersonalityVariantPools {
  upshift: TransientVariant[];
  revMatch: TransientVariant[];
  downshift: TransientVariant[];
  overrun: TransientVariant[];
  exhaustPop: TransientVariant[];
  turboFlutter: TransientVariant[];
  wastegate: TransientVariant[];
  thump: TransientVariant[];
}

const MAX_NEW_TRANSIENTS_PER_TICK = 2;
const INTENSITY_JITTER_MIN = 0.88;
const INTENSITY_JITTER_SPAN = 0.14;

const DEFAULT_UPSHIFT: TransientVariant[] = [
  { id: "upshift-crisp", intensity: 0.82, filterHz: 940, decayMs: 170 },
  { id: "upshift-soft", intensity: 0.62, filterHz: 760, decayMs: 230 },
  { id: "upshift-race", intensity: 0.95, filterHz: 1120, decayMs: 130 },
];

const DEFAULT_DOWNSHIFT: TransientVariant[] = [
  { id: "downshift-crisp", intensity: 0.76, filterHz: 820, decayMs: 195 },
  { id: "downshift-soft", intensity: 0.56, filterHz: 680, decayMs: 245 },
  { id: "downshift-blip", intensity: 0.86, filterHz: 960, decayMs: 160 },
];

const DEFAULT_REV_MATCH: TransientVariant[] = [
  { id: "rev-blip", intensity: 0.58, filterHz: 880, decayMs: 160 },
  { id: "rev-sync", intensity: 0.72, filterHz: 1020, decayMs: 190 },
  { id: "rev-aggressive", intensity: 0.88, filterHz: 1180, decayMs: 140 },
];

const DEFAULT_OVERRUN: TransientVariant[] = [
  { id: "overrun-soft", intensity: 0.55, filterHz: 620, decayMs: 420 },
  { id: "overrun-medium", intensity: 0.72, filterHz: 720, decayMs: 360 },
];

const DEFAULT_EXHAUST_POP: TransientVariant[] = [
  { id: "pop-subtle", intensity: 0.42, filterHz: 480, decayMs: 120 },
  { id: "pop-crisp", intensity: 0.58, filterHz: 620, decayMs: 95 },
];

const DEFAULT_TURBO_FLUTTER: TransientVariant[] = [
  { id: "flutter-light", intensity: 0.48, filterHz: 1350, decayMs: 180 },
  { id: "flutter-mid", intensity: 0.62, filterHz: 1580, decayMs: 150 },
];

const DEFAULT_WASTEGATE: TransientVariant[] = [
  { id: "wg-chatter", intensity: 0.5, filterHz: 980, decayMs: 140 },
  { id: "wg-hiss", intensity: 0.38, filterHz: 820, decayMs: 200 },
];

const DEFAULT_THUMP: TransientVariant[] = [
  { id: "thump-soft", intensity: 0.45, filterHz: 140, decayMs: 200 },
  { id: "thump-firm", intensity: 0.62, filterHz: 185, decayMs: 170 },
];

/** Per-personality procedural one-shot shapes (sample-ready filenames in asset doc). */
export function resolveVariantPools(transient: {
  variantPools?: Partial<PersonalityVariantPools>;
}): PersonalityVariantPools {
  const custom = transient.variantPools ?? {};
  return {
    upshift: custom.upshift ?? DEFAULT_UPSHIFT,
    revMatch: custom.revMatch ?? DEFAULT_REV_MATCH,
    downshift: custom.downshift ?? DEFAULT_DOWNSHIFT,
    overrun: custom.overrun ?? DEFAULT_OVERRUN,
    exhaustPop: custom.exhaustPop ?? DEFAULT_EXHAUST_POP,
    turboFlutter: custom.turboFlutter ?? DEFAULT_TURBO_FLUTTER,
    wastegate: custom.wastegate ?? DEFAULT_WASTEGATE,
    thump: custom.thump ?? DEFAULT_THUMP,
  };
}

const KIND_TO_LAYER: Record<TransientKind, DynamicLayerId> = {
  upshift: "dd-upshift",
  "rev-match": "dd-rev-match",
  downshift: "dd-downshift",
  overrun: "dd-overrun",
  "exhaust-pop": "dd-exhaust-pop",
  "turbo-flutter": "dd-turbo-flutter",
  wastegate: "dd-wastegate",
  "drivetrain-thump": "dd-drivetrain-thump",
};

export function defaultSchedulerProfile(
  aspiration: TransientAspiration,
): TransientSchedulerProfile {
  if (aspiration === "electric") {
    return {
      upshift: { probability: 0.35, cooldownMs: 900, minLoad: 0.25 },
      revMatch: {
        probability: 0,
        cooldownMs: 99999,
        minSpeedKmh: 99,
        minSpeedDeltaKmh: 99,
        minThrottle: 1,
        minLoad: 1,
        minProgress: 1,
      },
      downshift: { probability: 0.25, cooldownMs: 1200, minLoad: 0.2 },
      overrun: { probability: 0, cooldownMs: 99999, minPriorThrottle: 1, minSpeedKmh: 99 },
      exhaustPop: {
        probability: 0,
        cooldownMs: 99999,
        minPriorThrottle: 1,
        minSpeedKmh: 99,
        minThrottleDrop: 1,
      },
      turboFlutter: { probability: 0, cooldownMs: 99999, minLoad: 1, minRpmNorm: 1 },
      wastegate: { probability: 0, cooldownMs: 99999, minLoad: 1, minRpmNorm: 1 },
      drivetrainThump: { probability: 0.15, cooldownMs: 1800, minLoad: 0.35, minSpeedKmh: 20 },
    };
  }

  if (aspiration === "turbo") {
    return {
      upshift: { probability: 0.72, cooldownMs: 520, minLoad: 0.28 },
      revMatch: {
        probability: 0.55,
        cooldownMs: 900,
        minSpeedKmh: 28,
        minSpeedDeltaKmh: 7,
        minThrottle: 0.18,
        minLoad: 0.28,
        minProgress: 0.22,
      },
      downshift: { probability: 0.45, cooldownMs: 700, minLoad: 0.32 },
      overrun: { probability: 0.55, cooldownMs: 1400, minPriorThrottle: 0.3, minSpeedKmh: 22 },
      exhaustPop: {
        probability: 0.12,
        cooldownMs: 3200,
        minPriorThrottle: 0.42,
        minSpeedKmh: 38,
        minThrottleDrop: 0.28,
      },
      turboFlutter: { probability: 0.38, cooldownMs: 1100, minLoad: 0.45, minRpmNorm: 0.42 },
      wastegate: { probability: 0.28, cooldownMs: 1600, minLoad: 0.52, minRpmNorm: 0.48 },
      drivetrainThump: { probability: 0.32, cooldownMs: 1100, minLoad: 0.38, minSpeedKmh: 25 },
    };
  }

  return {
    upshift: { probability: 0.68, cooldownMs: 480, minLoad: 0.3 },
    revMatch: {
      probability: 0.48,
      cooldownMs: 950,
      minSpeedKmh: 32,
      minSpeedDeltaKmh: 9,
      minThrottle: 0.22,
      minLoad: 0.34,
      minProgress: 0.28,
    },
    downshift: { probability: 0.42, cooldownMs: 750, minLoad: 0.34 },
    overrun: { probability: 0.5, cooldownMs: 1600, minPriorThrottle: 0.32, minSpeedKmh: 26 },
    exhaustPop: {
      probability: 0.17,
      cooldownMs: 3600,
      minPriorThrottle: 0.4,
      minSpeedKmh: 42,
      minThrottleDrop: 0.3,
    },
    turboFlutter: { probability: 0, cooldownMs: 99999, minLoad: 1, minRpmNorm: 1 },
    wastegate: { probability: 0, cooldownMs: 99999, minLoad: 1, minRpmNorm: 1 },
    drivetrainThump: { probability: 0.35, cooldownMs: 1200, minLoad: 0.4, minSpeedKmh: 28 },
  };
}

export function resolveSchedulerProfile(
  transient: TransientAudioConfig,
): TransientSchedulerProfile {
  const base = defaultSchedulerProfile(transient.aspiration);
  const overrides = transient.scheduler;
  if (!overrides) return base;
  return {
    upshift: { ...base.upshift, ...overrides.upshift },
    revMatch: { ...base.revMatch, ...overrides.revMatch },
    downshift: { ...base.downshift, ...overrides.downshift },
    overrun: { ...base.overrun, ...overrides.overrun },
    exhaustPop: { ...base.exhaustPop, ...overrides.exhaustPop },
    turboFlutter: { ...base.turboFlutter, ...overrides.turboFlutter },
    wastegate: { ...base.wastegate, ...overrides.wastegate },
    drivetrainThump: { ...base.drivetrainThump, ...overrides.drivetrainThump },
  };
}

export function createTransientSchedulerState(seed = 0.42): TransientSchedulerState {
  return { lastFiredAt: {}, active: [], rng: seed };
}

function nextRand(state: TransientSchedulerState): number {
  state.rng = (state.rng * 16807 + 0.123) % 1;
  return state.rng;
}

function canFire(
  state: TransientSchedulerState,
  kind: TransientKind,
  nowMs: number,
  cooldownMs: number,
): boolean {
  const last = state.lastFiredAt[kind];
  if (last === undefined) return true;
  return nowMs - last >= cooldownMs;
}

function pickVariant(
  state: TransientSchedulerState,
  variants: TransientVariant[],
  options?: { preferSubtle?: boolean },
): TransientVariant {
  if (options?.preferSubtle && variants.length > 1 && nextRand(state) < 0.62) {
    const sorted = [...variants].sort((a, b) => a.intensity - b.intensity);
    const subtle = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
    return subtle[Math.floor(nextRand(state) * subtle.length)]!;
  }
  const idx = Math.floor(nextRand(state) * variants.length) % variants.length;
  return variants[idx]!;
}

function intensityJitter(state: TransientSchedulerState): number {
  return INTENSITY_JITTER_MIN + nextRand(state) * INTENSITY_JITTER_SPAN;
}

function tryFire(
  state: TransientSchedulerState,
  nowMs: number,
  kind: TransientKind,
  probability: number,
  cooldownMs: number,
  variantPool: TransientVariant[],
  strengthScale: number,
  options?: { preferSubtle?: boolean },
): boolean {
  if (!canFire(state, kind, nowMs, cooldownMs)) return false;
  if (nextRand(state) > probability) return false;
  const variant = pickVariant(state, variantPool, options);
  state.lastFiredAt[kind] = nowMs;
  state.active.push({
    kind,
    layerId: KIND_TO_LAYER[kind],
    variantId: variant.id,
    startedAtMs: nowMs,
    durationMs: variant.decayMs,
    peakIntensity: variant.intensity * strengthScale * intensityJitter(state),
    filterHz: variant.filterHz,
  });
  return true;
}

function isMeaningfulDownshift(
  pt: VirtualPowertrainState,
  prevPt: VirtualPowertrainState | null,
): boolean {
  if (!pt.shifting || pt.shiftDirection !== "down") return false;
  const prevGear = prevPt?.gear ?? pt.gear;
  return pt.targetGear < prevGear || pt.gear < prevGear;
}

function isMeaningfulRevMatch(input: {
  pt: VirtualPowertrainState;
  prevPt: VirtualPowertrainState | null;
  speedKmh: number;
  prevSpeedKmh: number;
  profile: TransientSchedulerProfile;
}): boolean {
  const { pt, prevPt, speedKmh, prevSpeedKmh, profile } = input;
  const speedDelta = Math.abs(speedKmh - prevSpeedKmh);
  return (
    speedKmh >= profile.revMatch.minSpeedKmh &&
    pt.throttle >= profile.revMatch.minThrottle &&
    pt.load >= profile.revMatch.minLoad &&
    (speedDelta >= profile.revMatch.minSpeedDeltaKmh || isMeaningfulDownshift(pt, prevPt))
  );
}

function isMeaningfulLiftOff(input: {
  pt: VirtualPowertrainState;
  prevPt: VirtualPowertrainState | null;
  speedKmh: number;
  profile: TransientSchedulerProfile;
}): boolean {
  const { pt, prevPt, speedKmh, profile } = input;
  const priorThrottle = prevPt?.throttle ?? 0;
  const throttleDrop = priorThrottle - pt.throttle;
  return (
    speedKmh >= profile.exhaustPop.minSpeedKmh &&
    priorThrottle >= profile.exhaustPop.minPriorThrottle &&
    throttleDrop >= profile.exhaustPop.minThrottleDrop
  );
}

function pulseEnvelope(pulse: ActiveTransientPulse, nowMs: number): number {
  const elapsed = nowMs - pulse.startedAtMs;
  if (elapsed >= pulse.durationMs) return 0;
  const t = elapsed / Math.max(1, pulse.durationMs);
  const decay = Math.pow(1 - t, 1.55);
  return pulse.peakIntensity * decay;
}

function rpmNorm(pt: VirtualPowertrainState, drivetrain: ResolvedDrivetrain): number {
  const idle = drivetrain.personality.engine.idleRpm;
  const redline = drivetrain.personality.engine.redlineRpm;
  const span = Math.max(1, redline - idle);
  return clamp01(pt.normalizedRpm > 0 ? pt.normalizedRpm : (pt.rpm - idle) / span);
}

function shiftStarted(pt: VirtualPowertrainState, prev: VirtualPowertrainState | null): boolean {
  if (!pt.shifting) return false;
  if (!prev?.shifting) return true;
  return (pt.shiftProgress ?? 0) < 0.08 && (prev.shiftProgress ?? 1) > 0.35;
}

function overrunStarted(pt: VirtualPowertrainState, prev: VirtualPowertrainState | null): boolean {
  return pt.overrun && !prev?.overrun;
}

export function tickTransientScheduler(input: {
  pt: VirtualPowertrainState;
  prevPt: VirtualPowertrainState | null;
  drivetrain: ResolvedDrivetrain;
  speedKmh: number;
  prevSpeedKmh?: number;
  state: TransientSchedulerState;
  nowMs: number;
}): { state: TransientSchedulerState; output: ScheduledTransientLayers } {
  const { pt, prevPt, drivetrain, speedKmh, nowMs } = input;
  const prevSpeedKmh = input.prevSpeedKmh ?? speedKmh;
  const state = input.state;
  const profile = resolveSchedulerProfile(drivetrain.transient);
  const t = drivetrain.transient;
  const rpmN = rpmNorm(pt, drivetrain);
  const pools = resolveVariantPools(drivetrain.transient);
  let newFires = 0;

  const fire = (
    kind: TransientKind,
    probability: number,
    cooldownMs: number,
    variantPool: TransientVariant[],
    strengthScale: number,
    options?: { preferSubtle?: boolean },
  ) => {
    if (newFires >= MAX_NEW_TRANSIENTS_PER_TICK) return;
    if (tryFire(state, nowMs, kind, probability, cooldownMs, variantPool, strengthScale, options)) {
      newFires++;
    }
  };

  if (
    shiftStarted(pt, prevPt) &&
    pt.shiftDirection === "up" &&
    pt.load >= profile.upshift.minLoad
  ) {
    fire(
      "upshift",
      profile.upshift.probability,
      profile.upshift.cooldownMs,
      pools.upshift,
      t.upshiftStrength,
    );
  }

  if (
    pt.revMatchActive &&
    drivetrain.powertrain.transmission.shift.revMatchEnabled &&
    pt.revMatchProgress >= profile.revMatch.minProgress &&
    (prevPt?.revMatchProgress ?? 0) < profile.revMatch.minProgress &&
    isMeaningfulRevMatch({ pt, prevPt, speedKmh, prevSpeedKmh, profile })
  ) {
    fire(
      "rev-match",
      profile.revMatch.probability,
      profile.revMatch.cooldownMs,
      pools.revMatch,
      t.revMatchStrength,
    );
  }

  if (
    shiftStarted(pt, prevPt) &&
    pt.shiftDirection === "down" &&
    pt.load >= profile.downshift.minLoad
  ) {
    fire(
      "downshift",
      profile.downshift.probability,
      profile.downshift.cooldownMs,
      pools.downshift,
      t.downshiftStrength * 0.55,
    );
  }

  if (
    pt.shifting &&
    pt.shiftDirection === "down" &&
    pt.load >= profile.drivetrainThump.minLoad &&
    speedKmh >= profile.drivetrainThump.minSpeedKmh &&
    (pt.shiftProgress ?? 0) > 0.55 &&
    (prevPt?.shiftProgress ?? 0) <= 0.55
  ) {
    fire(
      "drivetrain-thump",
      profile.drivetrainThump.probability,
      profile.drivetrainThump.cooldownMs,
      pools.thump,
      t.downshiftStrength * 0.7,
    );
  }

  if (
    overrunStarted(pt, prevPt) &&
    speedKmh >= profile.overrun.minSpeedKmh &&
    pt.throttle <= profile.overrun.minPriorThrottle + 0.15
  ) {
    fire(
      "overrun",
      profile.overrun.probability,
      profile.overrun.cooldownMs,
      pools.overrun,
      t.overrunStrength,
    );
  }

  if (
    overrunStarted(pt, prevPt) &&
    drivetrain.transient.aspiration === "na" &&
    pt.throttle <= 0.12 &&
    isMeaningfulLiftOff({ pt, prevPt, speedKmh, profile })
  ) {
    fire(
      "exhaust-pop",
      profile.exhaustPop.probability,
      profile.exhaustPop.cooldownMs,
      pools.exhaustPop,
      t.overrunStrength * 0.55,
      { preferSubtle: true },
    );
  }

  if (
    drivetrain.transient.aspiration === "turbo" &&
    pt.load >= profile.turboFlutter.minLoad &&
    (prevPt?.load ?? 0) >= profile.turboFlutter.minLoad * 0.85 &&
    rpmN >= profile.turboFlutter.minRpmNorm &&
    pt.throttle < (prevPt?.throttle ?? pt.throttle) - 0.08 &&
    pt.throttle >= 0.2
  ) {
    fire(
      "turbo-flutter",
      profile.turboFlutter.probability,
      profile.turboFlutter.cooldownMs,
      pools.turboFlutter,
      0.65,
    );
  }

  if (
    drivetrain.transient.aspiration === "turbo" &&
    pt.load >= profile.wastegate.minLoad &&
    rpmN >= profile.wastegate.minRpmNorm &&
    pt.throttle >= 0.55 &&
    pt.throttle > (prevPt?.throttle ?? 0) + 0.06
  ) {
    fire(
      "wastegate",
      profile.wastegate.probability,
      profile.wastegate.cooldownMs,
      pools.wastegate,
      0.5,
    );
  }

  state.active = state.active.filter((pulse) => nowMs - pulse.startedAtMs < pulse.durationMs);

  const layers: Partial<Record<DynamicLayerId, number>> = {};
  const variants: Partial<Record<DynamicLayerId, TransientVariant>> = {};

  for (const pulse of state.active) {
    const level = pulseEnvelope(pulse, nowMs);
    if (level <= 0.001) continue;
    layers[pulse.layerId] = Math.max(layers[pulse.layerId] ?? 0, level);
    variants[pulse.layerId] = {
      id: pulse.variantId,
      intensity: pulse.peakIntensity,
      filterHz: pulse.filterHz,
      decayMs: pulse.durationMs,
    };
  }

  return { state, output: { layers, variants } };
}
