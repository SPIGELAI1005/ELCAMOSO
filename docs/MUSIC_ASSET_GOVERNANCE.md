# Music asset governance

No unknown-origin audio may silently ship.

## Required manifest fields (production WAV)

| Field                 | Required                           |
| --------------------- | ---------------------------------- |
| asset id              | yes                                |
| pack                  | yes                                |
| instrument / stem     | yes                                |
| variation             | yes                                |
| BPM                   | yes                                |
| key                   | yes                                |
| bars                  | yes                                |
| version               | yes                                |
| copyright owner       | yes                                |
| license               | yes                                |
| source                | original / commissioned / licensed |
| commercial-use status | yes                                |

Also: 48 kHz preferred, loop boundaries, stem normalization / headroom (see `docs/SYMPHONY_AUDIO_ASSETS.md`).

## Enforced manifest

`src/lib/symphony/asset-manifest.ts` normalizes and validates a record for every declared stem.
The gate requires all fields above plus an asset path, 48 kHz analysis, bar-aligned duration,
peak/RMS values, and `commercialUseStatus: approved`. Duplicate IDs are rejected.

`/debug/symphony-assets` shows the complete record and a `PRODUCTION READY` or
`PRODUCTION BLOCKED` decision for each pack. Automated coverage lives in
`src/lib/symphony/asset-manifest.test.ts`.

## Pack licensing block

Every `SymphonyPack.licensing` must set `source`, `notes`, `version`.

Allowed sources: `procedural_placeholder` | `original` | `commissioned` | `licensed`.
`procedural_placeholder` is accepted only for development and always fails the production gate.

## Dev audit

`/debug/symphony-assets` (dev only) lists BPM, bar/loop length, all per-asset metadata, and every
blocking error or warning.

Reject obviously misaligned BPM/bars in development.

## Policy

Never use copyrighted commercial songs. Never imitate a named artist. Only original, commissioned, or properly licensed assets.

## Current release status

The three repository packs contain development synthesis only. They are explicitly marked
`development_only`, have no production asset path, and are blocked in production by both the
loader and playback engine. Final original, commissioned, or licensed stems must be supplied and
approved before Symphony can be enabled in a production release. This is an external content and
rights dependency, not a code fallback.
