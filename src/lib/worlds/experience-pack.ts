import { SPACE_DRIVE_PACK } from "./packs/space-drive";
import { CYBER_CITY_PACK } from "./packs/cyber-city";
import { STORM_RUN_PACK } from "./packs/storm-run";
import type { WorldPack } from "./types";

const PACKS: Record<string, WorldPack> = {
  [SPACE_DRIVE_PACK.id]: SPACE_DRIVE_PACK,
  [CYBER_CITY_PACK.id]: CYBER_CITY_PACK,
  [STORM_RUN_PACK.id]: STORM_RUN_PACK,
  // Legacy SoundProfile aliases → World engine
  "space-ship": SPACE_DRIVE_PACK,
  "cyber-pulse": CYBER_CITY_PACK,
  "storm-glider": STORM_RUN_PACK,
};

export function getWorldPack(id: string): WorldPack | null {
  return PACKS[id] ?? null;
}

export function listWorldPacks(): WorldPack[] {
  return [SPACE_DRIVE_PACK, CYBER_CITY_PACK, STORM_RUN_PACK];
}

export function isWorldProfileId(id: string): boolean {
  return id.startsWith("world-") || Boolean(PACKS[id]);
}
