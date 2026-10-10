# Family classification mismatches

**Status:** Documented and deferred (2026-10-10)  
**Rule:** Runtime `familyForProfile()` in `src/lib/sound/realism/families.ts` remains authoritative for motion mapping and audio routing. Package / Markdown “Technical family” labels may differ. Do not silently realign runtime families.

## Scope

Three core Sound Profiles disagree between:

| Source | Field |
| --- | --- |
| Runtime | `FAMILY_BY_ID` via `familyForProfile()` |
| Package | `docs/sound-profiles/INDEX.md` and each profile Markdown `Technical family:` line |
| Typed specs | `AcousticProfileSpec.family` (runtime) vs `AcousticProfileSpec.packageFamily` (package intent) |

Symphony / World / Fusion IDs are out of scope for this mismatch list (catalog families already match INDEX for those composed experiences).

## Mismatch table

| Profile ID | Runtime family (`familyForProfile`) | Package INDEX / Markdown | Affects audible routing if runtime changed? | Decision |
| --- | --- | --- | --- | --- |
| `neon-drive` | `designed` | `musical` | **Yes** | Keep runtime `designed`; record package intent separately |
| `dragon` | `designed` | `environmental` | **Yes** | Keep runtime `designed`; record package intent separately |
| `thunder-beast` | `designed` | `environmental` | **Yes** | Keep runtime `designed`; record package intent separately |

## Why realignment is not metadata-only

`motionFromDrive` (`src/lib/sound/realism/motion.ts`) branches on `familyForProfile(profile)` for:

1. **Speed slow tau** — environmental/musical `0.4` vs designed `0.7` vs physical `0.55`
2. **Throttle fast tau** — physical `0.04` vs designed `0.08` vs other `0.06`
3. **RPM / fundamental path** — environmental/musical (and ambient/cadence motion models) zero virtual RPM; designed uses synthetic-load energy scaling of `engineFundamentalHz`
4. **Body level mix** — separate formulas for environmental/musical vs designed vs physical/powertrain
5. **Default pitch tau** — environmental/musical default `0.2` when no per-id override applies

Per-id pitch-tau overrides exist for these three profiles (`neon-drive` `0.16`, `dragon` / `thunder-beast` `0.32`), but they do **not** neutralize the tau, RPM, or body-level branches above.

Therefore changing `FAMILY_BY_ID` for these IDs would change motion envelopes fed into strategies and is deferred to a deliberate sound-improvement prompt with listening/regression coverage — not a schema-only pass.

## Related runtime notes (not INDEX mismatches)

- `profile-experience-config.ts` already builds `neon-drive` through the `musical(...)` helper for role/phase metadata while `familyForProfile("neon-drive")` stays `designed`. That experience-config helper does not replace motion family routing.
- `dragon` / `thunder-beast` use the `designed(...)` experience-config helper, which matches runtime family but not the package environmental label.
- UI category for all three remains **Future** in the catalog (`profiles-expansion.ts`); category chips are separate from technical family.

## Typed representation

`getAcousticProfileSpec(id)`:

- `family` — always equals `familyForProfile(id)` (routing source of truth)
- `packageFamily` — INDEX/Markdown technical family
- `familyMismatch` — present only when those differ; must never be read by synth/motion code

## Deferred work

Realign runtime families only in a future sound-improvement prompt that:

1. Updates `families.ts` deliberately
2. Re-baselines deterministic motion/audio regression for the affected IDs
3. Completes human listening (and Tesla where relevant)

Until then, package docs remain the design intent; runtime families remain the audible routing truth.
