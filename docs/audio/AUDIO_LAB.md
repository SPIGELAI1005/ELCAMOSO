# Audio comparison lab (Prompt 01)

Development harness that exercises the **production** `SoundEngine` with deterministic synthetic telemetry. It does not replace the engine with a demo synthesizer.

## Access

| Environment | Access |
| --- | --- |
| Local Vite `import.meta.env.DEV` | UI at `/debug/audio-lab` (linked from `/debug` only — not BrandNav) |
| Deployed / production build | Requires `ELCAMOSO_AUDIO_LAB_SECRET` or fallback `ELCAMOSO_BILLING_ADMIN_SECRET` via server verification. Hidden URL alone is insufficient. |

Recording and lab capture stay **off** during normal Drive playback. Captures run only when you click Capture or run the CLI.

## UI

1. Open `/debug` → **Audio Lab** (dev) or unlock with the lab secret on a deployed host.
2. Select profile A/B and a fixture.
3. **Capture A** / **Capture B** (OfflineAudioContext + production graph).
4. Play **one** side at a time (never A+B simultaneously). Optional level-match uses approximate integrated loudness + peak headroom.
5. Mute/solo layers on the live engine for the active profile (inspection aid).
6. Download WAV + `.meta.json` (profile, fixture, seed, backend, excitationMode, limitations).

## CLI

```bash
npm run audio:lab
AUDIO_LAB_PROFILES=gt-v8,american-muscle-v8 AUDIO_LAB_FIXTURES=idle,gentle-0-80 npm run audio:lab
AUDIO_LAB_OUT=artifacts/audio-lab/local npm run audio:lab
```

Writes under `artifacts/audio-lab/<date>/` (gitignored via `artifacts/`):

- `*.wav` + `*.meta.json`
- `analysis.json`
- `baseline-reports-pending.json` (per-ID stubs; measured fields pending until captures run)

## Fixtures

**Speed-driven (acceptance-oriented):** idle, gentle-0-80, assertive-accel, steady-30/50/80, lift-off, decel-80-0, threshold-hover, gps-loss-recovery, profile-switch.

**Diagnosis-only:** rpm-sweep, load-sweep (direct RPM/load overrides — not speed-driven acceptance).

## Metrics honesty

- Sample peak / RMS / crest / DC / NaN / Inf / clipped counts
- Spectral centroid + band energy (20–60 … 4000–12000 Hz within Nyquist)
- Approximate integrated loudness (BS.1770-style) — **not** certified LUFS
- **No** true-peak meter
- Lower centroid or more bass ≠ proven realism

## Limitations

See `DEFAULT_LAB_LIMITATIONS` in `src/lib/sound/lab/capture-metadata.ts`. Offline worklet availability is reported via `excitationMode`. Realtime path exists but falls back to offline when the ScriptProcessor cannot tap the engine graph.

## Rollback

Remove/disable `/debug/audio-lab`, `src/lib/sound/lab/*`, and `npm run audio:lab`. Existing `audio:compare` / `offline-comparison` paths remain unchanged.
