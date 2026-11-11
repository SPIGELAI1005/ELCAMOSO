import type {
  MovementState,
  StemGainTargets,
  StemId,
  SymphonyPack,
  SymphonySpeedGate,
} from "./types";

export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x >= edge0 ? 1 : 0;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function gatedGain(gate: SymphonySpeedGate, speedKmh: number): number {
  const max = gate.maxGain ?? 1;
  return max * smoothstep(gate.inKmh, gate.fullKmh, speedKmh);
}

/**
 * Speed-aware stem gains used by packs that declare `speedGates`.
 * Movement state still matters: peak opens everything, decelerating strips
 * the marked high layers first, and energy above ~0.8 also reaches full mix.
 */
export function gainsFromSpeedGates(
  pack: SymphonyPack,
  speedKmh: number,
  movement: MovementState,
  energy = 0,
): StemGainTargets {
  const gates = pack.speedGates;
  const out: StemGainTargets = {};
  for (const stem of pack.stems) out[stem.id] = 0;
  if (!gates) return out;

  const full = movement === "peak" || energy >= 0.82;
  const decel = movement === "decelerating";

  for (const stem of pack.stems) {
    const gate = gates[stem.id];
    if (!gate) continue;
    let g = full ? (gate.maxGain ?? 1) : gatedGain(gate, speedKmh);
    if (decel && gate.stripOnDecel) g *= 0.22;
    else if (decel && g > 0) g *= 0.7;
    out[stem.id] = g;
  }

  // Keys double the mid band of the hook; fade them once the lead is in.
  if ((out.lead ?? 0) > 0.45 && (out.piano ?? 0) > 0) {
    out.piano = (out.piano ?? 0) * (1 - Math.min(1, ((out.lead ?? 0) - 0.45) / 0.55));
  }
  if (full) out.piano = Math.min(out.piano ?? 0, 0.15);
  return out;
}

export function hasSpeedGates(pack: SymphonyPack): pack is SymphonyPack & {
  speedGates: Partial<Record<StemId, SymphonySpeedGate>>;
} {
  return Boolean(pack.speedGates && Object.keys(pack.speedGates).length);
}
