import type { StudioTweaks } from "@/lib/drive/settings";
import { DEFAULT_TWEAKS } from "@/lib/drive/settings";
import { DEFAULT_LAYER_MIX, type LayerMix } from "@/lib/sound/environments";
import { DEFAULT_PROFILE_ID } from "@/lib/sound/profiles";
import { findSoundsFromPrompt } from "@/lib/sound/find-sound";

export interface SoundRecipe {
  name: string;
  description: string;
  baseId: string;
  tweaks: StudioTweaks;
  environmentId: string;
  mix: LayerMix;
}

const CALM: SoundRecipe = {
  name: "Calmer coast",
  description: "Softer grit and a gentler bed for relaxed driving.",
  baseId: DEFAULT_PROFILE_ID,
  tweaks: { ...DEFAULT_TWEAKS, grit: 0.45, brightness: 0.75, rhythm: 0.7 },
  environmentId: "open-road",
  mix: DEFAULT_LAYER_MIX,
};

const INTENSE: SoundRecipe = {
  name: "Fuller drive",
  description: "More grit and brightness for a denser Sound Profile.",
  baseId: "racing-v10",
  tweaks: { ...DEFAULT_TWEAKS, grit: 1.4, brightness: 1.25, character: 1.2 },
  environmentId: "tunnel",
  mix: DEFAULT_LAYER_MIX,
};

export function recipeFromPrompt(prompt: string): SoundRecipe {
  const text = prompt.toLowerCase();
  const match = findSoundsFromPrompt(prompt, 1)[0];
  if (match) {
    return {
      name: prompt.slice(0, 40) || match.name,
      description: match.reason,
      baseId: match.profileId,
      tweaks: { ...DEFAULT_TWEAKS },
      environmentId: /(tunnel|night|neon)/.test(text) ? "tunnel" : "open-road",
      mix: DEFAULT_LAYER_MIX,
    };
  }
  if (/(calm|gentle|quiet|soft|relax)/.test(text))
    return { ...CALM, name: prompt.slice(0, 40) || CALM.name };
  if (/(intense|loud|race|grit|wild)/.test(text))
    return { ...INTENSE, name: prompt.slice(0, 40) || INTENSE.name };
  return {
    ...CALM,
    name: prompt.slice(0, 40) || "Studio recipe",
    description: "A starting recipe from your prompt. Preview it, then keep shaping.",
  };
}

export function nameFromTweaks(tweaks: StudioTweaks, baseName: string): string {
  if (tweaks.grit > 1.2) return `${baseName} grit`;
  if (tweaks.brightness < 0.8) return `${baseName} dusk`;
  if (tweaks.pitch < 0.85) return `${baseName} low`;
  return `${baseName} studio`;
}
