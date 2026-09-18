import type { DriveDna, DriveDnaArchetype, TimelinePoint } from "./types";

const clamp100 = (v: number) => Math.round(Math.min(100, Math.max(0, v)));

/**
 * Drive DNA - musical motion signature from energy timeline + motion shares.
 * Not a safety, skill, or aggression score.
 */
export function computeDriveDna(input: {
  energyTimeline: TimelinePoint[];
  throttleShare: number;
  regenShare: number;
  durationMs: number;
  meanSpeedMps: number;
}): DriveDna {
  const pts = input.energyTimeline;
  if (!pts.length) {
    return {
      energy: 12,
      flow: 40,
      rhythm: 20,
      variation: 15,
      regen: clamp100(input.regenShare * 100),
      archetype: "Quiet Glide",
    };
  }

  const energies = pts.map((p) => p.energy);
  const mean = energies.reduce((a, b) => a + b, 0) / energies.length;
  const peak = Math.max(...energies);
  const min = Math.min(...energies);

  let deltaSum = 0;
  let crossings = 0;
  for (let i = 1; i < energies.length; i++) {
    const d = Math.abs(energies[i]! - energies[i - 1]!);
    deltaSum += d;
    if (
      (energies[i]! > mean && energies[i - 1]! <= mean) ||
      (energies[i]! < mean && energies[i - 1]! >= mean)
    ) {
      crossings += 1;
    }
  }
  const avgDelta = deltaSum / Math.max(1, energies.length - 1);
  const durationMin = Math.max(0.5, input.durationMs / 60000);

  const energy = clamp100(mean * 55 + peak * 40);
  const flow = clamp100(100 - avgDelta * 180 + Math.min(20, input.meanSpeedMps * 2));
  const rhythm = clamp100((crossings / durationMin) * 12 + input.throttleShare * 35);
  const variation = clamp100((peak - min) * 90 + avgDelta * 120);
  const regen = clamp100(input.regenShare * 110);

  return {
    energy,
    flow,
    rhythm,
    variation,
    regen,
    archetype: pickArchetype({ energy, flow, rhythm, variation, regen }),
  };
}

function pickArchetype(d: Omit<DriveDna, "archetype">): DriveDnaArchetype {
  if (d.energy < 28 && d.flow > 55) return "Quiet Glide";
  if (d.regen > 45 && d.flow > 50) return "Smooth Builder";
  if (d.rhythm > 55 && d.energy > 45) return "Pulse Rider";
  if (d.variation > 55 && d.energy > 50) return "Dynamic Flow";
  if (d.energy > 40 && d.flow > 55 && d.variation < 45) return "Progressive Cruiser";
  if (d.rhythm > 40 && d.energy < 55) return "Night Rhythm";
  if (d.energy > 55) return "Open Pulse";
  return "Progressive Cruiser";
}
