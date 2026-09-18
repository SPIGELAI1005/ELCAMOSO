/**
 * Central route SEO policy - indexable marketing vs noindex app/functional pages.
 */

import { isFusionEnabled, isSymphonyEnabled, isWorldsEngineEnabled } from "@/lib/experiences/flags";
import type { SeoRoutePolicy, SeoRobots } from "./types";
import { SEO_CONFIG } from "./config";

const IMG = SEO_CONFIG.defaultImage;
const ALT = SEO_CONFIG.defaultImageAlt;

/** Public marketing + legal pages that may appear in the sitemap. */
export const INDEXABLE_ROUTE_POLICIES: SeoRoutePolicy[] = [
  {
    path: "/",
    indexable: true,
    title: SEO_CONFIG.defaultTitle,
    description: SEO_CONFIG.defaultDescription,
    image: IMG,
    imageAlt: ALT,
    includeOrganization: true,
    includeSoftwareApplication: true,
  },
  {
    path: "/explore",
    indexable: true,
    title: "Explore Motion Experiences - ELCAMOSO",
    description:
      "Choose what motion becomes - Engine, Symphony, Worlds, or Fusion. Discover motion-responsive experiences for your EV.",
    image: IMG,
    imageAlt: ALT,
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Explore", path: "/explore" },
    ],
  },
  {
    path: "/sounds",
    indexable: true,
    title: "EV Sound Profiles - ELCAMOSO",
    description:
      "Explore motion-responsive sound profiles for electric vehicles, from virtual performance engines to futuristic and cinematic sound experiences.",
    image: "/og/engine.png",
    imageAlt: "ELCAMOSO Engine sound experiences",
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Explore", path: "/explore" },
      { name: "Sounds", path: "/sounds" },
    ],
  },
  {
    path: "/symphony",
    indexable: true,
    title: "Drive Symphony - Music Shaped by Your Drive | ELCAMOSO",
    description:
      "Drive Symphony turns acceleration, cruising, braking and motion into a reactive musical arrangement that evolves with every drive.",
    image: "/og/symphony.png",
    imageAlt: "ELCAMOSO Drive Symphony",
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Explore", path: "/explore" },
      { name: "Symphony", path: "/symphony" },
    ],
  },
  {
    path: "/worlds",
    indexable: true,
    title: "ELCAMOSO Worlds - Reactive Sound Experiences",
    description:
      "Explore immersive ELCAMOSO Worlds that transform vehicle motion into cinematic, futuristic and atmospheric sound experiences.",
    image: "/og/worlds.png",
    imageAlt: "ELCAMOSO Worlds",
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Explore", path: "/explore" },
      { name: "Worlds", path: "/worlds" },
    ],
  },
  {
    path: "/fusion",
    indexable: true,
    title: "Fusion - Engine Meets Music | ELCAMOSO",
    description:
      "Blend reactive engine sound and Drive Symphony into one motion-responsive audio experience.",
    image: "/og/fusion.png",
    imageAlt: "ELCAMOSO Fusion",
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Explore", path: "/explore" },
      { name: "Fusion", path: "/fusion" },
    ],
  },
  {
    path: "/pricing",
    indexable: true,
    title: "Pricing - ELCAMOSO",
    description:
      "ELCAMOSO Free and Drive+ plans. Motion-responsive sound experiences for electric vehicles - start free, upgrade when you want more.",
    image: IMG,
    imageAlt: ALT,
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Pricing", path: "/pricing" },
    ],
  },
  {
    path: "/about",
    indexable: true,
    title: "About ELCAMOSO",
    description:
      "ELCAMOSO turns motion into sound live or after you arrive. Discover responsive EV experiences and private, silence-first journey capture.",
    image: IMG,
    imageAlt: ALT,
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "About", path: "/about" },
    ],
  },
  {
    path: "/legal",
    indexable: true,
    title: "Legal - ELCAMOSO",
    description:
      "Legal information for ELCAMOSO - Impressum, privacy, cookies, terms and accessibility.",
    image: IMG,
    imageAlt: ALT,
  },
  {
    path: "/legal/impressum",
    indexable: true,
    title: "Impressum - ELCAMOSO",
    description: "Impressum and legal disclosure for ELCAMOSO.",
    image: IMG,
    imageAlt: ALT,
  },
  {
    path: "/legal/privacy",
    indexable: true,
    title: "Privacy Policy - ELCAMOSO",
    description:
      "How ELCAMOSO handles personal data. Motion data stays on-device unless you explicitly ask for cloud.",
    image: IMG,
    imageAlt: ALT,
  },
  {
    path: "/legal/cookies",
    indexable: true,
    title: "Cookie Notice - ELCAMOSO",
    description:
      "How ELCAMOSO uses cookies and similar storage, and how you can reset consent preferences.",
    image: IMG,
    imageAlt: ALT,
  },
  {
    path: "/legal/terms",
    indexable: true,
    title: "Terms of Use - ELCAMOSO",
    description:
      "Terms of use for the ELCAMOSO web application and motion-responsive sound experiences.",
    image: IMG,
    imageAlt: ALT,
  },
  {
    path: "/legal/accessibility",
    indexable: true,
    title: "Accessibility - ELCAMOSO",
    description:
      "Accessibility statement for ELCAMOSO - how we approach usable motion-to-sound experiences on the web.",
    image: IMG,
    imageAlt: ALT,
  },
];

/** App / functional / ephemeral routes - noindex (still may have social OG). */
export const NOINDEX_ROUTE_POLICIES: SeoRoutePolicy[] = [
  {
    path: "/drive",
    indexable: false,
    title: "Drive - ELCAMOSO",
    description: "Active ELCAMOSO drive session.",
  },
  {
    path: "/demo",
    indexable: false,
    title: "Demo Drive - ELCAMOSO",
    description: "Try ELCAMOSO with pedals - no sensors required.",
  },
  {
    path: "/studio",
    indexable: false,
    title: "Studio - ELCAMOSO",
    description: "Create Sound, Symphony, and Fusion experience presets.",
  },
  {
    path: "/garage",
    indexable: false,
    title: "Garage - ELCAMOSO",
    description: "Your saved sounds and experience presets.",
  },
  {
    path: "/calibrate",
    indexable: false,
    title: "Calibrate - ELCAMOSO",
    description: "Motion calibration for ELCAMOSO.",
  },
  {
    path: "/settings",
    indexable: false,
    title: "Settings - ELCAMOSO",
    description: "ELCAMOSO settings.",
  },
  {
    path: "/onboarding",
    indexable: false,
    title: "Onboarding - ELCAMOSO",
    description: "Get started with ELCAMOSO.",
  },
  {
    path: "/replay",
    indexable: false,
    title: "Replay - ELCAMOSO",
    description: "Replay a recorded drive.",
  },
  {
    path: "/journeys",
    indexable: false,
    title: "Journeys - ELCAMOSO",
    description: "Your Drive Songs and Drive DNA.",
  },
  {
    path: "/share",
    indexable: false,
    title: "Shared sound - ELCAMOSO",
    description: "Listen to a shared ELCAMOSO Studio sound.",
    image: IMG,
    imageAlt: ALT,
  },
  {
    path: "/share/drive",
    indexable: false,
    title: "This drive made a song. | ELCAMOSO",
    description: "A Drive Song created with ELCAMOSO. No route or GPS is shared.",
    image: "/og/drive-song.png",
    imageAlt: "ELCAMOSO Drive Song",
  },
  {
    path: "/pair",
    indexable: false,
    nofollow: true,
    title: "Pair phone - ELCAMOSO",
    description: "Pair your phone while parked or let a passenger connect.",
  },
  {
    path: "/connect",
    indexable: false,
    nofollow: true,
    title: "Connect - ELCAMOSO",
    description: "Connect to an ELCAMOSO drive session.",
  },
  {
    path: "/upgrade",
    indexable: false,
    nofollow: true,
    title: "Drive+ - ELCAMOSO",
    description: "Upgrade to ELCAMOSO Drive+.",
  },
  {
    path: "/auth",
    indexable: false,
    nofollow: true,
    title: "Sign in - ELCAMOSO",
    description: "Account sign-in.",
  },
  {
    path: "/debug",
    indexable: false,
    nofollow: true,
    title: "Debug - ELCAMOSO",
    description: "Developer diagnostics.",
  },
];

export function robotsForPolicy(policy: Pick<SeoRoutePolicy, "indexable" | "nofollow">): SeoRobots {
  if (!policy.indexable) {
    return policy.nofollow ? "noindex, nofollow" : "noindex, follow";
  }
  return "index, follow";
}

/** Sitemap paths - feature-flag aware; never includes private/app routes. */
export function getSitemapPaths(): string[] {
  return INDEXABLE_ROUTE_POLICIES.filter((p) => {
    if (p.path === "/symphony" && !isSymphonyEnabled()) return false;
    if (p.path === "/fusion" && !isFusionEnabled()) return false;
    if (p.path === "/worlds" && !isWorldsEngineEnabled()) return false;
    return p.indexable;
  }).map((p) => p.path);
}

export function findRoutePolicy(path: string): SeoRoutePolicy | null {
  const normalized = path.split("?")[0] || "/";
  const exact =
    INDEXABLE_ROUTE_POLICIES.find((p) => p.path === normalized) ??
    NOINDEX_ROUTE_POLICIES.find((p) => p.path === normalized);
  if (exact) return exact;

  // Prefix match for dynamic segments
  for (const p of NOINDEX_ROUTE_POLICIES) {
    if (p.path !== "/" && normalized.startsWith(`${p.path}/`)) return p;
  }
  return null;
}

export const SITEMAP_PATH = "/sitemap.xml";
