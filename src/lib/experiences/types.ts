/**
 * Thin Experience layer above SoundProfile.
 * SoundProfiles remain the audio/runtime source of truth for Engine & Worlds.
 * Symphony / Fusion descriptors reserve Phase 2–3 musical architecture.
 */

import type { Entitlement } from "@/lib/entitlements/types";

export type ExperienceKind = "engine" | "symphony" | "world" | "fusion";

export type ExperienceEntitlement = "free" | "drive_plus" | "coming";

export type ExperiencePreviewMode = "playable" | "architecture" | "coming";

export interface ExperienceCapabilities {
  /** Backed by an existing SoundProfile id when set. */
  profileId?: string;
  /** Musical stem labels (Symphony / Fusion UI). */
  stems?: readonly string[];
  /** Whether Drive can select this as the active motion→sound mapping today. */
  selectableInDrive: boolean;
  /** Exact product capability needed to select this experience. */
  requiredEntitlement?: Entitlement;
}

export interface ExperienceDescriptor {
  id: string;
  kind: ExperienceKind;
  name: string;
  tagline: string;
  description: string;
  /** Visual accent hint for cards (kept monochrome in shell). */
  artworkStyle: "machine" | "score" | "horizon" | "blend";
  entitlement: ExperienceEntitlement;
  previewMode: ExperiencePreviewMode;
  capabilities: ExperienceCapabilities;
}

export interface ExperienceFamilyMeta {
  kind: ExperienceKind;
  /** Plural nav label when needed. */
  label: string;
  headline: string;
  subcopy: string;
  href: "/sounds" | "/symphony" | "/worlds" | "/fusion";
}
