# Driving-experience audio validation — 2026-09-26

## Outcome and scope

The runtime registry contains 57 selectable profiles. Every one was rendered through the production `SoundEngine` and `PowertrainSimulator` with the same deterministic 16.5-second manual-input replay. The replay covers start/idle, gentle pull-away, sustained acceleration and shifts, steady cruise, lift-off, braking/regeneration, renewed acceleration, return to stop and stopped state.

This is implementation and signal validation, not a claim of realism or human listening approval. No profile is marked `listening verified` in the profile matrix. Realization follow-up (2026-10-10): headphone and Tesla checklist steps remain **not performed**; do not promote statuses from this document alone. See [`LISTENING_AND_ASSET_STATUS.md`](./LISTENING_AND_ASSET_STATUS.md) and [`ARTIFACTS_AND_TRACKING.md`](./ARTIFACTS_AND_TRACKING.md).

## What changed

- Every registry profile now has bounded typed experience settings: physical/design classification, pitch and load driver, aspiration, available acoustic roles, transition time constant, phase response, deterministic variation and event voice limits.
- The shared renderer smoothly reduces intrusive layers at cruise, restores intake/exhaust/mechanical or motor texture on demand, separates lift-off from cruise, and gives electric profiles a distinct regeneration state.
- Realism V2 combustion retains continuous phase and uses family-specific pulse, intake, resonance, mechanical and upper-RPM parameters. Turbo spool and release remain separate and state-gated.
- Developer `/debug` controls can isolate combustion/motor, intake, exhaust, boost, mechanical, regeneration, environment/music and event roles. They are not exposed in the normal driving UI.
- The previous renderer remains selectable for reversible A/B comparison. Master gain was not increased.

## Measured checks

The all-profile portfolio is in `artifacts/audio-portfolio/2026-09-26/`; the report is `analysis.json`.

| Check | Result |
| --- | --- |
| Profiles rendered | 57 / 57 |
| Clipped PCM samples | 0 |
| Sample-peak range | -29.38 to -1.31 dBFS |
| Worst mono sum change | -0.28 dB |
| Total offline render time | 224.3 s |
| Available hardware | Intel i7-1165G7, 8 logical CPUs, 16 GB RAM |

The largest cruise sample-step proxy was 0.179 in `construction-monster`. This is not proof of an audible click: the profile contains authored sharp mechanical transients, and human listening is required. The profiles with weak or negative acceleration/cruise RMS contrast are mainly ambient, carriage or musical concepts whose cadence or bed persists by design; they should be judged for responsiveness by listening, not treated as combustion failures.

The representative old/new set is in `artifacts/audio-comparisons/2026-09-26/`. It contains 11 profiles × 2 implementations × untouched and approximately loudness-matched versions. New Realism V2 combustion examples measured 11.2–13.0 dB hard-acceleration-over-cruise contrast, versus 2.9–5.5 dB for their prior renderer. Electric Hypercar increased from 2.7 to 7.7 dB. Oide Wiesn Tractor remains on its specialist renderer and measured 1.3 dB in both paths.

The loudness-matched files target an approximate -20 integrated value and are capped by sample peak at -1 dBFS. The meter is an approximate BS.1770 implementation, not a certified LUFS meter; sample peak is not true peak.

## Offline versus real-time path

Chrome `OfflineAudioContext` exercised the production buses, profile strategies, drivetrain state and output protection. In this environment it did not consistently expose the production AudioWorklet across repeated profile renders, so Realism V2 comparison files use the documented main-thread fallback excitation except where `analysis.json` explicitly reports `realism-v2-worklet`. Real-time scheduling, device DAC/output EQ, cabin acoustics, browser background throttling and vehicle speakers are not represented.

## Listening checklist

Use the matched files to compare character and the untouched files to judge dynamics. Keep the same device and volume/EQ settings between every pair.

Headphones:

1. At idle, check that Muscle V8 is pulse-heavy but not sub-bass dominated; GT V8 should be smoother and denser.
2. During 3–5 s acceleration, listen for load-dependent intake/exhaust texture rather than only pitch or loudness.
3. At 5–7 s cruise, check for fatigue, obvious looping, whistles or layers that fail to settle.
4. At 7–9 s lift/braking, verify restrained overrun or a distinct electric regen signature without random cruise events.
5. At 9–11 s re-acceleration, listen for coherent shift cut, RPM transition and re-engagement without gear hunting.
6. Compare stereo and mono playback for missing body or hollow phase cancellation.

Tesla browser/vehicle:

1. Disable adaptive EQ/volume changes if the vehicle permits, choose one fixed vehicle volume/EQ setting, and leave it unchanged for all files.
2. Repeat the same time-coded checks above, focusing on low-mid body, harsh upper harmonics and whether cruise masks navigation/speech.
3. Switch profiles repeatedly and listen for clicks, stale release events and abrupt loudness changes.

Browser real-time listening and Tesla vehicle playback were not performed in this automated environment. Human listening remains required before changing any status to `listening verified`.
