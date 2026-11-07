import { CINEMATIC_ROCK_PACK } from "./packs/cinematic-rock";
import { MOTION_ORCHESTRA_PACK } from "./packs/motion-orchestra";
import { NEON_RUN_PACK } from "./packs/neon-run";
import { LATINO_FIESTA_PACK } from "./packs/latino-fiesta";
import { PIANO_FLOW_PACK } from "./packs/piano-flow";
import { JAZZ_CRUISE_PACK } from "./packs/jazz-cruise";
import { VIRAL_MIX_PACK } from "./packs/viral-mix";
import type { SymphonyPack } from "./types";

const PACKS: Record<string, SymphonyPack> = {
  [CINEMATIC_ROCK_PACK.id]: CINEMATIC_ROCK_PACK,
  [MOTION_ORCHESTRA_PACK.id]: MOTION_ORCHESTRA_PACK,
  [NEON_RUN_PACK.id]: NEON_RUN_PACK,
  [LATINO_FIESTA_PACK.id]: LATINO_FIESTA_PACK,
  [PIANO_FLOW_PACK.id]: PIANO_FLOW_PACK,
  [JAZZ_CRUISE_PACK.id]: JAZZ_CRUISE_PACK,
  [VIRAL_MIX_PACK.id]: VIRAL_MIX_PACK,
  // Aliases for shorter ids
  "cinematic-rock": CINEMATIC_ROCK_PACK,
  "motion-orchestra": MOTION_ORCHESTRA_PACK,
  "neon-run": NEON_RUN_PACK,
  "viral-mix": VIRAL_MIX_PACK,
};

export function getSymphonyPack(id: string): SymphonyPack | null {
  return PACKS[id] ?? null;
}

export function listSymphonyPacks(): SymphonyPack[] {
  return [CINEMATIC_ROCK_PACK, MOTION_ORCHESTRA_PACK, NEON_RUN_PACK, LATINO_FIESTA_PACK, PIANO_FLOW_PACK, JAZZ_CRUISE_PACK, VIRAL_MIX_PACK];
}

export function isSymphonyProfileId(id: string): boolean {
  return id.startsWith("symphony-") || Boolean(PACKS[id]);
}
