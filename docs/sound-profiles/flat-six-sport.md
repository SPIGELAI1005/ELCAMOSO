# Flat-Six Sport

**Profile ID:** `flat-six-sport`  
**Portfolio category:** Classic  
**Technical family:** combustion  
**Drivetrain mode:** `virtual-transmission`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Smooth overlapping flat-six pulses, dry mechanical precision and strong high-RPM intake development.

## Required motion behavior

RPM brightens strongly; load opens intake; crisp shift/rev-match. Use deterministic RPM, load, gear, shift phase and overrun. Firing frequency follows four-stroke physics unless the profile explicitly specifies otherwise.

## Required layers

- flat-six pulses
- intake formants
- dry mechanical band
- light exhaust

Every layer must have its own gain envelope and mute/solo diagnostic. Layer names must be stable so regression and Studio controls can address them.

## Recommended control map

| Input | Requirement |
|---|---|
| Speed | Controls physical motion/environment only where justified; never acts as the sole loudness control. |
| Throttle / demand | Controls effort, excitation pressure, brightness or musical energy. |
| Acceleration | Controls attack and transient emphasis with FAST smoothing. |
| Regen / lift | Produces a distinct release state; it is not simply negative volume. |
| Jerk | May trigger restrained contextual accents with cooldown and deterministic seeded variation. |
| RPM / gear | Authoritative for pitched mechanical layers and shifts. |

## DSP starting direction

- Build a fixed, reusable node graph; do not spawn nodes per audio-rate event.
- Use AudioWorklet for pulse, granular or other sample-accurate processing when required.
- Separate stationary body/formant resonances from order-linked components.
- Use FAST and SLOW smoothers so response feels immediate without zipper noise.
- Preserve at least 3 dB normal-drive headroom before the final limiter.
- Apply profile loudness trim only after loudness-matched A/B evaluation.
- Keep the existing master ceiling, safety ramps and 180 ms profile-switch behavior.

## Sample and source plan

five RPM x three load anchors; intake/exhaust separates; shifts. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

V8 lope, generic six drone, excessive low bass.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Upshift, downshift, rev-match/kickdown and redline behavior.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure firing-order energy, RPM tracking error, load spectral delta, shift timing, crest factor, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.
