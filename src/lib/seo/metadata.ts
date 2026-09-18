import { SEO_CONFIG, absoluteSeoUrl, getSeoSiteOrigin, isSeoPreviewDeployment } from "./config";
import { buildHreflangLinks, htmlLangForSeo } from "./language";
import { resolveOgImage } from "./social";
import { serializeJsonLd } from "./structured-data";
import { findRoutePolicy, robotsForPolicy } from "./routes";
import { pageStructuredData } from "./structured-data";
import type { SeoInput, SeoRobots, TanStackHeadConfig } from "./types";

/**
 * Build TanStack Router `head()` meta + links + JSON-LD scripts.
 * Always emits absolute canonical / og:url / og:image against production origin.
 */
export function createSeoMetadata(input: SeoInput): TanStackHeadConfig {
  const origin = getSeoSiteOrigin();
  const path = input.path.startsWith("/") ? input.path : `/${input.path}`;
  const canonical = absoluteSeoUrl(path, origin);
  const title = input.title || SEO_CONFIG.defaultTitle;
  const description = input.description || SEO_CONFIG.defaultDescription;
  const ogTitle = input.ogTitle || title;
  const ogDescription = input.ogDescription || description;
  const locale = input.locale || SEO_CONFIG.defaultLocale;
  const ogOpts: {
    path: string;
    variant?: import("@/lib/og").OgCardVariant;
    dynamic?: boolean;
    imageAlt?: string;
  } = { path };
  if (input.socialCard?.variant) ogOpts.variant = input.socialCard.variant;
  if (input.socialCard?.dynamic !== undefined) ogOpts.dynamic = input.socialCard.dynamic;
  if (input.imageAlt) ogOpts.imageAlt = input.imageAlt;
  const og = resolveOgImage(input.image, ogOpts);
  const imageAlt = input.imageAlt || og.alt;

  let robots: SeoRobots = input.robots || "index, follow";
  if (isSeoPreviewDeployment()) {
    robots = "noindex, nofollow";
  }

  const meta: TanStackHeadConfig["meta"] = [
    { title },
    { name: "description", content: description },
    { name: "robots", content: robots },
    { property: "og:title", content: ogTitle },
    { property: "og:description", content: ogDescription },
    { property: "og:type", content: input.type || "website" },
    { property: "og:url", content: canonical },
    { property: "og:image", content: og.url },
    { property: "og:image:width", content: String(og.width) },
    { property: "og:image:height", content: String(og.height) },
    { property: "og:image:alt", content: imageAlt },
    { property: "og:site_name", content: SEO_CONFIG.siteName },
    { property: "og:locale", content: locale === "en" ? "en_US" : locale },
    { name: "twitter:card", content: SEO_CONFIG.twitterCard },
    { name: "twitter:title", content: ogTitle },
    { name: "twitter:description", content: ogDescription },
    { name: "twitter:image", content: og.url },
    { name: "twitter:image:alt", content: imageAlt },
  ];

  const links: TanStackHeadConfig["links"] = [{ rel: "canonical", href: canonical }];

  if (input.alternateLocales) {
    for (const alt of buildHreflangLinks(path)) {
      links.push({ rel: "alternate", hrefLang: alt.hreflang, href: alt.href });
    }
  }

  const scripts: NonNullable<TanStackHeadConfig["scripts"]> = [];
  if (input.structuredData) {
    const payload = Array.isArray(input.structuredData)
      ? { "@context": "https://schema.org", "@graph": input.structuredData }
      : input.structuredData;
    scripts.push({
      type: "application/ld+json",
      children: serializeJsonLd(payload),
    });
  }

  return { meta, links, ...(scripts.length ? { scripts } : {}) };
}

/** Convenience: build head from central route policy. */
export function createSeoHeadFromPath(
  path: string,
  overrides?: Partial<SeoInput>,
): TanStackHeadConfig {
  const policy = findRoutePolicy(path);
  if (!policy) {
    return createSeoMetadata({
      title: SEO_CONFIG.defaultTitle,
      description: SEO_CONFIG.defaultDescription,
      path,
      robots: "noindex, follow",
      ...overrides,
    });
  }

  const structured = pageStructuredData({
    description: overrides?.description || policy.description,
    includeOrganization: Boolean(policy.includeOrganization),
    includeSoftwareApplication: Boolean(policy.includeSoftwareApplication),
    ...(policy.breadcrumbs ? { breadcrumbs: policy.breadcrumbs } : {}),
  });

  const input: SeoInput = {
    title: policy.title,
    description: policy.description,
    path: policy.path,
    robots: robotsForPolicy(policy),
  };
  if (policy.image) input.image = policy.image;
  if (policy.imageAlt) input.imageAlt = policy.imageAlt;
  if (policy.breadcrumbs) input.breadcrumbs = policy.breadcrumbs;
  if (structured) input.structuredData = structured;
  const PATH_VARIANT: Record<string, import("@/lib/og").OgCardVariant> = {
    "/": "brand",
    "/explore": "brand",
    "/sounds": "engine",
    "/symphony": "symphony",
    "/worlds": "world",
    "/fusion": "fusion",
    "/pricing": "pricing",
  };
  const socialVariant = overrides?.socialCard?.variant || PATH_VARIANT[policy.path];
  if (socialVariant && !overrides?.image) {
    input.socialCard = { variant: socialVariant };
  }
  return createSeoMetadata({ ...input, ...overrides });
}

export function seoHtmlLang(): string {
  return htmlLangForSeo(SEO_CONFIG.defaultLocale);
}

export type { TanStackHeadConfig };
