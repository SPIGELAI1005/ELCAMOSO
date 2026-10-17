# ELCAMOSO SEO

Canonical production domain: **https://www.elcamoso.com**

| Resource   | URL                                              |
| ---------- | ------------------------------------------------ |
| Sitemap    | https://www.elcamoso.com/sitemap.xml             |
| Robots     | https://www.elcamoso.com/robots.txt              |
| Default OG | https://www.elcamoso.com/og/elcamoso-default.png |
| Dynamic OG | https://www.elcamoso.com/api/og?v=brand          |

See also: `docs/SOCIAL_CARD_SYSTEM.md`

## Concept (source of truth)

ELCAMOSO SEO exists to make the product discoverable for EV drivers who want emotion from motion, without turning marketing pages into a fake-engine toy catalog.

### Positioning phrases (use in titles / descriptions)

1. **Turn motion into sound.** (primary proposition)
2. **Your EV. Your Sound. More Emotion.** (tagline)
3. **Hear it now. Or hear it later.** (live vs Silent Capture)

### Experience vocabulary (indexable copy)

Use product language only: **Experience**, **Engine**, **Symphony**, **World**, **Fusion**, **Sound Profile**, **Drive Mode**, **Motion**.

Do not use lab jargon in titles or meta (oscillator, LFO, VST, gain routing).

The acronym expansion (ELectric CAr MOtion SOund) may appear in About/docs only, not in SERP titles.

### Keyword posture

- Lead with brand + motion-to-sound benefit.
- EV / electric vehicle is core discovery language.
- Tesla may appear as a secondary discovery term in meta copy (drivers search it). Never put OEM marks, logos, or car chrome in OG art or the product mark (**O )))** only).
- Prefer unique page intent: home (brand), explore (chooser), sounds (Engine profiles), symphony / worlds / fusion (family), pricing (access), story / science (trust).

### Index vs noindex

| Intent | Routes | Robots |
| ------ | ------ | ------ |
| Marketing / legal | `/`, `/explore`, `/sounds`, `/symphony`, `/worlds`, `/fusion`, `/pricing`, `/credits`, `/story`, `/science`, `/legal/*` | `index, follow` + sitemap |
| App / session / private | `/drive`, `/demo`, `/studio`, `/garage`, `/calibrate`, `/settings`, `/onboarding`, `/replay`, `/journeys`, `/share*`, `/pair*`, `/connect*`, `/upgrade*`, `/auth*`, `/debug*`, `/admin`, `/recorder` | `noindex` (nofollow on auth/debug/pair/connect/upgrade) |

Share URLs stay **social-previewable** (OG/Twitter) while `noindex, follow`.

### Image SEO

| Asset | Spec | Role |
| ----- | ---- | ---- |
| `/og/*.png` | 1200×630 | Static OG/Twitter fallbacks (brand, engine, symphony, worlds, fusion, drive-song) |
| `/api/og?v=*` | Dynamic Satori cards | Preferred `og:image` when available |
| `/hero/sound-profiles/{id}.png` | 1672×941, no-branding stills | Landing + Drive backdrops; **not** used as OG by default |
| Icons / PWA | `/icon-512.png`, manifest | Organization `logo` + install |

Rules:

- Every indexable route emits absolute `og:image`, width, height, and alt.
- Hero slideshow alts name the sound experience (profile id → readable label).
- No painted-out branding bars on hero stills (source: `Images cars_elcamoso/Cars No Branding`).
- Drive Song cards must never include GPS, route, VIN, or identity.

### On-page content checklist

- One clear H1 per marketing page (brand or page intent). Home H1 stays the tagline.
- Descriptions ~120–160 characters, unique per route, no duplicate boilerplate.
- Canonical always `https://www.elcamoso.com{path}` (never preview hosts).
- Preview / `VITE_SEO_FORCE_NOINDEX=1` → global `noindex, nofollow`.
- No fake `lastmod` in sitemap. No doorway pages.

### Multilingual

EN / DE / RO UI dictionaries share **one URL**. Path locales (`/de`, `/ro`) are **not** live. Do not emit hreflang until main body content is translated. See `SEO_PATH_LOCALES_ENABLED` in `language.ts`.

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
| `/`              | YES           | www       | Organization + SoftwareApplication | brand                     |
| `/explore`       | YES           | www       | Breadcrumb                         | brand                     |
| `/sounds`        | YES           | www       | Breadcrumb                         | engine                    |
| `/symphony`      | YES           | www       | Breadcrumb                         | symphony                  |
| `/worlds`        | YES           | www       | Breadcrumb                         | worlds                    |
| `/fusion`        | YES           | www       | Breadcrumb                         | fusion                    |
| `/pricing`       | YES           | www       | Breadcrumb                         | pricing                   |
| `/credits`       | YES           | www       | Breadcrumb                         | brand                     |
| `/story`         | YES           | www       | Breadcrumb                         | brand                     |
| `/science`       | YES           | www       | Breadcrumb                         | brand                     |
| `/about`         | NO (redirect) | www       | → `/story`                         | -                         |
| `/legal/*`       | YES           | www       | —                                  | brand                     |
| `/drive`         | NO            | www       | —                                  | brand                     |
| `/demo`          | NO            | www       | —                                  | brand                     |
| `/studio`        | NO            | www       | —                                  | brand                     |
| `/garage`        | NO            | www       | —                                  | brand                     |
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
