/**
 * Catalog of remixable experiences for Journey Player.
 */
import { SOUND_PROFILES } from "@/lib/sound/profiles";
import {
  listEngineExperiences,
  listFusionExperiences,
  listSymphonyExperiences,
  listWorldExperiences,
  type ExperienceKind,
} from "@/lib/experiences";

export interface RemixOption {
  profileId: string;
  label: string;
  kind: ExperienceKind;
}

export function listRemixOptions(kind: ExperienceKind): RemixOption[] {
  if (kind === "engine") {
    return listEngineExperiences()
      .filter((e) => {
        const id = e.capabilities.profileId;
        if (!id) return false;
        const p = SOUND_PROFILES.find((x) => x.id === id);
        return p?.drivetrainMode === "virtual-transmission";
      })
      .map((e) => ({
        profileId: e.capabilities.profileId!,
        label: e.name,
        kind: "engine" as const,
      }))
      .slice(0, 12);
  }
  if (kind === "symphony") {
    return listSymphonyExperiences()
      .filter((e) => e.capabilities.selectableInDrive && e.capabilities.profileId)
      .map((e) => ({
        profileId: e.capabilities.profileId!,
        label: e.name,
        kind: "symphony" as const,
      }));
  }
  if (kind === "world") {
    return listWorldExperiences()
      .filter((e) => e.capabilities.selectableInDrive && e.capabilities.profileId)
      .map((e) => ({
        profileId: e.capabilities.profileId!,
        label: e.name,
        kind: "world" as const,
      }));
  }
  return listFusionExperiences()
    .filter((e) => e.capabilities.profileId)
    .map((e) => ({
      profileId: e.capabilities.profileId!,
      label: e.name,
      kind: "fusion" as const,
    }));
}

export const REMIX_FAMILIES: { kind: ExperienceKind; title: string }[] = [
  { kind: "engine", title: "ENGINE" },
  { kind: "symphony", title: "SYMPHONY" },
  { kind: "world", title: "WORLD" },
  { kind: "fusion", title: "FUSION" },
];
