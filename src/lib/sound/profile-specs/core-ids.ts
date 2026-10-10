import { PUBLIC_PROFILE_IDS, type PublicProfileId } from "@/lib/sound/profile-experience-config";

/** 47 core Sound Profile IDs (excludes Symphony / World / Fusion composed experiences). */
export const CORE_SOUND_PROFILE_IDS = PUBLIC_PROFILE_IDS.slice(0, 47) as readonly PublicProfileId[];

export type CoreSoundProfileId = (typeof CORE_SOUND_PROFILE_IDS)[number];

export function isCoreSoundProfileId(id: string): id is CoreSoundProfileId {
  return (CORE_SOUND_PROFILE_IDS as readonly string[]).includes(id);
}
