import { recipeFromPrompt, type SoundRecipe } from "@/lib/sound/recipes";
import {
  DEFAULT_FUSION_PARAMS,
  DEFAULT_SYMPHONY_PARAMS,
  type ExperiencePreset,
  type FusionStudioParams,
  type StudioMode,
  type SymphonyStudioParams,
} from "./types";
import { normalizeFusionParams } from "./fusion-params";

export interface StudioPromptResult {
  mode: StudioMode;
  name: string;
  description: string;
  sound?: SoundRecipe;
  symphonyPackId?: string;
  symphonyParams?: SymphonyStudioParams;
  fusionParams?: FusionStudioParams;
}

/**
 * Deterministic keyword parse for Studio configuration.
 * Never sends drive telemetry. Not real-time generative music.
 */
export function studioPromptToParams(prompt: string): StudioPromptResult {
  const text = prompt.toLowerCase().trim();
  const wantsFusion = /(fusion|machine\s*\+|engine\s*\+|blend|layer)/.test(text);
  const wantsSymphony =
    /(symphony|cinematic|orchestra|neon|arrangement|drums|guitar|strings|rock)/.test(text) ||
    (!wantsFusion && /(music|score|melody)/.test(text));

  if (wantsFusion) {
    const fusion = normalizeFusionParams({
      ...DEFAULT_FUSION_PARAMS,
      mix: /(machine|engine)/.test(text) && !/(music|song)/.test(text) ? 0.35 : 0.62,
      machinePresence: /(present|growl|loud machine)/.test(text) ? 0.75 : 0.5,
      musicEnergy: /(explod|intense|peak)/.test(text) ? 0.8 : 0.55,
      harmonicResonance: /(reson|harmony|together)/.test(text) ? 0.45 : 0.25,
      symphonyProfileId: /(neon)/.test(text)
        ? "symphony-neon-run"
        : /(orchestra)/.test(text)
          ? "symphony-motion-orchestra"
          : "symphony-cinematic-rock",
      machineProfileId: /(flat.?six)/.test(text)
        ? "flat-six-sport"
        : /(turbo|i6)/.test(text)
          ? "turbo-inline-6"
          : /(hyper|electric)/.test(text)
            ? "electric-hypercar"
            : "gt-v8",
    });
    return {
      mode: "fusion",
      name: prompt.slice(0, 40) || "Fusion blend",
      description: "Fusion balance from your description - parameter configuration only.",
      fusionParams: fusion,
    };
  }

  if (wantsSymphony) {
    const params: SymphonyStudioParams = {
      ...DEFAULT_SYMPHONY_PARAMS,
      energy: /(explod|intense|peak|aggress)/.test(text)
        ? 0.85
        : /(calm|gentle|quiet|soft)/.test(text)
          ? 0.25
          : 0.45,
      build: /(slow build|patient)/.test(text) ? 0.25 : /(fast build|quick)/.test(text) ? 0.8 : 0.5,
      rhythm: /(driving|pulse|beat)/.test(text) ? 0.75 : /(loose|laid)/.test(text) ? 0.3 : 0.5,
      melody: /(expressive|lead|solo)/.test(text)
        ? 0.8
        : /(subtle|minimal melody)/.test(text)
          ? 0.25
          : 0.45,
      drama: /(cinematic|epic|drama)/.test(text) ? 0.85 : /(minimal)/.test(text) ? 0.2 : 0.45,
      variation: /(evolv|surpris|vari)/.test(text)
        ? 0.75
        : /(predict|steady)/.test(text)
          ? 0.25
          : 0.4,
      climaxSensitivity: /(explod|under strong|kick)/.test(text) ? 0.85 : 0.5,
      instruments: {
        atmosphere: true,
        drums: !/(no drums)/.test(text),
        bass: true,
        guitar: /(guitar|rock)/.test(text) || !/(orchestra|piano only)/.test(text),
        strings: /(string|orchestra|cinematic)/.test(text),
        lead: /(lead|explod|solo)/.test(text),
      },
    };
    // Cruise calm + accel explode
    if (/(cruise|cruising)/.test(text) && /(accel|explod|strong)/.test(text)) {
      params.energy = 0.4;
      params.build = 0.7;
      params.climaxSensitivity = 0.9;
      params.drama = 0.75;
    }
    const packId = /(neon)/.test(text)
      ? "symphony-neon-run"
      : /(orchestra)/.test(text)
        ? "symphony-motion-orchestra"
        : "symphony-cinematic-rock";
    return {
      mode: "symphony",
      name: prompt.slice(0, 40) || "Symphony arrangement",
      description: "Arrangement parameters from your description - parameter configuration only.",
      symphonyPackId: packId,
      symphonyParams: params,
    };
  }

  const sound = recipeFromPrompt(prompt);
  return {
    mode: "sound",
    name: sound.name,
    description: sound.description,
    sound,
  };
}

export function experiencePresetFromPrompt(result: StudioPromptResult): ExperiencePreset {
  const preset: ExperiencePreset = {
    id: `exp-draft-${Date.now().toString(36)}`,
    kind: result.mode,
    name: result.name,
    note: result.description,
    createdAt: Date.now(),
  };
  if (result.sound?.baseId) preset.baseProfileId = result.sound.baseId;
  if (result.symphonyPackId) preset.symphonyPackId = result.symphonyPackId;
  if (result.symphonyParams) preset.symphonyParams = result.symphonyParams;
  if (result.fusionParams) preset.fusionParams = result.fusionParams;
  return preset;
}
