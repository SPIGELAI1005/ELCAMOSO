import type { SoundProfile } from "@/lib/sound/profiles";
import { FUSION_PRESETS } from "./presets";

/** Minimal SoundProfiles that select the FusionSynth backend. */
export const FUSION_SOUND_PROFILES: SoundProfile[] = FUSION_PRESETS.map((preset) => ({
  id: preset.id,
  name: preset.name,
  category: "Musical" as const,
  traits: ["Fusion", "Machine", "Music"],
  description: preset.description,
  drivetrainMode: "continuous" as const,
  motionModel: "ambient" as const,
  sourceMode: "hybrid" as const,
  access: "free" as const,
  voice: {
    baseFrequency: 100,
    harmonics: [1],
    waveResponse: 0.5,
    filterBase: 400,
    filterRange: 800,
    noise: 0,
    wave: "sine" as const,
    detune: 0,
    coreLevel: 0.5,
  },
}));
