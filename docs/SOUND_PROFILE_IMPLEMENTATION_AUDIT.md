# Sound Profile Implementation Audit

**Audit date:** 2026-09-26  
**Scope:** all 57 assembled public Sound Profile IDs  
**Reference:** `docs/sound-profiles/INDEX.md`

## Executive summary

The runtime catalog and package index agree on all 57 IDs: 47 core profiles, three Symphony profiles, three World profiles, and four Fusion profiles. All 47 core profiles have an improved-synthesis strategy. The ten composed experience profiles use their own Symphony, World, or Fusion runtime rather than the core strategy registry.

The portfolio is broad, but automated audible regression coverage is narrow: only `gt-v8` and `cyber-pulse` have direct profile scenarios. Realism V2 covers nine combustion profiles. Dynamic Drive has ten explicitly named drivetrain personalities; `farting-car` and `kazoo-kart` are marked as virtual transmissions but resolve through the generic `gt-v8` fallback. Loudness trims are explicit for the 47 core profiles, while every composed experience currently inherits the default trim of `1.00`.

The package's warning about Racing V10 and Race Car sharing Flat-Six behavior is partly stale in this worktree: both now have named, independent drivetrain configurations (`high-rev-v10` and `flat-plane-v8-track`) and independent Realism V2 acoustic configurations. They are still derived structurally from the Flat-Six base object, so tests should guard against accidental convergence.

## Legend

- **Catalog:** `core` is one of the original 22; `expansion` is one of the 25 additions; the remaining values are composed experience catalogs.
- **Backend:** `improved` means a registered profile strategy; `Symphony`, `World`, and `Fusion` are their dedicated engines.
- **DD:** Dynamic Drive compatibility. `named` has an explicit personality, `fallback` is virtual-transmission behavior resolved to GT V8, and `no` is continuous.
- **V2:** eligible for the combustion Realism V2 backend.
- **Regression:** direct deterministic PCM scenario coverage, not merely catalog/registry tests.
- **Fallback / gap:** the most important identity or routing weakness found in code.

## Portfolio map

| ID | Catalog | Family | Backend | Drivetrain personality | Trim | DD | V2 | Regression | Fallback / gap |
|---|---|---|---|---|---:|---|---|---|---|
| `gt-v8` | core | physical | improved | `gt-v8` | 1.08 | named | yes | idle/cruise/throttle/regen | baseline personality |
| `racing-v10` | core | physical | improved | `high-rev-v10` | 0.98 | named | yes | none | derived from Flat-Six base; separation untested |
| `cyber-pulse` | core | designed | improved | continuous | 1.05 | no | no | cruise | no equal-speed load/regen identity gate |
| `race-car` | core | physical | improved | `flat-plane-v8-track` | 0.98 | named | yes | none | derived from Flat-Six base; separation untested |
| `rally-car` | core | physical | improved | `rally-turbo-3` | 0.96 | named | yes | none | no audible regression |
| `space-ship` | core | designed | improved | continuous | 1.08 | no | no | none | no audible regression |
| `ufo` | core | designed | improved | continuous | 1.15 | no | no | none | no audible regression |
| `speed-boat` | core | physical | improved | continuous | 0.92 | no | no | none | regime transitions untested |
| `cruise-ship` | core | physical | improved | continuous | 1.10 | no | no | none | no audible regression |
| `santa-sleigh` | core | environmental | improved | continuous | 1.00 | no | no | none | event density/cooldown untested |
| `wild-west-carriage` | core | environmental | improved | continuous | 1.00 | no | no | none | closest-neighbor separation untested |
| `romanian-85-carriage` | core | environmental | improved | continuous | 1.02 | no | no | none | closest-neighbor separation untested |
| `laughing-machine` | core | environmental | improved | continuous | 1.05 | no | no | none | event density/cooldown untested |
| `farting-car` | core | environmental | improved | implicit `gt-v8` | 1.02 | fallback | no | none | virtual transmission inherits GT V8 |
| `steam-train` | core | physical | improved | continuous | 0.98 | no | no | none | regime transitions untested |
| `kazoo-kart` | core | environmental | improved | implicit `gt-v8` | 1.00 | fallback | no | none | virtual transmission inherits GT V8 |
| `turbine-jet` | core | physical | improved | continuous | 0.88 | no | no | none | spool transitions untested |
| `helicopter` | core | physical | improved | continuous | 0.94 | no | no | none | rotor stability untested |
| `private-jet` | core | physical | improved | continuous | 0.98 | no | no | none | closest-neighbor separation untested |
| `wiesn-tractor` | core | physical | improved | `single-cylinder-ag` | 1.00 | named | no | none | no Realism V2 acoustic recipe |
| `open-wind` | core | environmental | improved | continuous | 1.12 | no | no | none | closest-neighbor separation untested |
| `storm-glider` | core | environmental | improved | continuous | 0.98 | no | no | none | weather-state transitions untested |
| `flat-six-sport` | expansion | physical | improved | `flat-six-sport` | 1.05 | named | yes | none | closest-neighbor separation untested |
| `american-muscle-v8` | expansion | physical | improved | `american-v8` | 1.04 | named | yes | none | closest-neighbor separation untested |
| `turbo-inline-6` | expansion | physical | improved | `turbo-inline-6` | 1.04 | named | yes | none | closest-neighbor separation untested |
| `electric-hypercar` | expansion | designed | improved | `synthetic-ev` | 0.98 | named | no | none | EV trio separation untested |
| `formula-electric` | expansion | designed | improved | continuous | 0.96 | no | no | none | EV trio separation untested |
| `neon-drive` | expansion | designed | improved | continuous | 1.18 | no | no | none | family differs from package table (`musical`) |
| `maglev-train` | expansion | physical | improved | continuous | 1.08 | no | no | none | no audible regression |
| `high-speed-train` | expansion | physical | improved | continuous | 1.00 | no | no | none | no audible regression |
| `submarine` | expansion | physical | improved | continuous | 1.08 | no | no | none | no audible regression |
| `jet-ski` | expansion | physical | improved | continuous | 0.96 | no | no | none | boat-family separation untested |
| `motorcycle-superbike` | expansion | physical | improved | `motorcycle-inline-4` | 0.98 | named | yes | none | no audible regression |
| `big-twin` | expansion | physical | improved | `v-twin-cruiser` | 1.02 | named | yes | none | no audible regression |
| `snowmobile` | expansion | physical | improved | continuous | 0.96 | no | no | none | engine/CVT/track states untested |
| `tank` | expansion | physical | improved | continuous | 1.00 | no | no | none | no audible regression |
| `construction-monster` | expansion | physical | improved | continuous | 1.04 | no | no | none | no audible regression |
| `horse-gallop` | expansion | environmental | improved | continuous | 1.02 | no | no | none | gait and carriage separation untested |
| `dragon` | expansion | designed | improved | continuous | 1.00 | no | no | none | package calls it environmental |
| `thunder-beast` | expansion | designed | improved | continuous | 1.00 | no | no | none | package calls it environmental |
| `retro-arcade` | expansion | musical | improved | continuous | 0.96 | no | no | none | musical-neighbor separation untested |
| `synthwave-drive` | expansion | musical | improved | continuous | 1.00 | no | no | none | musical-neighbor separation untested |
| `deep-bass-pulse` | expansion | musical | improved | continuous | 1.16 | no | no | none | bass headroom untested |
| `zen-drive` | expansion | environmental | improved | continuous | 1.12 | no | no | none | quiet-passage acceptance untested |
| `rain-drive` | expansion | environmental | improved | continuous | 1.06 | no | no | none | weather separation untested |
| `ocean-drive` | expansion | environmental | improved | continuous | 1.10 | no | no | none | boat-family separation untested |
| `heartbeat` | expansion | musical | improved | continuous | 1.00 | no | no | none | bass/headroom acceptance untested |
| `symphony-cinematic-rock` | Symphony | musical | Symphony | continuous | 1.00* | no | no | none | default loudness; no shared portfolio renderer |
| `symphony-motion-orchestra` | Symphony | musical | Symphony | continuous | 1.00* | no | no | none | default loudness; no shared portfolio renderer |
| `symphony-neon-run` | Symphony | musical | Symphony | continuous | 1.00* | no | no | none | default loudness; no shared portfolio renderer |
| `world-space-drive` | World | designed | World | continuous | 1.00* | no | no | none | default loudness; no shared portfolio renderer |
| `world-cyber-city` | World | designed | World | continuous | 1.00* | no | no | none | default loudness; no shared portfolio renderer |
| `world-storm-run` | World | environmental | World | continuous | 1.00* | no | no | none | default loudness; no shared portfolio renderer |
| `fusion-road-anthem` | Fusion | musical | Fusion | continuous | 1.00* | no | no | none | default loudness; no shared portfolio renderer |
| `fusion-mechanical-symphony` | Fusion | musical | Fusion | continuous | 1.00* | no | no | none | default loudness; no shared portfolio renderer |
| `fusion-midnight-boost` | Fusion | musical | Fusion | continuous | 1.00* | no | no | none | default loudness; no shared portfolio renderer |
| `fusion-future-pulse` | Fusion | musical | Fusion | continuous | 1.00* | no | no | none | default loudness; no shared portfolio renderer |

`*` No explicit entry exists in `PROFILE_LOUDNESS`; `loudnessForProfile()` returns `1`.

## Comparison with the package index

The ID set matches exactly: the package table and runtime catalog both contain all 57 profiles, and each ID has an individual specification file.

Three family labels disagree with the package table. Runtime `familyForProfile()` classifies `neon-drive` as designed rather than musical, and `dragon` plus `thunder-beast` as designed rather than environmental. **2026-10-10:** documented in `docs/FAMILY_CLASSIFICATION_MISMATCHES.md` and represented on `AcousticProfileSpec` as `family` (runtime) vs `packageFamily` (INDEX). Runtime assignments are preserved because realignment is not metadata-only (motion taus / RPM / bodyLevel). Deferred to a sound-improvement prompt.

## Missing and fallback behavior

1. `resolveDrivetrain()` defaults every unrecognized or unnamed virtual-transmission profile to `gt-v8`. Today that affects `farting-car` and `kazoo-kart`, weakening both playful identities even though their improved synthesis layers are distinct.
2. Racing V10 and Race Car no longer directly reuse the Flat-Six personality ID, but their personality objects spread the Flat-Six base before overriding fields. This is a maintainability fallback, not presently an audible identity fallback; closest-neighbor regression should make the distinction durable.
3. The original synthesis path remains a broad `ProfileVoice` fallback and is intentionally available for A/B. It cannot express the stateful acceptance criteria in the package as precisely as the improved/dedicated engines.
4. `familyForProfile()` silently falls back to `physical` for unknown IDs. The typed schema should validate exhaustively instead of hiding missing registrations.
5. `getDrivetrainPersonality()` silently falls back to the first personality (`gt-v8`) for unknown IDs. Validation should surface this in development diagnostics.
6. Composed experience profiles have no explicit portfolio loudness trims and no common offline regression scenarios.
7. Optional sample banks are empty. Realism V2 therefore uses its procedural path, which is a supported fallback but has no asset-readiness distinction in the catalog.

## Dependency graph

```text
SOUND_PROFILES (57 public IDs)
|-- core + expansion (47)
|   |-- familyForProfile() ----> technical family (unknown => physical)
|   |-- getStrategy() ---------> improved DSP graph (47 registered)
|   |-- loudnessForProfile() --> explicit trim (missing => 1.00)
|   `-- drivetrainMode
|       |-- continuous --------> motion mapping only
|       `-- virtual-transmission
|           `-- resolveDrivetrain()
|               |-- explicit personality (10 profiles)
|               `-- default gt-v8 (farting-car, kazoo-kart, unknown IDs)
|                   `-- PowertrainSimulator --> Dynamic Drive layers/events
|-- Symphony (3) -------------> Symphony engine / packs
|-- World (3) ----------------> World engine / packs
`-- Fusion (4) ---------------> Fusion mixer (machine + music)

Combustion subset (9)
`-- ACOUSTIC_ENGINE_BY_PROFILE --> Realism V2 hybrid synth
    |-- optional sample bank (currently empty)
    `-- procedural worklet/formant fallback

Regression
`-- REGRESSION_SCENARIOS --> deterministic core renderer
    `-- direct coverage: gt-v8, cyber-pulse only
```

## Prioritized gaps

### P0 — foundations and lifecycle safety

1. Add the exhaustive typed acoustic schema and runtime validation described by Prompt 2; reject or visibly report unknown family, strategy, and personality registrations.
2. Add Prompt 3 diagnostics and lifecycle tests proving one `AudioContext`, bounded nodes, and clean disposal through repeated profile switches.
3. Expand the offline renderer to all compatible profiles and scenario states before further subjective tuning.

### P1 — identity correctness

1. Give `farting-car` and `kazoo-kart` dedicated virtual-mechanics personalities instead of GT V8 fallback.
2. Add closest-neighbor assertions for Racing V10/Race Car/Flat-Six and all pairs listed in `docs/sound-profiles/INDEX.md`.
3. Reconcile the three family mismatches between runtime routing and the package portfolio table.
4. Add explicit acceptance coverage for equal-speed load, regen, shifts/regimes, gait/weather hysteresis, and event cooldowns.

### P2 — calibration and release evidence

1. Measure and store profile-wide loudness/headroom references, including composed experiences.
2. Add deterministic fatigue/event-density checks and nearest-neighbor reports.
3. Track sample-bank readiness and licensing metadata independently from procedural fallback readiness.
4. Produce the 57-profile acceptance report and Tesla road-test status only after shared metrics exist.

## Baseline verification

Commands:

```text
npm run typecheck
npm test -- --run
```

The first invocation through PowerShell's `npm.ps1` was blocked by the host execution policy. Verification was rerun with `npm.cmd`; results are recorded in the implementation handoff.
