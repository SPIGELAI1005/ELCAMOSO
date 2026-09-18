# ELCAMOSO Social Card / Open Graph System

Canonical production origin: `https://www.elcamoso.com`

## Dimensions

| Property     | Value                                     |
| ------------ | ----------------------------------------- |
| Canvas       | **1200 × 630** px                         |
| Safe zone    | 80px L/R, 64px T/B                        |
| Edge keepout | 50px (platform UI overlays)               |
| Layout       | ~62% text / ~38% motion visual            |
| Format       | PNG (`image/png` via Satori + resvg-wasm) |

Cards must remain readable at ~600×315, 400×210, and 300×158.

## Architecture

Single rendering stack — **do not add competing OG systems**:

| Piece                  | Path                                   |
| ---------------------- | -------------------------------------- |
| Types / privacy        | `src/lib/og/types.ts`                  |
| Palette / size         | `src/lib/og/palette.ts`                |
| Templates manifest     | `src/lib/og/templates.ts`              |
| Sanitize / seed        | `src/lib/og/sanitize.ts`               |
| Satori layout          | `src/lib/og/render-card.tsx`           |
| ImageResponse (server) | `src/lib/og/render.ts` (Satori → PNG)  |
| Client-safe URLs       | `src/lib/og/url.ts`                    |
| SEO wiring             | `src/lib/seo/social.ts`, `metadata.ts` |

Rendering technology: **Satori + `@resvg/resvg-wasm`** (same pipeline as `@vercel/og` / `ImageResponse`).

`@vercel/og` was evaluated but its Node ESM build fails under Vite/Nitro (`Dynamic require of "fs" is not supported`). Direct Satori + WASM resvg is the single OG renderer for this repo — no sharp, canvas, or puppeteer.

## Endpoints

| URL                                             | Purpose                               |
| ----------------------------------------------- | ------------------------------------- |
| `GET /api/og?v=<variant>`                       | Typed template card                   |
| `GET /api/og?v=...&title=&subtitle=&seed=&dna=` | Optional text overrides (clamped)     |
| `GET /api/og/drive-song/:shareId`               | Preferred Drive Song / Journey OG     |
| `GET /api/og?share=<encoded>`                   | Legacy share query (same privacy map) |

Variants: `brand` · `engine` · `symphony` · `world` · `fusion` · `drive-song` · `journey` · `pricing`

## Static fallbacks

| File                       | Variant             |
| -------------------------- | ------------------- |
| `/og/elcamoso-default.png` | brand, pricing      |
| `/og/engine.png`           | engine              |
| `/og/symphony.png`         | symphony            |
| `/og/worlds.png`           | world               |
| `/og/fusion.png`           | fusion              |
| `/og/drive-song.png`       | drive-song, journey |

On render failure the API **302** redirects to the matching static fallback. Never returns a blank/broken image body.

Regenerate static PNGs after visual changes:

```bash
npx tsx scripts/generate-og-fallbacks.ts
```

## Typography

| Role          | Size     | Style                    |
| ------------- | -------- | ------------------------ |
| Eyebrow       | ~18–22px | uppercase, wide tracking |
| Hero          | ~64–78px | Outfit Light (300)       |
| Subtitle      | ~28px    | Outfit Light             |
| Meta / footer | ~18–20px | muted                    |

**Font files (local, no runtime Google fetch):**

- `assets/fonts/Outfit-Light.ttf`
- `assets/fonts/Outfit-Regular.ttf`

License: SIL Open Font License 1.1 (Outfit via Fontsource / Google Fonts).

## Motion Signature

Central brand visual IP (beyond the O ))) mark).

| Piece        | Path                                             |
| ------------ | ------------------------------------------------ |
| Generator    | `src/lib/motion-signature/`                      |
| UI component | `src/components/MotionSignature.tsx`             |
| OG panel     | right half of social cards via `render-card.tsx` |

Deterministic flowing curves derived from:

1. share / song **seed**
2. optional downsampled **energy samples** (0..1, no GPS)

Not a waveform. Not an EQ. Same drive → same signature. Intended reuse: Journey, Drive Song artwork, Drive Reel, Garage, social cards.

Drive Song cards label the panel **MOTION SIGNATURE** and use denser ribbons.

## First-batch six-card family

Shared shell: near-black, Outfit, left accent hairline, wordmark + small O ))), right Motion Signature + mark.

| Card       | Eyebrow         | Title                             | Footer / meta          |
| ---------- | --------------- | --------------------------------- | ---------------------- |
| Brand      | ELCAMOSO        | TURN MOTION / INTO SOUND.         | —                      |
| Engine     | ENGINE          | FEEL / THE MACHINE.               | GT V8                  |
| Symphony   | DRIVE SYMPHONY  | YOUR DRIVING / BECOMES THE MUSIC. | CINEMATIC ROCK         |
| Worlds     | ELCAMOSO WORLDS | DRIVE SOMEWHERE / IMPOSSIBLE.     | SPACE DRIVE            |
| Fusion     | FUSION          | MACHINE / MEETS MUSIC.            | GT V8 × CINEMATIC ROCK |
| Drive Song | DRIVE SONG      | THIS DRIVE / MADE A SONG.         | Song title + archetype |

## Copy (approved defaults)

| Variant    | Headline                          |
| ---------- | --------------------------------- |
| Brand      | TURN MOTION / INTO SOUND.         |
| Engine     | FEEL / THE MACHINE.               |
| Symphony   | YOUR DRIVING / BECOMES THE MUSIC. |
| World      | DRIVE SOMEWHERE / IMPOSSIBLE.     |
| Fusion     | MACHINE / MEETS MUSIC.            |
| Drive Song | THIS DRIVE / MADE A SONG.         |
| Drive DNA  | YOUR MOTION / HAS A SIGNATURE.    |
| Pricing    | START FREE. / FEEL MORE.          |

## Privacy model

Dynamic share cards **must not** receive `JourneySummary` directly.

Explicit map → `PublicDriveShareMetadata`:

- `songTitle`, `experienceName`, `driveDnaArchetype`, `durationCategory`
- `publicDriveDnaValues` (0–100 ints)
- `seed`, optional `version`

Rejected / never rendered: GPS, lat/lon, polyline, route, home/work, VIN, plate.

Share pages stay `noindex, follow` while keeping full OG tags so previews work.

## Deterministic visuals

`hashSeed(variant + imageSeed)` drives ribbon amplitude, arc sweep, and accent placement. Same share → same card. No per-request randomness.

## Caching

| Mode                  | Cache-Control                                                           |
| --------------------- | ----------------------------------------------------------------------- |
| Template `/api/og?v=` | `public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`   |
| Drive Song by shareId | `public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800` |
| Static `/og/*.png`    | CDN / long-lived (immutable assets)                                     |

Share content version is encoded in the share payload identity (changing the share string changes the URL / cache key).

## SEO integration

```ts
createSeoMetadata({
  title,
  description,
  path: "/symphony",
  socialCard: { variant: "symphony" },
});
```

Resolves to:

`https://www.elcamoso.com/api/og?v=symphony`

with `og:image:alt` / `twitter:image:alt` from the template manifest.

Route mapping:

| Path               | Variant              |
| ------------------ | -------------------- |
| `/` `/explore`     | brand                |
| `/sounds`          | engine               |
| `/symphony`        | symphony             |
| `/worlds`          | world                |
| `/fusion`          | fusion               |
| `/pricing`         | pricing              |
| `/share/drive/:id` | drive-song (dynamic) |

Drive/app surfaces remain noindex; brand fallback if shared manually.

## Dev preview

`/debug/og` (DEV only) — presets for every template, open image, copy production OG URL.

## Accents

Global shell stays near-black / off-white. Family accent ≈ 5–15% of visual area (silver/amber engine, soft violet symphony, cool cyan worlds, dual fusion, seed-derived drive-song).

## Manual platform validation

After deploy, paste a public URL into:

1. [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
2. [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)
3. X / Twitter card validator (when available)
4. Discord (paste link in a channel)
5. WhatsApp / iMessage (send to self)
6. View page source — confirm absolute `https://www.elcamoso.com/...` `og:image`

## Tests

`src/lib/og/og.test.ts` — dimensions/catalog, clamp, unicode, privacy map, deterministic seed, SEO URL wiring, static file presence.

## Assets / licensing

- Generative brand geometry only (no stock photos, no OEM imagery, no album art)
- Outfit OFL fonts under `assets/fonts/`
- Static PNG fallbacks under `public/og/`
