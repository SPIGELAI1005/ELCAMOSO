import type { SoundProfile } from "@/lib/sound/profiles";
import { listWorldPacks } from "./experience-pack";

/** Minimal SoundProfiles that select the WorldSynth backend. */
export const WORLD_SOUND_PROFILES: SoundProfile[] = listWorldPacks().map((pack) => ({
  id: pack.id,
  name: pack.name,
  category: "Future" as const,
  traits: ["World", "Motion", "Fiction"],
  description: `${pack.name} - reactive World soundscape shaped by motion.`,
  drivetrainMode: "continuous" as const,
  motionModel: "ambient" as const,
  sourceMode: "procedural" as const,
  access: "free" as const,
  voice: {
    baseFrequency: 80,
    harmonics: [1],
    waveResponse: 0.5,
    filterBase: 300,
    filterRange: 900,
    noise: 0,
    wave: "sine" as const,
    detune: 0,
    coreLevel: 0.45,
  },
}));
