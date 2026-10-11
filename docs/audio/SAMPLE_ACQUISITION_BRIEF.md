# Sample acquisition brief (Prompt 05)

**Date:** 2026-10-11  
**Status:** All combustion hybrid slots are **awaiting licensed assets**. The Web Audio hybrid sample layer, typed manifest, bounded cache, and procedural fallback are implemented. No invented WAV/MP3 files, competitor downloads, or unlicensed YouTube extracts are registered.

Related: [`LISTENING_AND_ASSET_STATUS.md`](./LISTENING_AND_ASSET_STATUS.md), [`AMERICAN_V8_HYBRID_PILOT.md`](../AMERICAN_V8_HYBRID_PILOT.md), [`GRANULAR_SYNTHESIS_DECISION.md`](./GRANULAR_SYNTHESIS_DECISION.md), runtime types in `src/lib/sound/realism/samples/`.

## Licensing constraints (must read)

| Constraint | Requirement |
| --- | --- |
| Commercial interactive web | Explicit license for app-embedded, browser-delivered loops and one-shots |
| Redistribution | Confirm whether CDN/signed-URL delivery to end users is allowed |
| Client extractability | Browser-delivered audio **cannot** be made impossible to extract; acknowledge in the license record (`clientExtractableAcknowledged`) |
| Identity | Engine layout / Sound Profile id must be verified; do not invent OEM brands in UI copy |
| Steady beds | Prefer multiple steady RPM recordings; a single free-rev clip pitch-shifted across the full range is **insufficient** |
| Research extracts | Package research WAVs remain **unregistered** until rights + RPM/load/loop metadata exist |

Delivery catalog (`SOUND_ASSET_CATALOG`) is currently **empty** → API returns `deliveryMode: "procedural_only"`.

## Recording package (every selected combustion family)

For each profile below, capture with **one consistent mic perspective** per bank (do not mix cabin + exhaust without a documented normalization plan).

### Required beds

| Slot | Suggested RPM (request, not a claim) | Load | Notes |
| --- | --- | --- | --- |
| idle | ~700–900 | near idle | Clean loop region ≥ 1.5 s |
| on-load-low | ~1600–2000 | light–medium | Steady throttle, not sweeping |
| on-load-mid | ~2800–3600 | medium | |
| on-load-high | ~4200–5200 (or redline−margin) | high | Preserve high-RPM character |
| off-load-low / mid / high | same RPM bands | closed/light throttle | Distinct from on-load at same RPM |

### Optional (priority after beds)

| Slot | Purpose |
| --- | --- |
| intake | Intake / stack perspective bed |
| mechanical-engagement | Short clutch/gear mesh one-shot (not a free-running loop) |
| lift-off | Decel / overrun burble accent |
| overrun-low / overrun-high | Steady overrun beds if lift-off one-shots are insufficient |

### Per-file metadata required before runtime approval

Stable `assetId`, `profileId`, `familyId`, measured `sourceRpm`, regime, mic perspective, loop start/end (seconds), gain trim (dB), sample rate, channel format (mono or stereo), provenance + license records, `commercialWebInteractive: true`, optional SHA-256, `permittedPlaybackRate` typically ≈ 0.88–1.14 (wider only with measured justification), `steadyState: true` for beds.

Runtime validation: `validateHybridRecordingEntry` in `src/lib/sound/realism/samples/validate.ts`.

## Missing assets by Sound Profile ID

Priority **1** = record first. Status today: **awaiting-assets** for all rows (0 approved files).

### Priority 1

#### `american-muscle-v8` (family `american-v8`)

Missing required:  
`american-muscle-v8__idle`, `american-muscle-v8__on-load-low`, `american-muscle-v8__on-load-mid`, `american-muscle-v8__on-load-high`, `american-muscle-v8__off-load-low`, `american-muscle-v8__off-load-mid`, `american-muscle-v8__off-load-high`  

Also tracked by legacy pilot slots (still empty):  
`american-v8-idle`, `american-v8-onload-low`, `american-v8-onload-mid`, `american-v8-onload-high`, `american-v8-offload-low`, `american-v8-offload-mid`, `american-v8-offload-high`, `american-v8-overrun-low`, `american-v8-overrun-high`

Optional: `__intake`, `__mechanical-engagement`, `__lift-off`, `__overrun-low`, `__overrun-high`

#### `flat-six-sport` (family `flat-six-sport`)

Missing required:  
`flat-six-sport__idle`, `flat-six-sport__on-load-low`, `flat-six-sport__on-load-mid`, `flat-six-sport__on-load-high`, `flat-six-sport__off-load-low`, `flat-six-sport__off-load-mid`, `flat-six-sport__off-load-high`

Optional: same optional set as Muscle (intake-forward character preferred).

### Priority 2

#### `gt-v8`

Missing required: `gt-v8__idle`, `gt-v8__on-load-low`, `gt-v8__on-load-mid`, `gt-v8__on-load-high`, `gt-v8__off-load-low`, `gt-v8__off-load-mid`, `gt-v8__off-load-high`  
+ optional intake / mechanical / lift-off / overrun.

#### `racing-v10`

Missing required: `racing-v10__idle` … `racing-v10__off-load-high` (seven beds) + optional set.

#### `race-car`

Missing required: `race-car__idle` … `race-car__off-load-high` + optional set.

### Priority 3

#### `rally-car`, `turbo-inline-6`, `motorcycle-superbike`, `big-twin`

Each missing the same seven required bed IDs (`{id}__idle` … `{id}__off-load-high`) plus optional intake / mechanical-engagement / lift-off / overrun beds.

## Runtime behaviour until assets arrive

- Hybrid sample layer code path is live for Realism V2/V3 combustion profiles.
- Empty catalog → `procedural_only`; sample bus silent; procedural combustion gain fully restored (no loudness jump).
- Profiles are marked **awaiting-assets**, not “sample-assisted”.
- Pitch model when assets exist: `playbackRate = targetRpm / sourceRpm` inside per-asset bounds; neighbouring RPM and load layers blend (linear default; equal-power optional).

## How to register an approved asset later

1. Obtain rights + measured metadata; compute SHA-256.
2. Fill a `HybridRecordingManifestEntry` (or Muscle pilot entry) to `approval: "approved"` with non-null path/RPM/loop/trim.
3. Add a `SoundAssetDescriptor` to `SOUND_ASSET_CATALOG` (never invent paths beforehand).
4. Configure signing secret for delivery; verify CORS on the asset origin.
5. Re-run `hybrid-samples` + hybrid combustion tests; listen before claiming realism.
