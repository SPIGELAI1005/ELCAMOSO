import type { Entitlement, Plan } from "./types";
import { entitlementsForPlan } from "./plans";

export interface ProductCapabilityDefinition {
  id: Entitlement;
  label: string;
  category: "engine" | "symphony" | "worlds" | "fusion" | "journey" | "studio" | "platform";
}

export const PRODUCT_CAPABILITIES: readonly ProductCapabilityDefinition[] = [
  { id: "basic_sound_profiles", label: "Essential Engine profiles", category: "engine" },
  { id: "all_sound_profiles", label: "All Engine profiles", category: "engine" },
  { id: "symphony_essential", label: "Essential Symphony", category: "symphony" },
  { id: "symphony_all", label: "All Symphony packs", category: "symphony" },
  { id: "worlds_sampler", label: "Worlds sampler", category: "worlds" },
  { id: "worlds_all", label: "All Worlds", category: "worlds" },
  { id: "fusion", label: "Fusion", category: "fusion" },
  { id: "drive_dna", label: "Drive DNA", category: "journey" },
  { id: "drive_song_basic", label: "Basic Drive Song", category: "journey" },
  { id: "drive_song_full", label: "Full Drive Songs", category: "journey" },
  { id: "drive_reel", label: "Drive Reel", category: "journey" },
  { id: "journey_history_local", label: "Local Journey history", category: "journey" },
  { id: "journey_history_full", label: "Full Journey history", category: "journey" },
  { id: "journey_remix", label: "Multiple Journey remixes", category: "journey" },
  { id: "basic_share", label: "Basic share pages", category: "platform" },
  { id: "studio_sound", label: "Sound Studio", category: "studio" },
  { id: "studio_symphony", label: "Symphony Studio", category: "studio" },
  { id: "studio_fusion", label: "Fusion Studio", category: "studio" },
  { id: "premium_presets", label: "Premium presets", category: "studio" },
  { id: "experience_drops", label: "Experience Drops", category: "platform" },
] as const;

export function planHasCapability(plan: Plan, capability: Entitlement): boolean {
  return entitlementsForPlan(plan).includes(capability);
}

export function capabilitiesForPlan(plan: Plan): readonly ProductCapabilityDefinition[] {
  const grants = new Set(entitlementsForPlan(plan));
  return PRODUCT_CAPABILITIES.filter((capability) => grants.has(capability.id));
}
