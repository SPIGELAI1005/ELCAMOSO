import type { SeoBreadcrumbItem } from "./types";
import { absoluteSeoUrl, getSeoSiteOrigin, SEO_CONFIG } from "./config";

function asGraph(items: Record<string, unknown>[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": items,
  };
}

export function organizationJsonLd(): Record<string, unknown> {
  const origin = getSeoSiteOrigin();
  return {
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: SEO_CONFIG.siteName,
    url: origin,
    alternateName: ["El Camoso", "ELCAMOSO EV Sound", "elcamoso.com"],
    logo: absoluteSeoUrl("/icon-512.png"),
    sameAs: ["https://x.com/CO_FE_X"],
    brand: {
      "@type": "Brand",
      name: SEO_CONFIG.siteName,
    },
  };
}

export function websiteJsonLd(): Record<string, unknown> {
  const origin = getSeoSiteOrigin();
  return {
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    name: SEO_CONFIG.siteName,
    alternateName: ["El Camoso", "elcamoso.com"],
    url: `${origin}/`,
    inLanguage: "en",
    publisher: { "@id": `${origin}/#organization` },
  };
}

export function softwareApplicationJsonLd(description: string): Record<string, unknown> {
  const origin = getSeoSiteOrigin();
  return {
    "@type": ["SoftwareApplication", "WebApplication"],
    "@id": `${origin}/#software`,
    browserRequirements: "Modern web browser, including the Tesla in-car browser",
    publisher: { "@id": `${origin}/#organization` },
    name: SEO_CONFIG.siteName,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    url: origin,
    description,
    offers: [
      {
        "@type": "Offer",
        name: "Early access",
        price: "0",
        priceCurrency: "EUR",
        description:
          "Free with Racing V10, American Muscle V8 and GT V8. Drive+ and individual sound purchases open 2026-11-09.",
        availability: "https://schema.org/InStock",
        url: absoluteSeoUrl("/pricing"),
        validThrough: "2026-11-09",
      },
      {
        "@type": "Offer",
        name: "Drive+",
        priceCurrency: "EUR",
        description: "Drive+ and individual sound purchases open on 2026-11-09.",
        availability: "https://schema.org/PreOrder",
        availabilityStarts: "2026-11-09",
        url: absoluteSeoUrl("/pricing"),
      },
      {
        "@type": "Offer",
        name: "Drive+ Lifetime",
        price: "38.99",
        priceCurrency: "EUR",
        description: "One-time Drive+ Lifetime purchase. Opens on 2026-11-09.",
        availability: "https://schema.org/PreOrder",
        availabilityStarts: "2026-11-09",
        url: absoluteSeoUrl("/pricing"),
      },
    ],
    applicationSubCategory: "Automotive entertainment",
    audience: {
      "@type": "Audience",
      audienceType: "Electric vehicle drivers",
    },
  };
}

export function breadcrumbJsonLd(items: SeoBreadcrumbItem[]): Record<string, unknown> {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteSeoUrl(item.path),
    })),
  };
}

export function homepageStructuredData(description: string): Record<string, unknown> {
  return asGraph([organizationJsonLd(), websiteJsonLd(), softwareApplicationJsonLd(description)]);
}

export function pageStructuredData(opts: {
  breadcrumbs?: SeoBreadcrumbItem[];
  includeOrganization?: boolean;
  includeSoftwareApplication?: boolean;
  description: string;
  extra?: Record<string, unknown>[];
}): Record<string, unknown> | null {
  const graph: Record<string, unknown>[] = [];
  if (opts.includeOrganization) graph.push(organizationJsonLd(), websiteJsonLd());
  if (opts.includeSoftwareApplication) graph.push(softwareApplicationJsonLd(opts.description));
  if (opts.breadcrumbs?.length) graph.push(breadcrumbJsonLd(opts.breadcrumbs));
  if (opts.extra?.length) graph.push(...opts.extra);
  if (!graph.length) return null;
  return asGraph(graph);
}

/** Safe JSON-LD script child - never inject raw user HTML. */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
