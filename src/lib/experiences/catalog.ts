import { familyForProfile } from "@/lib/sound/realism/families";
import { allProfiles, getProfile, type SoundProfile } from "@/lib/sound/profiles";
import { listFusionPresets } from "@/lib/fusion";
import { getExperienceFlags } from "./flags";
import type { ExperienceDescriptor, ExperienceFamilyMeta, ExperienceKind } from "./types";

export const EXPERIENCE_FAMILIES: readonly ExperienceFamilyMeta[] = [
  {
    kind: "engine",
    label: "Engine",
    headline: "Feel a machine.",
    subcopy: "Combustion character locked to motion.",
    href: "/sounds",
  },
  {
    kind: "symphony",
    label: "Symphony",
    headline: "Drive the music.",
    subcopy: "Your driving becomes the arrangement.",
    href: "/symphony",
  },
  {
    kind: "world",
    label: "Worlds",
    headline: "Enter another world.",
    subcopy: "Impossible places shaped by motion.",
    href: "/worlds",
  },
  {
    kind: "fusion",
    label: "Fusion",
    headline: "Blend machine and music.",
    subcopy: "Why choose one?",
    href: "/fusion",
  },
] as const;

/** Curated Worlds - premium packs use WorldSynth; others wrap SoundProfiles. */
const WORLD_CURATIONS: readonly Omit<
  ExperienceDescriptor,
  "kind" | "artworkStyle" | "previewMode" | "entitlement"
>[] = [
  {
    id: "world-space-drive",
    name: "Space Drive",
    tagline: "Reactor · Energy · Warp",
    description: "Leave the road without leaving the cabin.",
    capabilities: {
      profileId: "world-space-drive",
      selectableInDrive: true,
      requiredEntitlement: "worlds_sampler",
    },
  },
  {
    id: "world-cyber-city",
    name: "Cyber City",
    tagline: "Pulse · Neon · Digital",
    description: "Night streets and electric pulse.",
    capabilities: {
      profileId: "world-cyber-city",
      selectableInDrive: true,
      requiredEntitlement: "worlds_all",
    },
  },
  {
    id: "world-storm-run",
    name: "Storm Run",
    tagline: "Wind · Thunder · Atmosphere",
    description: "Weather as motion character.",
    capabilities: {
      profileId: "world-storm-run",
      selectableInDrive: true,
      requiredEntitlement: "worlds_all",
    },
  },
  {
    id: "world-arcade",
    name: "Arcade",
    tagline: "Retro · Reactive · Playful",
    description: "Cabinet energy for the open road.",
    capabilities: {
      profileId: "retro-arcade",
      selectableInDrive: true,
      requiredEntitlement: "worlds_all",
    },
  },
  {
    id: "world-ocean",
    name: "Ocean",
    tagline: "Waves · Air · Expansive",
    description: "Wide horizon, soft power.",
    capabilities: {
      profileId: "ocean-drive",
      selectableInDrive: true,
      requiredEntitlement: "worlds_all",
    },
  },
];

const SYMPHONY_SHELLS: readonly ExperienceDescriptor[] = [
  {
    id: "symphony-cinematic-rock",
    kind: "symphony",
    name: "Cinematic Rock",
    tagline: "Drums · Bass · Guitar · Strings",
    description: "Drive intensity opens layers of a rock arrangement.",
    artworkStyle: "score",
    entitlement: "free",
    previewMode: "playable",
    capabilities: {
      profileId: "symphony-cinematic-rock",
      stems: ["Drums", "Bass", "Guitar", "Strings"],
      selectableInDrive: true,
      requiredEntitlement: "symphony_essential",
    },
  },
  {
    id: "symphony-motion-orchestra",
    kind: "symphony",
    name: "Motion Orchestra",
    tagline: "Strings · Piano · Brass · Percussion",
    description: "Orchestral color follows how you move.",
    artworkStyle: "score",
    entitlement: "drive_plus",
    previewMode: "playable",
    capabilities: {
      profileId: "symphony-motion-orchestra",
      stems: ["Strings", "Piano", "Brass", "Percussion"],
      selectableInDrive: true,
      requiredEntitlement: "symphony_all",
    },
  },
  {
    id: "symphony-neon-run",
    kind: "symphony",
    name: "Neon Run",
    tagline: "Synths · Bass · Electronic drums",
    description: "Electronic pulse shaped by motion intent.",
    artworkStyle: "score",
    entitlement: "drive_plus",
    previewMode: "playable",
    capabilities: {
      profileId: "symphony-neon-run",
      stems: ["Synths", "Bass", "Electronic drums"],
      selectableInDrive: true,
      requiredEntitlement: "symphony_all",
    },
  },
  {
    id: "symphony-piano-flow",
    kind: "symphony",
    name: "Piano Flow",
    tagline: "Piano · Atmosphere · Minimal percussion",
    description: "Quiet lines that breathe with lift and cruise.",
    artworkStyle: "score",
    entitlement: "coming",
    previewMode: "architecture",
    capabilities: {
      stems: ["Piano", "Atmosphere", "Minimal percussion"],
      selectableInDrive: false,
    },
  },
  {
    id: "symphony-jazz-cruise",
    kind: "symphony",
    name: "Jazz Cruise",
    tagline: "Bass · Piano · Drums · Horns",
    description: "Relaxed pocket that opens when you push.",
    artworkStyle: "score",
    entitlement: "coming",
    previewMode: "architecture",
    capabilities: {
      stems: ["Bass", "Piano", "Drums", "Horns"],
      selectableInDrive: false,
    },
  },
];

function engineFromProfile(profile: SoundProfile): ExperienceDescriptor {
  return {
    id: `engine-${profile.id}`,
    kind: "engine",
    name: profile.name,
    tagline: profile.traits.slice(0, 3).join(" · "),
    description: profile.category,
    artworkStyle: "machine",
    entitlement: profile.access === "drive_plus" ? "drive_plus" : "free",
    previewMode: "playable",
    capabilities: {
      profileId: profile.id,
      selectableInDrive: true,
      requiredEntitlement:
        profile.access === "drive_plus" ? "all_sound_profiles" : "basic_sound_profiles",
    },
  };
}

function kindForProfile(profile: SoundProfile): ExperienceKind {
  const family = familyForProfile(profile);
  if (family === "physical") return "engine";
  if (family === "musical" || family === "designed" || family === "environmental") return "world";
  return "engine";
}

/** All Engine experiences = physical-family SoundProfiles. */
export function listEngineExperiences(): ExperienceDescriptor[] {
  return allProfiles()
    .filter(
      (p) =>
        !p.id.startsWith("symphony-") &&
        !p.id.startsWith("fusion-") &&
        !p.id.startsWith("world-") &&
        (kindForProfile(p) === "engine" || familyForProfile(p) === "physical"),
    )
    .map(engineFromProfile);
}

export function listWorldExperiences(): ExperienceDescriptor[] {
  const flags = getExperienceFlags();
  return WORLD_CURATIONS.map((w) => {
    const engineWorld = Boolean(w.capabilities.profileId?.startsWith("world-"));
    const playable = !engineWorld || flags.worlds;
    return {
      ...w,
      kind: "world" as const,
      artworkStyle: "horizon" as const,
      entitlement: w.capabilities.requiredEntitlement === "worlds_all" ? "drive_plus" : "free",
      previewMode: playable ? ("playable" as const) : ("architecture" as const),
      capabilities: {
        ...w.capabilities,
        selectableInDrive: playable && Boolean(w.capabilities.profileId),
      },
    };
  });
}

export function listSymphonyExperiences(): ExperienceDescriptor[] {
  const flags = getExperienceFlags();
  return SYMPHONY_SHELLS.map((s) => {
    const hasPack = Boolean(s.capabilities.profileId);
    const playable = flags.symphony && hasPack;
    return {
      ...s,
      previewMode: playable ? ("playable" as const) : ("architecture" as const),
      entitlement: s.entitlement,
      capabilities: {
        ...s.capabilities,
        selectableInDrive: playable,
      },
    };
  });
}

export function listFusionExperiences(): ExperienceDescriptor[] {
  const flags = getExperienceFlags();
  return listFusionPresets().map((p) => ({
    id: p.id,
    kind: "fusion" as const,
    name: p.name,
    tagline: p.tagline,
    description: p.description,
    artworkStyle: "blend" as const,
    entitlement: flags.fusion ? ("drive_plus" as const) : ("coming" as const),
    previewMode: flags.fusion ? ("playable" as const) : ("coming" as const),
    capabilities: {
      profileId: p.id,
      selectableInDrive: flags.fusion,
      requiredEntitlement: "fusion",
    },
  }));
}

/** @deprecated use listFusionExperiences */
export function listFusionShell(): ExperienceDescriptor {
  return (
    listFusionExperiences()[0] ?? {
      id: "fusion-machine-music",
      kind: "fusion",
      name: "Machine + Music",
      tagline: "Engine layered with Symphony",
      description: "One voice that is both machine and arrangement - single AudioContext.",
      artworkStyle: "blend",
      entitlement: "coming",
      previewMode: "coming",
      capabilities: { selectableInDrive: false },
    }
  );
}

export function getExperienceById(id: string): ExperienceDescriptor | null {
  const all = [
    ...listEngineExperiences(),
    ...listWorldExperiences(),
    ...listSymphonyExperiences(),
    ...listFusionExperiences(),
  ];
  return all.find((e) => e.id === id) ?? null;
}

/** Resolve the Experience shown for the currently selected Sound Profile. */
export function experienceForProfileId(profileId: string): ExperienceDescriptor {
  if (profileId.startsWith("fusion-")) {
    const fusion = listFusionExperiences().find((f) => f.id === profileId);
    if (fusion) return fusion;
  }
  if (profileId.startsWith("symphony-")) {
    const sym = listSymphonyExperiences().find((s) => s.capabilities.profileId === profileId);
    if (sym) return sym;
  }
  const world = listWorldExperiences().find((w) => w.capabilities.profileId === profileId);
  if (world) return world;
  if (profileId === "space-ship" || profileId === "cyber-pulse" || profileId === "storm-glider") {
    const mapped = listWorldExperiences().find((w) =>
      w.id.includes(
        profileId === "space-ship" ? "space" : profileId === "cyber-pulse" ? "cyber" : "storm",
      ),
    );
    if (mapped) return mapped;
  }
  const profile = getProfile(profileId);
  return engineFromProfile(profile);
}

export function familyMeta(kind: ExperienceKind): ExperienceFamilyMeta {
  return EXPERIENCE_FAMILIES.find((f) => f.kind === kind) ?? EXPERIENCE_FAMILIES[0]!;
}
