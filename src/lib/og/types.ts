/** Social card / Open Graph typed contracts. */

export type OgCardVariant =
  "brand" | "engine" | "symphony" | "world" | "fusion" | "drive-song" | "journey" | "pricing";

export interface PublicDriveDnaValues {
  energy: number;
  flow: number;
  rhythm: number;
  variation: number;
  regen: number;
}

/** Only privacy-safe fields may reach OG generation. */
export interface PublicDriveShareMetadata {
  songTitle: string;
  experienceName: string;
  driveDnaArchetype: string;
  durationCategory: string;
  publicDriveDnaValues?: PublicDriveDnaValues;
  /** Downsampled 0..1 energy samples - no GPS / route */
  energySamples?: number[];
  seed: string;
  version?: string;
}

export interface OgCardData {
  variant: OgCardVariant;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  footer?: string;
  accent?: string;
  experienceName?: string;
  driveDna?: PublicDriveDnaValues;
  archetype?: string;
  imageSeed?: string;
  /** Privacy-safe energy series for Motion Signature */
  energySamples?: number[];
  locale?: "en" | "de" | "ro";
}

export interface OgTemplateDefinition {
  variant: OgCardVariant;
  defaultEyebrow: string;
  defaultTitle: string;
  defaultSubtitle: string;
  accent: string;
  fallbackPath: string;
  alt: (data: OgCardData) => string;
}
