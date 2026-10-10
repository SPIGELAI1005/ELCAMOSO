import type { PowertrainProfile } from "@/lib/powertrain/types-config";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export interface BoostModelState {
  boost: number;
  previousLoad: number;
  releaseArmed: boolean;
  lastReleaseAtMs: number;
}

export interface BoostModelResult {
  state: BoostModelState;
  /** Normalized simulated manifold boost, 0..1. Not measured pressure. */
  boost: number;
  releaseTriggered: boolean;
}

export function createBoostModelState(): BoostModelState {
  return { boost: 0, previousLoad: 0, releaseArmed: false, lastReleaseAtMs: -60_000 };
}

export function boundedBoostConfig(cfg: NonNullable<PowertrainProfile["boost"]>) {
  const minSpoolRpm = clamp(cfg.minSpoolRpm, 500, 6000);
  return {
    minSpoolRpm,
    fullSpoolRpm: clamp(cfg.fullSpoolRpm, minSpoolRpm + 200, 10_000),
    buildupTauSec: clamp(cfg.buildupTauSec, 0.05, 3),
    releaseTauSec: clamp(cfg.releaseTauSec, 0.05, 3),
    armMinLoad: clamp01(cfg.armMinLoad),
    releaseMinBoost: clamp01(cfg.releaseMinBoost),
    releaseLoadDrop: clamp01(cfg.releaseLoadDrop),
    releaseMaxDemand: clamp01(cfg.releaseMaxDemand),
    releaseCooldownMs: clamp(cfg.releaseCooldownMs, 200, 10_000),
  };
}

export function updateBoostModel(input: {
  state: BoostModelState;
  profile: PowertrainProfile;
  rpm: number;
  engineLoad: number;
  driverDemand: number;
  dtSec: number;
  nowMs: number;
  telemetryStable: boolean;
}): BoostModelResult {
  const rawConfig = input.profile.boost;
  if (!input.profile.engine.forcedInduction || !rawConfig) {
    return { state: createBoostModelState(), boost: 0, releaseTriggered: false };
  }
  const cfg = boundedBoostConfig(rawConfig);

  const rpmWindow = clamp01(
    (input.rpm - cfg.minSpoolRpm) / Math.max(1, cfg.fullSpoolRpm - cfg.minSpoolRpm),
  );
  const load = clamp01(input.engineLoad);
  const demand = clamp01(input.driverDemand);
  const target = rpmWindow * clamp01((load - 0.16) / 0.72) * (0.55 + demand * 0.45);
  const tau = target > input.state.boost ? cfg.buildupTauSec : cfg.releaseTauSec;
  const alpha = 1 - Math.exp(-Math.max(0.001, input.dtSec) / Math.max(0.03, tau));
  const boost = clamp01(input.state.boost + (target - input.state.boost) * alpha);

  const loadDrop = input.state.previousLoad - load;
  const releaseTriggered =
    input.telemetryStable &&
    input.state.releaseArmed &&
    input.state.boost >= cfg.releaseMinBoost &&
    loadDrop >= cfg.releaseLoadDrop &&
    demand <= cfg.releaseMaxDemand &&
    input.nowMs - input.state.lastReleaseAtMs >= cfg.releaseCooldownMs;

  const releaseArmed = releaseTriggered
    ? false
    : input.state.releaseArmed ||
      (input.telemetryStable && boost >= cfg.releaseMinBoost && load >= cfg.armMinLoad);

  return {
    boost,
    releaseTriggered,
    state: {
      boost,
      previousLoad: load,
      releaseArmed,
      lastReleaseAtMs: releaseTriggered ? input.nowMs : input.state.lastReleaseAtMs,
    },
  };
}
