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
    logo: absoluteSeoUrl("/icon-512.png"),
    brand: {
      "@type": "Brand",
      name: SEO_CONFIG.siteName,
    },
  };
}

export function softwareApplicationJsonLd(description: string): Record<string, unknown> {
  const origin = getSeoSiteOrigin();
  return {
    "@type": "SoftwareApplication",
    "@id": `${origin}/#software`,
    name: SEO_CONFIG.siteName,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    url: origin,
    description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
      description: "Free plan available; Drive+ optional",
      url: absoluteSeoUrl("/pricing"),
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
  return asGraph([organizationJsonLd(), softwareApplicationJsonLd(description)]);
}

export function pageStructuredData(opts: {
  breadcrumbs?: SeoBreadcrumbItem[];
  includeOrganization?: boolean;
  includeSoftwareApplication?: boolean;
  description: string;
  extra?: Record<string, unknown>[];
}): Record<string, unknown> | null {
  const graph: Record<string, unknown>[] = [];
  if (opts.includeOrganization) graph.push(organizationJsonLd());
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
