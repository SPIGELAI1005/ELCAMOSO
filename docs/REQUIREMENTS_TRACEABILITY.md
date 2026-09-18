# Requirements traceability

Last reviewed: 2026-09-18

This matrix maps the ELCAMOSO product prompts and release requirements to implementation,
automated evidence, manual acceptance, or an external dependency. A code path is not treated as a
production pass when its required infrastructure, rights, or physical-device validation is absent.

Status meanings:

- **Implemented**: code exists and the relevant local automated gate passes.
- **Partial**: useful implementation exists, but a listed requirement or production proof remains.
- **Manual gate**: cannot be established by repository automation alone.
- **External dependency**: requires credentials, infrastructure, licensed content, or hardware not
  present in the repository.

## Journey capture, replay, remix, and songs

| Requirement                                                          | Implementation                                                                                  | Evidence / gate                                                                                         | Status                                                       |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Silent Capture and Live + Capture modes                              | `src/components/drive/DriveModePicker.tsx`, `src/lib/journey-trace/`, `src/lib/motion-capture/` | `src/lib/journey-trace/journey-trace.test.ts`, `src/lib/motion-capture/native-import.test.ts`           | Implemented                                                  |
| Privacy-safe JourneyTraceV1 with no stored route                     | `src/lib/journey-trace/types.ts`, `sampler.ts`, `repository.ts`                                 | Tests reject/inhibit lat/lon and cover visibility gaps, storage budgets, recovery                       | Implemented                                                  |
| Premium player route `/journeys/$journeyId`                          | `src/routes/journeys.$journeyId.tsx`, `src/lib/journey-trace/use-journey-player.ts`             | Route build, route smoke after browser gate; physical audio remains manual                              | Implemented                                                  |
| Header, date, duration, Motion Signature                             | Journey route and `src/components/MotionSignature.tsx`                                          | Journey tests plus UI acceptance                                                                        | Implemented                                                  |
| Replay as Engine, Symphony, World, or Fusion                         | Journey route, `remix-catalog.ts`, `replay.ts`                                                  | Journey replay tests and experience catalog tests                                                       | Implemented; Symphony production audio is externally blocked |
| Recompute demand, gear, RPM, shifts, and load per Engine profile     | `src/lib/journey-trace/replay.ts`, powertrain simulator and profile calibration                 | Different profiles produce different virtual gear/RPM; non-transmission experiences do not invent gears | Implemented                                                  |
| Stop, switch experience, and optionally preserve position            | `use-journey-player.ts`, journey route controls                                                 | Seek/restart scheduler determinism test                                                                 | Implemented                                                  |
| No new Journey when switching or remixing                            | `JourneyInterpretationV1` references the original `journeyId`                                   | Repository and replay tests                                                                             | Implemented                                                  |
| User-facing Remix; internal Journey Interpretation                   | `src/lib/journey-trace/types.ts`, journey route save UI                                         | Journey tests and repository behavior                                                                   | Implemented                                                  |
| A/B same drive and same time index                                   | `compareInterpretationsAt`, A/B UI in `use-journey-player.ts` and journey route                 | Same-trace comparison tests                                                                             | Implemented as development feature                           |
| Drive Song uses Journey Composer and is 2-3 minutes                  | `src/lib/journey/composer.ts`, `create-song.ts`, `render.ts`                                    | `src/lib/journey/journey.test.ts` duration/determinism/privacy tests                                    | Implemented                                                  |
| Replay remains real duration and is visibly distinct from Drive Song | Journey route sections and About/home copy                                                      | Manual UX review                                                                                        | Implemented                                                  |
| Drive DNA and Drive Reel                                             | `drive-dna.ts`, `summarise.ts`, journey route reel highlight                                    | Journey tests cover DNA; browser/manual review for reel                                                 | Implemented                                                  |
| Delete journey and local history                                     | Journey repository and `/journeys`                                                              | Repository delete test                                                                                  | Implemented                                                  |

## Motion Experiences platform

| Requirement                                                                  | Implementation                                                                   | Evidence / gate                                                                                        | Status              |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------- |
| Engine, Symphony, Worlds, Fusion information architecture                    | `/explore`, family cards, experience catalog and flags                           | `src/lib/experiences/catalog.test.ts`, route build                                                     | Implemented         |
| Drive Symphony energy, musical clock, semantic events, quantized arrangement | `src/lib/symphony/`                                                              | `symphony.test.ts` covers highway energy, hysteresis, quantization, event limiting, deterministic seed | Implemented         |
| Same trace and seed produce same Symphony arrangement                        | arrangement engine and interpretation seed                                       | Symphony and JourneyTrace deterministic tests                                                          | Implemented         |
| Worlds motion-responsive layers                                              | `src/lib/worlds/`, `/worlds`                                                     | Unit/build coverage; lifecycle harness covers cleanup                                                  | Implemented         |
| Fusion machine/music balance and harmonic resonance                          | `src/lib/fusion/`, `/fusion`                                                     | Unit/build coverage; lifecycle harness covers mixer/resonance disposal                                 | Implemented         |
| No leaked Web Audio nodes between interpretations                            | `src/lib/audio/testing/lifecycle-harness.ts`, disposal in Worlds/Symphony/Fusion | `src/lib/audio/audio-lifecycle.test.ts` asserts zero connections and sources after every switch        | Implemented         |
| Production music has per-asset manifests and known rights                    | `src/lib/symphony/asset-manifest.ts`, `/debug/symphony-assets`                   | `asset-manifest.test.ts` checks coverage and fail-closed rules                                         | Implemented gate    |
| Replace development synthesis with approved production stems                 | No approved WAV inventory is present                                             | Gate blocks all current `development_only` stems in production                                         | External dependency |
| Asset alignment, sample rate, peak, RMS, and license diagnostics             | asset manifest audit and debug route                                             | Manifest test accepts only complete aligned example pack                                               | Implemented         |

## Studio 2.0

| Requirement                                                | Implementation                                        | Evidence / gate                                                | Status                                               |
| ---------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| SOUND mode preserves existing Studio controls              | `/studio`, existing sound panels/runtime              | Full unit/build gates and manual Studio regression             | Implemented                                          |
| SYMPHONY six simple controls and Advanced controls         | `StudioSymphonyPanel.tsx`, `symphony-params.ts`       | `studio.test.ts`                                               | Implemented                                          |
| Instrument focus never creates silence                     | Symphony params normalization                         | Tests cover all-muted recovery and viable base arrangement     | Implemented                                          |
| Gentle, City, Highway, Energetic deterministic demo traces | `demo-traces.ts`                                      | Deterministic A/B test                                         | Implemented                                          |
| FUSION machine, music, balance, and advanced controls      | `StudioFusionPanel.tsx`, `fusion-params.ts`           | Studio tests and type/build gates                              | Implemented                                          |
| Save, name, duplicate, share Experience Preset to Garage   | Studio route, Garage route, `src/lib/studio/share.ts` | Versioned UTF-8 share round-trip and malformed payload tests   | Implemented                                          |
| Prompt description maps to parameters without telemetry    | `prompt-to-studio.ts`                                 | Deterministic keyword fallback test                            | Implemented                                          |
| Provider AI is optional and receives no drive telemetry    | Deterministic parser is current path                  | Code review/manual provider gate before any future integration | Implemented fallback; future provider is manual gate |
| Dev-only Symphony asset admin                              | `/debug/symphony-assets`                              | Build plus manifest tests                                      | Implemented                                          |

## Packaging, entitlements, pricing, and growth

| Requirement                                                                                     | Implementation                                                                 | Evidence / gate                                   | Status                                                                                 |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Audit first and preserve existing grants                                                        | additive entitlement catalog in `src/lib/entitlements/types.ts` and `plans.ts` | Plans test explicitly asserts legacy Free grants  | Implemented                                                                            |
| Free emotional loop: pairing, essential Engine, Symphony, Worlds sampler, DNA, basic song/share | capability catalog, experience access rules, pricing copy                      | Plans and capability tests                        | Implemented entitlement model; Symphony content remains externally blocked             |
| Drive+ full creative capability set                                                             | plan catalog and selectors                                                     | Drive+ includes every entitlement test            | Implemented                                                                            |
| Contextual upsell rather than constant banners                                                  | experience selection gates and premium prompts                                 | Manual UX gate                                    | Implemented                                                                            |
| Emotional pricing with transparent real price                                                   | `plan-display.ts`, `/pricing`, landing plan section                            | Billing tests and browser review                  | Implemented                                                                            |
| Experience Drops future architecture without purchases                                          | `experience_drops` capability                                                  | No individual SKU or checkout path                | Implemented architecture                                                               |
| Shared Drive Song listens without forced signup and links to creation                           | `/share/drive/$shareId`, journey share payload                                 | Share privacy tests and OG tests                  | Implemented                                                                            |
| Privacy-safe, consent-gated aggregate analytics                                                 | analytics event types and consent gate                                         | Monetization analytics tests                      | Partial: `experience_selected` is wired; remaining new product events need emit points |
| Drive Reel creation event and full product flow                                                 | Reel highlight exists                                                          | No dedicated rendered/exported reel product found | Partial                                                                                |

## Social cards, Motion Signature, and SEO

| Requirement                                                 | Implementation                                     | Evidence / gate                                                    | Status                                                             |
| ----------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Six-card family and 1200 x 630 render system                | `src/lib/og/`, static fallbacks under `public/og/` | `src/lib/og/og.test.ts` renders PNG and validates manifest         | Implemented                                                        |
| Unique deterministic Motion Signature for Drive Song        | `src/lib/motion-signature/`, OG card renderer      | Motion and OG determinism/privacy tests                            | Implemented                                                        |
| Reuse Motion Signature in Journey, artwork, Garage/share    | Journey route, component, OG render path           | Manual visual review                                               | Implemented in Journey/share; broader Garage/Reel reuse is partial |
| Canonical, sitemap, robots, structured data, noindex policy | `src/lib/seo/`, sitemap route, `public/robots.txt` | `npm run seo:check`                                                | Implemented locally                                                |
| Live SEO and OG acceptance                                  | Current live domain checked 2026-09-18             | Live `/sitemap.xml` and `/og/*` returned 404 on the old deployment | External deployment blocker                                        |

## Relay, phone pairing, and native companion

| Requirement                                                             | Implementation                                       | Evidence / gate                               | Status                                       |
| ----------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------- | -------------------------------------------- |
| QR/manual phone pairing and reconnect                                   | relay store, transport, phone/display components     | relay store, probe, remote control tests      | Implemented                                  |
| Role-bound credentials and no privilege escalation                      | role secrets and constant-time validation            | security test binds credentials to roles      | Implemented                                  |
| Reject duplicate peer and prevent rejected-peer relay                   | relay hub attachment checks and close codes          | security test verifies closure and no relay   | Implemented                                  |
| Rate limit rotating pairing codes by actor                              | relay store actor limiter                            | rotating candidate code test                  | Implemented                                  |
| Standalone production WebSocket relay                                   | `services/drive-relay/server.ts`, deployment docs    | Local automated tests                         | Implemented code; external deployment needed |
| Production relay DNS and health                                         | expected `relay.elcamoso.com`                        | DNS lookup on 2026-09-18 found no record      | External dependency                          |
| Native iOS/Android background capture and partial recovery              | Capacitor shells, motion capture import, native docs | Import/recovery unit tests                    | Implemented code                             |
| Background execution, lock screen, interruption, and real phone sensors | native road-test checklists                          | Must be verified on signed iOS/Android builds | Manual gate                                  |

## Combustion realism, Tesla, safety, and release gates

| Requirement                                                                | Implementation                               | Evidence / gate                                                                   | Status                   |
| -------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------ |
| Profile-specific virtual transmissions, load, kickdown, overrun, rev match | powertrain, realism V2, calibration fixtures | powertrain/road-feel/transmission scenario tests                                  | Implemented              |
| Tesla/browser drive and phone pairing                                      | Drive route, Tesla telemetry bridge, relay   | unit/integration tests and browser Tesla shell tests                              | Implemented code         |
| No vehicle control and parked setup guidance                               | legal/safety copy and interaction gates      | Manual copy/vehicle gate                                                          | Implemented              |
| Typecheck, lint, unit, SEO, production build                               | package scripts                              | 2026-09-18: typecheck pass; lint pass; 692 pass / 6 skipped; SEO pass; build pass | Implemented              |
| Desktop and Pixel 7 browser acceptance                                     | Playwright projects and explicit hydration readiness marker | 44 route cases pass across Chromium and Pixel 7; desktop engine switching passes after hydration | Implemented              |
| Physical Tesla browser, road noise, latency, thermal, and audio quality    | production road-test documents               | Requires vehicle, phones, cabin, and signed production endpoints                  | Manual gate              |
| Production deployment                                                      | Vercel output build                          | CLI reports `login_required`; project is not linked and no token is present       | External dependency      |
| Live current-route acceptance                                              | Read-only checks of `www.elcamoso.com`       | Old deployment returns 404 for new experience/journey/SEO/OG routes               | Blocked until deployment |

## Release decision

The repository build is locally releasable from a code-gate perspective, but the product is not a
production-complete release yet. The hard blockers are:

1. Authenticate and link Vercel, then deploy this exact build.
2. Deploy the relay service, configure shared secrets/origins, and create relay DNS.
3. Supply approved original, commissioned, or licensed Symphony stems with complete analysis.
4. Rerun live route, sitemap, OG, WebSocket, mobile, and physical Tesla acceptance.
5. Complete emit-point wiring for the remaining consent-gated product analytics.
6. Decide whether Drive Reel remains a highlight marker or becomes a rendered/exportable product.
