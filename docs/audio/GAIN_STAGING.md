# Gain staging (Prompt 08)

**Status:** implemented + automatically verified (unit) · listening/device checklist below (unverified until run in cabin)

## Audit findings (code-confirmed)

| Issue | Evidence | Correction |
| --- | --- | --- |
| Double `profileGain` risk | `session` called `setVolume(cappedGain(vol, profileGain))` while `update()` also multiplied `profileGain` | Session passes UI `volume` + `setProfileGain` separately |
| DynamicsCompressor as “limiter” | Final stage threshold −3 dB, ratio 12 — not brickwall / true-peak | Dedicated WaveShaper peak protect at **−1 dBFS sample** |
| Double program compression | MasterBus compressor + final compressor | Final compressor removed; MasterBus kept **gentle** (ratio ~1.45, slower attack) |
| Stacked attenuations | `MASTER_BUS_OUTPUT_GAIN` 0.9 × intensity ceiling × load scale × startup | Documented; load scale **mild** (floor 0.92); offline `PROFILE_LOUDNESS` for catalog balance |
| Default volume 70% | `DEFAULT_SETTINGS.volume = 0.7` | New-device default **35%**; existing saved volumes kept on migrate |
| Import overwrote loudness | `mergeBackup` took `incoming.volume` | Merge keeps **this device’s** volume and output boost |

Timbre (catalog tuning, hybrid body/mechanical, cabin EQ) stays **upstream** of user volume.

## Declared signal path

```
layer trims / strategy mix
  → cabin EQ (incl. bounded Body shelf)
  → MasterBus: soft sat → EQ → gentle program compressor → 0.9 makeup
  → user volume (perceptual curve × profileGain × offline loudness trim × mild load scale)
  → optional output boost (0…+6 dB)
  → peak protect (soft knee to −1 dBFS sample; lookahead 0 ms; 2× oversample)
  → call duck
  → destination
```

Reverb wet still sums into the user-volume node (pre-boost), matching the prior wet→master topology.

## Controls

| Control | Range | Notes |
| --- | --- | --- |
| Master volume | 0–100% | Perceptual anchors; **0 = silence**; Settings + Drive share `settings.volume` |
| Output boost | 0–+6 dB | Settings; peak-protected; **does not** override car hardware volume |
| Shift intensity | 0–100% | Mechanical clacks only (Prompt 06); independent of master |
| Body / Mechanical Character | 0–100% (50 = authored) | Advanced Settings only; bounded; preserve identity |
| Mute / start-stop | Engine stop / volume 0 | Not conflated with shift intensity |

## Peak protection

- **Sample-peak ceiling:** −1 dBFS (`SAMPLE_PEAK_CEILING_LINEAR ≈ 0.891`)
- **True peak:** not certified; lab metrics remain sample-peak / approximate loudness
- **Lookahead:** WaveShaper path **0 ms**; do not claim DynamicsCompressor true-peak limiting
- Worst-case max volume + max boost + loud trim + dual-engine crossfade overlap must stay **finite**; protect stage absorbs peaks without synth hard-clip as the primary fix

## Overload telemetry

`SoundEngine.getMeter()` / `getGainDiagnostics()` expose `samplePeakDbfs`, `nearCeiling`, `overloadSampleCount`, boost, characters — for **/debug** and audio lab only. Customer HeadroomMeter shows headroom only.

## Listening / device checklist (cabin)

Fixed moderate car volume, **neutral EQ**, Bluetooth or cabin speakers (not phone for sub-bass):

1. New profile / clear storage → volume defaults near **35%**, audible but not aggressive.
2. Slider **0** → silence; restore mid → smooth ramp (no zipper).
3. Output boost 0 → +6 dB at fixed slider → louder, no sustained digital crackle; reduce if near ceiling.
4. Shift intensity 0 vs 100% at same master → clacks only change.
5. Body / Mechanical at 0 / 50 / 100 → identity remains the same Sound Profile; no runaway gain.
6. Max volume + max boost + assertive accel + shift → finite, no NaN; prefer lowering boost over accepting distortion.
7. Import merge from another backup → **this device’s volume/boost unchanged**.
8. Profile switch at high volume → crossfade without a correlated gain spike.

## Feature flags

None. Peak protect and gain path are always on. Rollback: revert `gain-staging/`, engine graph, settings v9 fields.

## Related

- `src/lib/sound/gain-staging/`
- `src/lib/sound/perceptual-volume.ts`
- `docs/DRIVE_COCKPIT_V2_PROGRESS.md` (Prompt 08)
