import type {
  IntensityLayerRule,
  MovementState,
  QuantizeGrid,
  StemGainTargets,
  StemId,
  SymphonyPack,
  SymphonySemanticEvent,
} from "./types";
import type { SemanticEventRecord } from "./events";
import type { MusicClock } from "./music-clock";
import {
  applySymphonyStudioToGains,
  fillCooldownScale,
  getRuntimeSymphonyParams,
  prefersFasterTransitions,
  type SymphonyStudioParams,
} from "@/lib/studio";

export interface ScheduledTransition {
  at: number;
  gains: StemGainTargets;
  reason: string;
}

export interface ArrangementSnapshot {
  targets: StemGainTargets;
  scheduled: ScheduledTransition | null;
}

function ruleFor(pack: SymphonyPack, state: MovementState): IntensityLayerRule | undefined {
  return pack.intensityRules.find((r) => r.movementState === state);
}

function gainsFromRule(
  rule: IntensityLayerRule | undefined,
  stems: readonly { id: StemId }[],
): StemGainTargets {
  const out: StemGainTargets = {};
  for (const s of stems) out[s.id] = 0;
  if (!rule) return out;
  for (const [id, g] of Object.entries(rule.gains)) {
    out[id] = g ?? 0;
  }
  return out;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function eventGrid(type: SymphonySemanticEvent, fast: boolean): QuantizeGrid {
  if (fast && (type === "energy_rise" || type === "cruise_enter")) return "halfBar";
  switch (type) {
    case "strong_acceleration":
    case "kickdown":
    case "upshift":
    case "downshift":
      return "beat";
    case "regen_started":
    case "lift":
    case "energy_fall":
      return "halfBar";
    case "vehicle_stopped":
      return "bar";
    default:
      return "bar";
  }
}

export interface ArrangementEngineOptions {
  profileId?: string;
  getStudioParams?: () => SymphonyStudioParams | null;
}

/**
 * Quantized arrangement: movement state → stem gains; events schedule at musical boundaries.
 */
export function createArrangementEngine(
  pack: SymphonyPack,
  clock: MusicClock,
  seed: number,
  options: ArrangementEngineOptions = {},
) {
  const rand = mulberry32(seed);
  let movement: MovementState = "stopped";
  let current: StemGainTargets = gainsFromRule(ruleFor(pack, "stopped"), pack.stems);
  let scheduled: ScheduledTransition | null = null;
  let fillBudgetUntil = 0;

  function studio(): SymphonyStudioParams | null {
    if (options.getStudioParams) return options.getStudioParams();
    if (options.profileId) return getRuntimeSymphonyParams(options.profileId);
    return null;
  }

  function shape(gains: StemGainTargets): StemGainTargets {
    const p = studio();
    return p ? applySymphonyStudioToGains(gains, p, movement) : gains;
  }

  function applyAccent(gains: StemGainTargets, type: SymphonySemanticEvent, audioTime: number) {
    const p = studio();
    const cooldown = 2.2 * (p ? fillCooldownScale(p) : 1);
    if (audioTime < fillBudgetUntil) return gains;
    const next = { ...gains };
    if (type === "upshift" || type === "downshift") {
      next["fx"] = Math.min(1, (next["fx"] ?? 0) + 0.35 + rand() * 0.2);
      next["drumsHigh"] = Math.min(1, (next["drumsHigh"] ?? 0) + 0.15);
      fillBudgetUntil = audioTime + cooldown;
    } else if (type === "strong_acceleration" || type === "kickdown") {
      next["drumsHigh"] = Math.min(1, (next["drumsHigh"] ?? 0) + 0.25);
      next["lead"] = Math.min(1, (next["lead"] ?? 0) + 0.2 * rand());
      fillBudgetUntil = audioTime + cooldown * 1.4;
    } else if (type === "regen_started" || type === "lift") {
      next["lead"] = (next["lead"] ?? 0) * 0.4;
      next["drumsHigh"] = (next["drumsHigh"] ?? 0) * 0.55;
    }
    return shape(next);
  }

  return {
    snapshot(): ArrangementSnapshot {
      return { targets: { ...current }, scheduled };
    },
    setMovementState(state: MovementState) {
      movement = state;
      current = shape(gainsFromRule(ruleFor(pack, state), pack.stems));
    },
    ingestEvents(events: SemanticEventRecord[], audioTime: number, movementState: MovementState) {
      movement = movementState;
      const p = studio();
      const fast = p ? prefersFasterTransitions(p) : false;
      const base = shape(gainsFromRule(ruleFor(pack, movementState), pack.stems));
      for (const ev of events) {
        const grid = eventGrid(ev.type, fast);
        const at = clock.nextBoundary(audioTime, grid);
        const gains = applyAccent(base, ev.type, audioTime);
        if (!scheduled || at <= scheduled.at) {
          scheduled = { at, gains, reason: ev.type };
        }
      }
      current = base;
    },
    tick(audioTime: number): StemGainTargets {
      if (scheduled && audioTime >= scheduled.at - 0.002) {
        current = scheduled.gains;
        scheduled = null;
      }
      return shape({ ...current });
    },
  };
}

export type ArrangementEngine = ReturnType<typeof createArrangementEngine>;
