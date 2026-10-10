# Audio artifacts and documentation — git tracking status

**Audit date:** 2026-10-10  
**Branch:** `main` (tracking `origin/main`)  
**Purpose:** Before treating upgrade evidence as remote-canonical, record what exists only in the local worktree versus what is already committed.

## Summary

| Category | On disk locally | Committed on `main` | Safe to treat as remote-canonical? |
| --- | --- | --- | --- |
| Core Realism V2 / diagnostics / powertrain code | Yes | **Yes** (published history) | Yes |
| Offline portfolio + comparison WAVs | Yes (`artifacts/`) | **No** (untracked) | **No** until committed or published elsewhere |
| `docs/audio/*` (matrix, validation) | Yes | **No** (untracked) | **No** until committed |
| Muscle pilot manifest + handbook | Yes | **No** (untracked) | **No** until committed |
| `profile-experience-config` + `profile-specs` + `validation/` | Yes | **No** (untracked) | **No** until committed |
| Modified Realism V2 sources (worktree diffs) | Yes | Base committed; **local modifications** | Treat published base as canonical; review local diffs before push |

`artifacts/` is **not** listed in `.gitignore`. Absence from git is untracked content, not an ignore rule.

## Committed (remote-canonical baseline)

These paths are already in the published tree (representative; not exhaustive):

- `src/lib/diagnostics/*` — Drive diagnostics types, collector, export
- `src/components/DriveDiagnosticsPanel.tsx`, Tesla road-test HUD
- `src/lib/powertrain/*` — Road Feel / Powertrain V2–V3
- `src/lib/sound/realism/v2/acoustic-engine.ts`, `hybrid-combustion-synth.ts`, `sample-bank.ts`, `combustion-excitation.ts` (committed base; see local mods below)
- `docs/AUDIO_REALISM_V2.md`, `docs/drive-diagnostics.md`, `docs/POWERTRAIN_CALIBRATION_V2.md`, `docs/DYNAMIC_DRIVE_ARCHITECTURE.md`
- `public/audio/combustion-processor.js` (worklet; no combustion WAV banks under `public/`)

## Local-only (untracked) — do not claim as published

### Documentation

| Path | Role |
| --- | --- |
| `docs/audio/profile-upgrade-matrix.md` | 57-profile upgrade matrix |
| `docs/audio/driving-experience-validation.md` | Offline pass + listening checklist |
| `docs/AMERICAN_V8_HYBRID_PILOT.md` | Pilot status + required recordings |
| `docs/SOUND_PROFILE_IMPLEMENTATION_AUDIT.md` | Prompt-1 style portfolio map |
| `docs/FAMILY_CLASSIFICATION_MISMATCHES.md` | neon-drive / dragon / thunder-beast deferral |
| `docs/audio/ARTIFACTS_AND_TRACKING.md` | This file |
| `docs/audio/LISTENING_AND_ASSET_STATUS.md` | Asset fork + listening honesty |

### Code

| Path | Role |
| --- | --- |
| `src/lib/sound/profile-experience-config.ts` (+ test) | Typed phase/role/status config for 57 IDs |
| `src/lib/sound/profile-specs/**` | `AcousticProfileSpec` / `getAcousticProfileSpec` |
| `src/lib/sound/validation/**` | Offline comparison harness |
| `src/lib/sound/realism/v2/american-v8-pilot-manifest.ts` | Empty readiness slots (no approved assets) |

### Artifacts (local disk counts as of audit)

| Directory | File count (approx) | Contents |
| --- | --- | --- |
| `artifacts/audio-portfolio/2026-09-26/` | 58 | 57× `*-tuned-untouched.wav` + `analysis.json` |
| `artifacts/audio-comparisons/2026-09-26/` | 46 | 11 profiles × 4 WAVs + `analysis.json` + README |

Meters in those `analysis.json` files are approximate sample peak / RMS / integrated loudness — **not** true peak or certified LUFS.

## Locally modified (committed base + uncommitted edits)

These Realism V2 files show as modified relative to `HEAD`:

- `src/lib/sound/realism/v2/acoustic-engine.ts`
- `src/lib/sound/realism/v2/combustion-excitation.ts`
- `src/lib/sound/realism/v2/hybrid-combustion-synth.ts`
- `src/lib/sound/realism/v2/hybrid-combustion.test.ts`
- `src/lib/sound/realism/v2/index.ts`
- `src/lib/sound/realism/v2/sample-bank.ts` (imports untracked pilot manifest)

Do not describe the uncommitted delta as already shipped on `origin/main`.

## Implications for workstreams 1–10

1. **Engineering on the remote branch** already includes diagnostics, drivetrain, Realism V2 procedural path, and empty sample-bank schema.
2. **Evidence pack** (matrix, validation write-up, comparison WAVs, pilot handbook, AcousticProfileSpec) is **worktree-complete but not remote-canonical** until a deliberate commit/push (out of scope unless requested).
3. Reviewers syncing only `origin/main` will **not** see `docs/audio/` or `artifacts/` until those land.

## Recommended publish set (when the user asks to commit)

Commit documentation + typed config + pilot manifest + validation harness together. Decide separately whether large WAVs under `artifacts/` belong in git, Git LFS, or an external evidence store — do not silently omit the tracking fact.
