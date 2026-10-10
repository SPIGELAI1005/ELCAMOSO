# Rain Drive

**Profile ID:** `rain-drive`  
**Portfolio category:** Nature  
**Technical family:** environmental  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Wet-road motion formed from drops, tire wash, spray and changing surface energy.

## Required motion behavior

speed changes wash; acceleration adds spray; stop retains sparse drops. Use state machines, hysteresis and contextual events. Permit quiet passages. Do not map speed directly to pitch unless the physical source requires it.

## Required layers

- drop layers
- tire wash
- spray
- cabin roof/body

Every layer must have its own gain envelope and mute/solo diagnostic. Layer names must be stable so regression and Studio controls can address them.

## Recommended control map

| Input | Requirement |
|---|---|
| Speed | Controls physical motion/environment only where justified; never acts as the sole loudness control. |
| Throttle / demand | Controls effort, excitation pressure, brightness or musical energy. |
| Acceleration | Controls attack and transient emphasis with FAST smoothing. |
| Regen / lift | Produces a distinct release state; it is not simply negative volume. |
| Jerk | May trigger restrained contextual accents with cooldown and deterministic seeded variation. |
| RPM / gear | Not fabricated unless the profile has an explicit virtual mechanism. |

## DSP starting direction

- Build a fixed, reusable node graph; do not spawn nodes per audio-rate event.
- Use AudioWorklet for pulse, granular or other sample-accurate processing when required.
- Separate stationary body/formant resonances from order-linked components.
- Use FAST and SLOW smoothers so response feels immediate without zipper noise.
- Preserve at least 3 dB normal-drive headroom before the final limiter.
- Apply profile loudness trim only after loudness-matched A/B evaluation.
- Keep the existing master ceiling, safety ramps and 180 ms profile-switch behavior.

## Sample and source plan

dry/wet road layers; rain intensities; splash variants. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

flat broadband hiss, thunder by default, engine core.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure state transition stability, repetition score, event density, spectral balance, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.
