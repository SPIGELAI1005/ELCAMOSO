import { CINEMATIC_ROCK_PACK } from "./packs/cinematic-rock";
import { MOTION_ORCHESTRA_PACK } from "./packs/motion-orchestra";
import { NEON_RUN_PACK } from "./packs/neon-run";
import type { SymphonyPack } from "./types";

const PACKS: Record<string, SymphonyPack> = {
  [CINEMATIC_ROCK_PACK.id]: CINEMATIC_ROCK_PACK,
  [MOTION_ORCHESTRA_PACK.id]: MOTION_ORCHESTRA_PACK,
  [NEON_RUN_PACK.id]: NEON_RUN_PACK,
  // Aliases for shorter ids
  "cinematic-rock": CINEMATIC_ROCK_PACK,
  "motion-orchestra": MOTION_ORCHESTRA_PACK,
  "neon-run": NEON_RUN_PACK,
};

export function getSymphonyPack(id: string): SymphonyPack | null {
  return PACKS[id] ?? null;
}

export function listSymphonyPacks(): SymphonyPack[] {
  return [CINEMATIC_ROCK_PACK, MOTION_ORCHESTRA_PACK, NEON_RUN_PACK];
}

export function isSymphonyProfileId(id: string): boolean {
  return id.startsWith("symphony-") || Boolean(PACKS[id]);
}
