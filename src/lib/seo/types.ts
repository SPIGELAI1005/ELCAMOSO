/** Central SEO types for TanStack Router `head` configuration. */

export type SeoLocale = "en" | "de" | "ro";

export type SeoRobots =
  "index, follow" | "noindex, follow" | "noindex, nofollow" | "index, nofollow";

export type SeoOgType = "website" | "article" | "product";

export interface SeoBreadcrumbItem {
  name: string;
  path: string;
}

export interface SeoInput {
  /** Document title (full string; builder does not append site name). */
  title: string;
  description: string;
  /** Path starting with `/` (no origin). */
  path: string;
  /** Relative path under site origin, e.g. `/og/elcamoso-default.png`, or absolute /api/og URL. */
  image?: string;
  imageAlt?: string;
  /** Prefer typed social card variant over static image path. */
  socialCard?: {
    variant: import("@/lib/og").OgCardVariant;
    dynamic?: boolean;
  };
  type?: SeoOgType;
  robots?: SeoRobots;
  locale?: SeoLocale;
  /** When true, emit alternate hreflang (only if locales have real URLs). */
  alternateLocales?: boolean;
  breadcrumbs?: SeoBreadcrumbItem[];
  /** Extra JSON-LD graphs (Organization etc. added by helpers). */
  structuredData?: Record<string, unknown> | Record<string, unknown>[];
  /** Override OG title (defaults to title). */
  ogTitle?: string;
  /** Override OG description (defaults to description). */
  ogDescription?: string;
}

export interface SeoRoutePolicy {
  path: string;
  indexable: boolean;
  /** Sensitive / transient → nofollow as well */
  nofollow?: boolean;
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
  breadcrumbs?: SeoBreadcrumbItem[];
  includeOrganization?: boolean;
  includeSoftwareApplication?: boolean;
}

export interface TanStackHeadConfig {
  meta: Array<Record<string, string | undefined>>;
  links: Array<Record<string, string | undefined>>;
  scripts?: Array<{ type?: string; children?: string }>;
}
