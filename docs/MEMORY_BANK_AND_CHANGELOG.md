# ELCAMOSO — Memory Bank & Changelog

Living document for product context, recent architecture decisions, and a dated changelog.
Canonical product rules still live in `elcamoso-comprehensive-spec.md`. Update **both** when direction or architecture changes.

**Last updated:** 2026-08-21

---

## Memory bank

### Product identity (do not drift)

| Item | Value |
|------|--------|
| Consumer name | **ELCAMOSO** (do not spell out the acronym in UI; About/docs only) |
| Expansion | ELectric CAr MOtion SOund |
| Tagline | Your EV. Your Sound. More Emotion. |
| Landing supporting line | Electric motion. More e-motion. |
| Mark | **O )))** only (no cars, lightning, exhaust, speakers, racing flags, OEM brands) |
| Wordmark | `E L C Λ M O S O` (Outfit, wide tracking) |
| UI language | Sound Profile, Drive Mode, Motion (never oscillator / LFO / VST in UI) |
| Privacy | Motion data on-device unless user explicitly opts into cloud |

### Stack

- TanStack Start + React 19 + Vite
- Router: `@tanstack/react-router` (not `react-router-dom`)
- Tailwind v4 via `src/styles.css` `@theme`
- Web Audio API only for sound
- Settings: localStorage + versioned `sanitizeSettings`
- Cloud (if any): ELCAMOSO Cloud — never say “Supabase” in user-facing copy

### Routes

`/`, `/onboarding`, `/drive`, `/demo`, `/sounds`, `/studio`, `/garage`, `/calibrate`, `/settings`, `/debug` (dev-only)

### Sound architecture (current)

- **Built-in Sound Profiles:** **47** (22 original + 25 expansion in `src/lib/sound/profiles-expansion.ts`)
- Default synthesis path: **improved** (`src/lib/sound/realism/`); original kept for A/B on `/debug`
- **UI categories** (`PROFILE_CATEGORIES`): Classic, Motorsport, Future, Nautical, Aviation, Machines, Nature, Heritage, Musical, Festive, Playful, Garage
- **Technical families** (engine, not UI chips): `physical` | `designed` | `environmental` | `musical` — see `src/lib/sound/realism/families.ts`
- Optional profile metadata: `motionModel`, `sourceMode`
- DSP primitives: `src/lib/sound/dsp/` (+ `layers-extra.ts` for expansion)
- Strategies: `strategies.ts` + `strategies-extra.ts`
- Loudness balance: `src/lib/sound/realism/loudness.ts`
- Subjective review notes: `docs/SOUND_PROFILE_REVIEW.md`
- Noise / environments / fidelity: `docs/SOUND_NOISE_AND_FIDELITY.md`
- Environments: `src/lib/sound/environments.ts` (`textureScale`; **Showroom** mutes beds/hiss)

### Session / audition pitfalls (fixed)

- `getTuning()` always returns a **new object**. Never put its result (or other fresh object identities) in a `useEffect` dependency array that calls `syncConfig` → `emit`.
- `DriveSession.syncConfig` must **fingerprint** config content and skip `emit` when unchanged.
- `useAudition` gates sync on a **serialized config key**, not object identity of `tuning` / `mix` / `snippets`.

### Landing page (`/`) conventions

- Hero: mark + wordmark (left/center). On large screens, **Electric Car Motion Sound** sits under the wordmark on the left at the Start Drive vertical band; on small screens it stays under Start Drive. Tagline + Start Drive on the right.
- Below fold: **Choose your sound** grouped by the same `PROFILE_CATEGORIES` as `/sounds` (Garage excluded), with Browse all → `/sounds`.

### Mini player / headroom

- Sticky MiniPlayer shows while session is live (hidden on `/`).
- Compact **Headroom** meter is always visible; full loudness copy remains in Audition.
- Mobile: wave-inspired hamburger (`WaveMenuIcon`) opens a right sheet; desktop keeps inline nav.
- Files: `src/components/MiniPlayer.tsx`, `src/components/HeadroomMeter.tsx`, `src/components/BrandNav.tsx`, `src/components/WaveMenuIcon.tsx`

### Branding assets

- Favicon / PWA icons: `public/icon.svg` (O ))) mark) → `favicon.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`
- User-facing cloud name: **ELCAMOSO Cloud** (not third-party brand names)

### Key files

| Area | Path |
|------|------|
| Spec | `elcamoso-comprehensive-spec.md` |
| Profiles | `src/lib/sound/profiles.ts`, `profiles-expansion.ts` |
| Realism | `src/lib/sound/realism/*` |
| Session | `src/lib/drive/session.ts` |
| Audition hook | `src/lib/drive/useAudition.ts` |
| Landing | `src/routes/index.tsx` |
| Sounds UI | `src/routes/sounds.tsx` |
| Agent notes | `AGENTS.md` |

### Open / known follow-ups

- Subjective tuning pass done for Dragon / Thunder Beast / Formula Electric / Superbike / Neon — see `docs/SOUND_PROFILE_REVIEW.md`
- Second pass done for Retro Arcade / Construction Monster / Flat-Six / Tank / American Muscle V8
- Third pass done for Synthwave / Turbo Inline-6 / Horse Gallop / Jet Ski / GT V8
- Fourth pass done for Maglev / High-Speed Train / Snowmobile / Electric Hypercar / Rain Drive
- Fifth pass done for Submarine (manual sonar) / Ocean / Deep Bass / Zen / Big Twin + Arcade phone polish
- **Noise / Showroom pass:** `textureScale` on environments; Showroom = no texture hiss; global voice.noise + wind cuts; Horse Gallop transverse gait rewrite — `docs/SOUND_NOISE_AND_FIDELITY.md`
- Sticky chrome fix: BrandNav + Sounds/Studio listen bars; Cabin EQ presets (Phone speakers / Cabin / Headphones)
- Demo Drive: PRND + pedals; `useDemoDrive` syncs profile; `DemoSoundPicker` for full catalog
- Card Preview on `/sounds` syncs session `profileId` without always writing settings; AuditionPanel still reflects selected settings profile

---

## Changelog

### 2026-08-21 (noise, Showroom, Horse Gallop)

- Added Environment **Showroom** (`textureScale: 0`): dry core voice without road/wind white-noise beds.
- Environments gained `textureScale`; Open/City/etc. beds and hiss pulled back.
- Softened engine noise gain and wind HF band; remapped high `voice.noise` across built-ins; lowered loud wind/water textures.
- Horse Gallop: research-based walk/trot/canter/gallop + flight; single-horse hooves (brown grit + thud); quieter breath.
- Docs: `docs/SOUND_NOISE_AND_FIDELITY.md`; updated `docs/SOUND_PROFILE_REVIEW.md`.

### 2026-08-21 (Demo Drive cockpit)

- Demo: matte-black pedals, P R N D strip, Park (no rev) / Neutral (rev in place) / D / R physics.
- Full Sound Profile picker on Demo; `useDemoDrive` syncs `profileId` into the live session.

### 2026-08-21 (mobile + branding)

- Mobile-ready nav: logo-inspired wave hamburger + sheet menu; BrandNav on all routes including home.
- Favicons regenerated from O ))) `public/icon.svg`.
- Replaced user-facing “ELCAMOSO Cloud” with **ELCAMOSO Cloud**; runtime error reporting renamed; AGENTS/spec/rules updated.
- Fixed stale landing: service worker was **cache-first** on `/`, so HMR/UI updates never appeared. SW is now network-first for HTML (`elcamoso-shell-v2`).
- Restored large hero mark/wordmark sizes on the start page.

### 2026-08-21

#### Sound catalog

- Added **25** built-in Sound Profiles; built-ins total **47**.
- New categories: **Machines**, **Musical**.
- Wired expansion via `EXPANSION_PROFILES` into `SOUND_PROFILES`.
- Extended families, loudness table, DSP layers, and strategy registry for all new IDs.
- Sounds UI: category chips, intensity filter, search; profiles listed per category.
- Added `docs/SOUND_PROFILE_REVIEW.md` and profile registry tests (unique IDs, count, strategies).

#### Stability

- Fixed **Maximum update depth exceeded** in `<AuditionPanel>`:
  - Cause: `getTuning()` new object each render → `useAudition` → `syncConfig` → `emit` loop.
  - Fix: content fingerprint in `syncConfig`; content-keyed effect in `useAudition`.

#### Preview UX

- MiniPlayer headroom no longer hidden on narrow viewports; compact meter always shown during live preview/drive.
- `HeadroomMeter` supports `compact` mode for the sticky player.

#### Landing

- “Choose your sound” now mirrors Sounds **category grouping** (same families/categories).
- Supporting copy: **Electric motion. More e-motion.**
- **Electric Car Motion Sound** kept under **Start Drive** (CTA column).
- Large mark / wordmark sizing retained in the brand column.

#### Docs

- Added this memory bank + changelog (`docs/MEMORY_BANK_AND_CHANGELOG.md`).

### Earlier (same initiative)

- Master realism upgrade: improved synth path, DSP primitives, motion mapping, master bus, `/debug` A/B harness.
- Family-specific models (physical / designed / environmental / musical); notable rebuilds (e.g. Turbine Jet, Speed Boat cavitation, Oide Wiesn hot-bulb).

---

## How to maintain this file

1. After a meaningful product or architecture change, add a dated section under **Changelog**.
2. Update **Memory bank** if identity, routes, stack rules, or “do not drift” conventions change.
3. Keep `elcamoso-comprehensive-spec.md` as the full product source of truth; this file is the short working memory + history.
