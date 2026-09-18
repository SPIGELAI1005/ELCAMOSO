import type {
  OgCardData,
  OgCardVariant,
  OgTemplateDefinition,
  PublicDriveShareMetadata,
} from "./types";
import { OG_PALETTE } from "./palette";
import { sanitizeOgText, clampLines, hashSeed } from "./sanitize";

export const SOCIAL_CARD_TEMPLATES: Record<OgCardVariant, OgTemplateDefinition> = {
  brand: {
    variant: "brand",
    defaultEyebrow: "ELCAMOSO",
    defaultTitle: "TURN MOTION\nINTO SOUND.",
    defaultSubtitle: "",
    accent: OG_PALETTE.accents.brand,
    fallbackPath: "/og/elcamoso-default.png",
    alt: () => "ELCAMOSO - Turn Motion Into Sound",
  },
  engine: {
    variant: "engine",
    defaultEyebrow: "ENGINE",
    defaultTitle: "FEEL\nTHE MACHINE.",
    defaultSubtitle: "",
    accent: OG_PALETTE.accents.engine,
    fallbackPath: "/og/engine.png",
    alt: (d) => `${d.experienceName || "Engine"} experience - ELCAMOSO`,
  },
  symphony: {
    variant: "symphony",
    defaultEyebrow: "DRIVE SYMPHONY",
    defaultTitle: "YOUR DRIVING\nBECOMES THE MUSIC.",
    defaultSubtitle: "",
    accent: OG_PALETTE.accents.symphony,
    fallbackPath: "/og/symphony.png",
    alt: (d) =>
      d.experienceName || d.footer
        ? `${d.experienceName || d.footer} Drive Symphony - ELCAMOSO`
        : "Drive Symphony - ELCAMOSO",
  },
  world: {
    variant: "world",
    defaultEyebrow: "ELCAMOSO WORLDS",
    defaultTitle: "DRIVE SOMEWHERE\nIMPOSSIBLE.",
    defaultSubtitle: "",
    accent: OG_PALETTE.accents.world,
    fallbackPath: "/og/worlds.png",
    alt: (d) => `${d.experienceName || d.footer || "World"} - ELCAMOSO`,
  },
  fusion: {
    variant: "fusion",
    defaultEyebrow: "FUSION",
    defaultTitle: "MACHINE\nMEETS MUSIC.",
    defaultSubtitle: "",
    accent: OG_PALETTE.accents.fusion,
    fallbackPath: "/og/fusion.png",
    alt: (d) => `${d.experienceName || d.footer || "Fusion"} - ELCAMOSO`,
  },
  "drive-song": {
    variant: "drive-song",
    defaultEyebrow: "DRIVE SONG",
    defaultTitle: "THIS DRIVE\nMADE A SONG.",
    defaultSubtitle: "NIGHT MOTION",
    accent: OG_PALETTE.accents["drive-song"],
    fallbackPath: "/og/drive-song.png",
    alt: (d) =>
      d.subtitle
        ? `${d.subtitle} Drive Song created with ELCAMOSO`
        : "Drive Song created with ELCAMOSO",
  },
  journey: {
    variant: "journey",
    defaultEyebrow: "DRIVE DNA",
    defaultTitle: "YOUR MOTION\nHAS A SIGNATURE.",
    defaultSubtitle: "A musical motion signature.",
    accent: OG_PALETTE.accents.journey,
    fallbackPath: "/og/drive-song.png",
    alt: (d) => (d.archetype ? `Drive DNA ${d.archetype} - ELCAMOSO` : "Drive DNA - ELCAMOSO"),
  },
  pricing: {
    variant: "pricing",
    defaultEyebrow: "PLANS",
    defaultTitle: "START FREE.\nFEEL MORE.",
    defaultSubtitle: "Free and Drive+ for motion-responsive sound.",
    accent: OG_PALETTE.accents.pricing,
    fallbackPath: "/og/elcamoso-default.png",
    alt: () => "ELCAMOSO pricing - Free and Drive+",
  },
};

const VARIANTS = new Set<string>(Object.keys(SOCIAL_CARD_TEMPLATES));

export function isOgCardVariant(v: string): v is OgCardVariant {
  return VARIANTS.has(v);
}

export function normalizeOgCardData(
  partial: Partial<OgCardData> & { variant: OgCardVariant },
): OgCardData {
  const tpl = SOCIAL_CARD_TEMPLATES[partial.variant];
  const titleRaw = sanitizeOgText(partial.title ?? tpl.defaultTitle, 96, {
    preserveNewlines: true,
  }).replace(/\\n/g, "\n");
  const title = clampLines(titleRaw, 22, 3);
  const out: OgCardData = {
    variant: partial.variant,
    eyebrow: sanitizeOgText(partial.eyebrow ?? tpl.defaultEyebrow, 40).toUpperCase(),
    title: title || tpl.defaultTitle,
    subtitle: sanitizeOgText(partial.subtitle ?? tpl.defaultSubtitle, 80),
    footer: sanitizeOgText(partial.footer ?? "", 48),
    accent: partial.accent || tpl.accent,
    experienceName: sanitizeOgText(partial.experienceName ?? "", 48),
    archetype: sanitizeOgText(partial.archetype ?? "", 40),
    imageSeed: sanitizeOgText(partial.imageSeed ?? partial.variant, 64),
    locale: partial.locale === "de" || partial.locale === "ro" ? partial.locale : "en",
  };
  if (partial.driveDna) out.driveDna = partial.driveDna;
  if (partial.energySamples?.length) {
    out.energySamples = partial.energySamples
      .slice(0, 48)
      .map((n) => Math.max(0, Math.min(1, Number(n))))
      .filter((n) => Number.isFinite(n));
  }
  // Per-variant static footer defaults for the six-card family
  if (!out.footer) {
    if (partial.variant === "engine")
      out.footer = sanitizeOgText(partial.experienceName || "GT V8", 48);
    else if (partial.variant === "symphony")
      out.footer = sanitizeOgText(partial.experienceName || "CINEMATIC ROCK", 48);
    else if (partial.variant === "world")
      out.footer = sanitizeOgText(partial.experienceName || "SPACE DRIVE", 48);
    else if (partial.variant === "fusion")
      out.footer = sanitizeOgText(
        partial.experienceName || partial.subtitle || "GT V8 × CINEMATIC ROCK",
        48,
      );
  }
  // Marketing cards keep experience in footer only - clear redundant subtitle
  if (
    (partial.variant === "symphony" ||
      partial.variant === "world" ||
      partial.variant === "fusion" ||
      partial.variant === "engine" ||
      partial.variant === "brand") &&
    !partial.subtitle
  ) {
    out.subtitle = "";
  }
  return out;
}

/**
 * Explicit private → public mapping. Never pass JourneySummary into OG.
 */
export function toPublicDriveShareMetadata(input: {
  songTitle?: unknown;
  experienceName?: unknown;
  driveDnaArchetype?: unknown;
  durationCategory?: unknown;
  publicDriveDnaValues?: unknown;
  energySamples?: unknown;
  seed?: unknown;
  version?: unknown;
  /** Reject if present */
  latitude?: unknown;
  longitude?: unknown;
  gps?: unknown;
  route?: unknown;
}): PublicDriveShareMetadata | null {
  const blob = JSON.stringify(input);
  if (/latitude|longitude|"lat"|"lon"|gps|polyline|routePath|home|work|vin|plate/i.test(blob)) {
    return null;
  }
  const songTitle = sanitizeOgText(input.songTitle, 48);
  const experienceName = sanitizeOgText(input.experienceName, 48);
  const driveDnaArchetype = sanitizeOgText(input.driveDnaArchetype, 40);
  const durationCategory = sanitizeOgText(input.durationCategory, 24);
  const seed = sanitizeOgText(input.seed, 64) || "0";
  if (!songTitle && !experienceName) return null;

  let publicDriveDnaValues: PublicDriveShareMetadata["publicDriveDnaValues"];
  if (input.publicDriveDnaValues && typeof input.publicDriveDnaValues === "object") {
    const v = input.publicDriveDnaValues as Record<string, unknown>;
    const num = (k: string) => {
      const n = Number(v[k]);
      return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
    };
    publicDriveDnaValues = {
      energy: num("energy"),
      flow: num("flow"),
      rhythm: num("rhythm"),
      variation: num("variation"),
      regen: num("regen"),
    };
  }

  let energySamples: number[] | undefined;
  if (Array.isArray(input.energySamples)) {
    energySamples = input.energySamples
      .slice(0, 48)
      .map((n) => Math.max(0, Math.min(1, Number(n))))
      .filter((n) => Number.isFinite(n));
    if (!energySamples.length) energySamples = undefined;
  }

  const out: PublicDriveShareMetadata = {
    songTitle: songTitle || "Drive Song",
    experienceName: experienceName || "ELCAMOSO",
    driveDnaArchetype: driveDnaArchetype || "Motion signature",
    durationCategory: durationCategory || "",
    seed,
  };
  if (publicDriveDnaValues) out.publicDriveDnaValues = publicDriveDnaValues;
  if (energySamples) out.energySamples = energySamples;
  if (typeof input.version === "string") out.version = sanitizeOgText(input.version, 16);
  return out;
}

export function ogCardFromPublicShare(meta: PublicDriveShareMetadata): OgCardData {
  const partial: Partial<OgCardData> & { variant: OgCardVariant } = {
    variant: "drive-song",
    eyebrow: "DRIVE SONG",
    title: "THIS DRIVE\nMADE A SONG.",
    subtitle: meta.songTitle,
    footer: meta.experienceName,
    experienceName: meta.experienceName,
    imageSeed: meta.seed,
    archetype: meta.driveDnaArchetype,
  };
  if (meta.publicDriveDnaValues) partial.driveDna = meta.publicDriveDnaValues;
  if (meta.energySamples?.length) partial.energySamples = meta.energySamples;
  return normalizeOgCardData(partial);
}

export function ogCardFromDriveDna(meta: PublicDriveShareMetadata): OgCardData {
  const partial: Partial<OgCardData> & { variant: OgCardVariant } = {
    variant: "journey",
    eyebrow: "MY DRIVE DNA",
    title: meta.driveDnaArchetype.toUpperCase() || "YOUR MOTION\nHAS A SIGNATURE.",
    subtitle: meta.songTitle || meta.experienceName,
    footer: meta.durationCategory,
    experienceName: meta.experienceName,
    imageSeed: meta.seed,
    archetype: meta.driveDnaArchetype,
  };
  if (meta.publicDriveDnaValues) partial.driveDna = meta.publicDriveDnaValues;
  if (meta.energySamples?.length) partial.energySamples = meta.energySamples;
  return normalizeOgCardData(partial);
}

export function variantFallbackPath(variant: OgCardVariant): string {
  return SOCIAL_CARD_TEMPLATES[variant].fallbackPath;
}

export function stableSeed(variant: OgCardVariant, imageSeed?: string): number {
  return hashSeed(`${variant}:${imageSeed || "default"}`);
}
