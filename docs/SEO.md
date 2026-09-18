# ELCAMOSO SEO

Canonical production domain: **https://www.elcamoso.com**

| Resource   | URL                                              |
| ---------- | ------------------------------------------------ |
| Sitemap    | https://www.elcamoso.com/sitemap.xml             |
| Robots     | https://www.elcamoso.com/robots.txt              |
| Default OG | https://www.elcamoso.com/og/elcamoso-default.png |
| Dynamic OG | https://www.elcamoso.com/api/og?v=brand          |

See also: `docs/SOCIAL_CARD_SYSTEM.md`

## Architecture

Central module: `src/lib/seo/`

| File                 | Role                                          |
| -------------------- | --------------------------------------------- |
| `config.ts`          | SITE origin, defaults, preview detection      |
| `types.ts`           | Typed SEO inputs                              |
| `routes.ts`          | Indexable / noindex policy matrix             |
| `metadata.ts`        | `createSeoMetadata` / `createSeoHeadFromPath` |
| `structured-data.ts` | JSON-LD helpers                               |
| `social.ts`          | OG images + privacy-safe Drive Song cards     |
| `language.ts`        | Locale readiness (no fake hreflang)           |

Routes call `createSeoHeadFromPath("/path")` — do not hand-roll absolute URLs.

## Indexable routes

`/`, `/explore`, `/sounds`, `/symphony`, `/worlds`, `/fusion`, `/pricing`, `/about`, `/legal`, `/legal/*`

## Noindex routes

`/drive`, `/demo`, `/studio`, `/garage`, `/calibrate`, `/settings`, `/onboarding`, `/replay`, `/journeys`, `/journeys/*`, `/share`, `/share/drive/*`, `/pair`, `/pair/*`, `/connect/*`, `/upgrade/*`, `/auth/*`, `/debug/*`

Share pages remain **social-previewable** (OG/Twitter) while `noindex, follow`.

## Preview deployments

When `VERCEL_ENV=preview` (or `VITE_SEO_FORCE_NOINDEX=1`), all pages emit `noindex, nofollow`. Canonicals still point at production www — previews must not compete in search.

## Multilingual

EN / DE / RO UI dictionaries share **one URL**. Path locales (`/de`, `/ro`) are **not** live. Do not emit hreflang until main body content is translated. See `SEO_PATH_LOCALES_ENABLED` in `language.ts`.

## Structured data

Homepage: Organization + SoftwareApplication (Free offer points at `/pricing`; no invented ratings).

Marketing children: BreadcrumbList where defined.

## Hostnames

| Host                       | Behavior                           |
| -------------------------- | ---------------------------------- |
| `https://www.elcamoso.com` | Canonical                          |
| `https://elcamoso.com`     | 308 → www (Vercel + `vercel.json`) |
| `http://*`                 | 308 → https www                    |

## Search Console (manual)

1. Prefer **DNS** domain verification for `elcamoso.com` (covers www).
2. Add property `https://www.elcamoso.com` if using URL-prefix.
3. Submit sitemap: `https://www.elcamoso.com/sitemap.xml`
4. URL Inspection: `/`, `/explore`, `/sounds`, `/symphony`, `/pricing`
5. Do not commit Search Console HTML verification files if DNS works.

## Route matrix

| Route            | Index?        | Canonical | Structured data                    | OG                        |
| ---------------- | ------------- | --------- | ---------------------------------- | ------------------------- |
| `/`              | YES           | www       | Organization + SoftwareApplication | default                   |
| `/explore`       | YES           | www       | Breadcrumb                         | default                   |
| `/sounds`        | YES           | www       | Breadcrumb                         | engine                    |
| `/symphony`      | YES           | www       | Breadcrumb                         | symphony                  |
| `/worlds`        | YES           | www       | Breadcrumb                         | worlds                    |
| `/fusion`        | YES           | www       | Breadcrumb                         | fusion                    |
| `/pricing`       | YES           | www       | Breadcrumb                         | default                   |
| `/about`         | YES           | www       | Breadcrumb                         | default                   |
| `/legal/*`       | YES           | www       | —                                  | default                   |
| `/drive`         | NO            | www       | —                                  | default                   |
| `/studio`        | NO            | www       | —                                  | default                   |
| `/garage`        | NO            | www       | —                                  | default                   |
| `/share/drive/*` | NO            | www       | —                                  | drive-song (privacy-safe) |
| `/pair/*`        | NO (nofollow) | www       | —                                  | —                         |
| `/debug/*`       | NO (nofollow) | —         | —                                  | —                         |

## Validation

```bash
npm run seo:check
npm test -- src/lib/seo/seo.test.ts
```

## Future content (optional)

Only if unique prose exists: `/how-it-works`, `/ev-sound`, `/drive-symphony`. No doorway pages.
