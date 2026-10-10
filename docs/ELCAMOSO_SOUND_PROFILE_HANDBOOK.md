# ELCAMOSO Sound Profile System

This package was derived from the current GitHub portfolio and preserves all 57 currently assembled Sound Profile IDs: 47 core profiles (22 original plus 25 expansion), 3 Symphony profiles, 3 World profiles and 4 Fusion profiles. It is a design and implementation specification, not a bundle of copied recordings. External recordings may be used for acoustic research; runtime assets require explicit commercial/app-embedding rights.

## Architectural rules

1. Keep one AudioContext per Drive session.
2. Keep motion, powertrain and sound responsibilities separate.
3. Use deterministic vehicle/mechanism state and seeded expressive variation.
4. Preserve Realism V2, Dynamic Drive, Studio, Journey Replay and procedural fallback compatibility.
5. Do not force every experience through a combustion model.
6. Loudness-match before judging profile quality.
7. Protect Tesla-browser performance with fixed graphs, AudioWorklet where appropriate and bounded events.
8. Preserve public IDs and migrations.

## Portfolio

| ID | Name | Category | Family | Drivetrain |
|---|---|---|---|---|
| `gt-v8` | GT V8 | Classic | combustion | `virtual-transmission` |
| `racing-v10` | Racing V10 | Motorsport | combustion | `virtual-transmission` |
| `cyber-pulse` | Cyber Pulse | Future | designed | `continuous` |
| `race-car` | Race Car | Motorsport | combustion | `virtual-transmission` |
| `rally-car` | Rally Car | Motorsport | combustion | `virtual-transmission` |
| `space-ship` | Space Ship | Future | designed | `continuous` |
| `ufo` | UFO | Future | designed | `continuous` |
| `speed-boat` | Speed Boat | Nautical | physical | `continuous` |
| `cruise-ship` | Cruise Ship | Nautical | physical | `continuous` |
| `santa-sleigh` | Santa Sleigh | Festive | environmental | `continuous` |
| `wild-west-carriage` | Wild West Carriage | Heritage | environmental | `continuous` |
| `romanian-85-carriage` | Romanian '85 Carriage | Heritage | environmental | `continuous` |
| `laughing-machine` | Laughing Machine | Playful | environmental | `continuous` |
| `farting-car` | Farting Car | Playful | designed | `virtual-transmission` |
| `steam-train` | Steam Train | Heritage | physical | `continuous` |
| `kazoo-kart` | Kazoo Kart | Playful | designed | `virtual-transmission` |
| `turbine-jet` | Turbine Jet | Aviation | physical | `continuous` |
| `helicopter` | Helicopter | Aviation | physical | `continuous` |
| `private-jet` | Private Jet | Aviation | physical | `continuous` |
| `wiesn-tractor` | Oide Wiesn Tractor | Heritage | physical | `virtual-transmission` |
| `open-wind` | Open Wind | Nature | environmental | `continuous` |
| `storm-glider` | Storm Glider | Nature | environmental | `continuous` |
| `flat-six-sport` | Flat-Six Sport | Classic | combustion | `virtual-transmission` |
| `american-muscle-v8` | American Muscle V8 | Classic | combustion | `virtual-transmission` |
| `turbo-inline-6` | Turbo Inline-6 | Classic | combustion | `virtual-transmission` |
| `electric-hypercar` | Synthetic Hyper EV | Future | designed | `virtual-transmission` |
| `formula-electric` | Formula Electric | Motorsport | designed | `continuous` |
| `neon-drive` | Neon Drive | Future | musical | `continuous` |
| `maglev-train` | Maglev Train | Machines | physical | `continuous` |
| `high-speed-train` | High-Speed Train | Machines | physical | `continuous` |
| `submarine` | Submarine | Future | physical | `continuous` |
| `jet-ski` | Jet Ski | Nautical | physical | `continuous` |
| `motorcycle-superbike` | Motorcycle Superbike | Motorsport | combustion | `virtual-transmission` |
| `big-twin` | Big Twin | Classic | combustion | `virtual-transmission` |
| `snowmobile` | Snowmobile | Machines | physical | `continuous` |
| `tank` | Tank | Machines | physical | `continuous` |
| `construction-monster` | Construction Monster | Machines | physical | `continuous` |
| `horse-gallop` | Horse Gallop | Heritage | environmental | `continuous` |
| `dragon` | Dragon | Future | environmental | `continuous` |
| `thunder-beast` | Thunder Beast | Future | environmental | `continuous` |
| `retro-arcade` | Retro Arcade | Musical | musical | `continuous` |
| `synthwave-drive` | Synthwave Drive | Musical | musical | `continuous` |
| `deep-bass-pulse` | Deep Bass Pulse | Musical | musical | `continuous` |
| `zen-drive` | Zen Drive | Nature | environmental | `continuous` |
| `rain-drive` | Rain Drive | Nature | environmental | `continuous` |
| `ocean-drive` | Ocean Drive | Nature | environmental | `continuous` |
| `heartbeat` | Heartbeat | Musical | musical | `continuous` |
| `symphony-cinematic-rock` | Cinematic Rock | Musical | musical | `continuous` |
| `symphony-motion-orchestra` | Motion Orchestra | Musical | musical | `continuous` |
| `symphony-neon-run` | Neon Run | Musical | musical | `continuous` |
| `world-space-drive` | Space Drive | Future | designed | `continuous` |
| `world-cyber-city` | Cyber City | Future | designed | `continuous` |
| `world-storm-run` | Storm Run | Nature | environmental | `continuous` |
| `fusion-road-anthem` | Road Anthem | Musical | fusion | `continuous` |
| `fusion-mechanical-symphony` | Mechanical Symphony | Musical | fusion | `continuous` |
| `fusion-midnight-boost` | Midnight Boost | Musical | fusion | `continuous` |
| `fusion-future-pulse` | Future Pulse | Musical | fusion | `continuous` |

## File contract

Each file in `docs/sound-profiles` is the human source of truth for identity and acceptance criteria. Cursor should implement typed recipes under `src/lib/sound/profile-specs` and validate every recipe against a schema. Markdown must not be parsed at runtime.

## Recommended typed model

`SoundProfile` remains the stable product/catalog entity. Add a separate `AcousticProfileSpec` keyed by the same ID, containing family, layer plan, control curves, state machines, DSP parameters, optional sample-bank manifest and validation limits. Resolve it inside the appropriate synthesis backend.

## Closest-neighbor tests

- GT V8 vs American Muscle V8
- Flat-Six Sport vs Turbo Inline-6
- Racing V10 vs Race Car
- Synthetic Hyper EV vs Formula Electric vs Cyber Pulse
- Turbine Jet vs Private Jet
- Speed Boat vs Jet Ski vs Ocean Drive
- Wild West Carriage vs Romanian '85 Carriage vs Horse Gallop
- Open Wind vs Storm Glider vs Rain Drive
- Neon Drive vs Synthwave Drive vs Retro Arcade
- Dragon vs Thunder Beast

## Delivery order

Implement shared schema/diagnostics first, then combustion, designed EV/future, physical machines, environmental/heritage, musical/playful, and finally full portfolio calibration. Do not tune all 57 simultaneously; calibrate the 47 core profiles before the dependent Symphony, World and Fusion experiences.


---

# GT V8

**Profile ID:** `gt-v8`  
**Portfolio category:** Classic  
**Technical family:** combustion  
**Drivetrain mode:** `virtual-transmission`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Refined cross-plane V8 with broad low-mid authority and expensive restraint.

## Required motion behavior

RPM and load; fast clean shifts; light overrun. Use deterministic RPM, load, gear, shift phase and overrun. Firing frequency follows four-stroke physics unless the profile explicitly specifies otherwise.

## Required layers

- pulse train
- exhaust formants
- intake bark
- body resonance

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

idle/on-load/off-load loops; shift and restrained overrun one-shots. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

cartoon lope, permanent pops, uncontrolled sub-bass.

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


---

# Racing V10

**Profile ID:** `racing-v10`  
**Portfolio category:** Motorsport  
**Technical family:** combustion  
**Drivetrain mode:** `virtual-transmission`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Even-fire high-rev V10 that evolves from compact mechanical urgency into an upper-register scream.

## Required motion behavior

RPM dominates; load opens intake; very short torque cuts. Use deterministic RPM, load, gear, shift phase and overrun. Firing frequency follows four-stroke physics unless the profile explicitly specifies otherwise.

## Required layers

- dense firing orders
- intake trumpet
- metallic mechanical band
- exhaust formants

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

five RPM x three load anchors; fast shift cuts; rev-match. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

V8 bass signature, flat-six rasp, one-note synth whine.

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


---

# Cyber Pulse

**Profile ID:** `cyber-pulse`  
**Portfolio category:** Future  
**Technical family:** designed  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Original futuristic EV pulse with continuous propulsion, regeneration and no combustion metaphor.

## Required motion behavior

speed, torque demand and regen independently. Use original procedural sonification. Keep speed, torque demand, acceleration and regen as independent controls; never disguise a single pitch ramp as a complete profile.

## Required layers

- motor-order tone
- pulse lattice
- inverter sparkle
- regen inversion

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

optional designed texture beds and transition one-shots. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

fake cylinders, exhaust pops, arbitrary gears.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure control independence, spectral centroid, tonal stability, transient count, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Race Car

**Profile ID:** `race-car`  
**Portfolio category:** Motorsport  
**Technical family:** combustion  
**Drivetrain mode:** `virtual-transmission`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Purpose-built track powertrain: dry, close, lightweight and brutally responsive.

## Required motion behavior

fast RPM; high load; hard shift cut; rev-match. Use deterministic RPM, load, gear, shift phase and overrun. Firing frequency follows four-stroke physics unless the profile explicitly specifies otherwise.

## Required layers

- compact combustion orders
- intake
- straight-cut gear mesh
- body vibration

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

track intake/exhaust loops; shift cuts; downshift blips. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

road-car softness, generic V10 clone, constant crackles.

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


---

# Rally Car

**Profile ID:** `rally-car`  
**Portfolio category:** Motorsport  
**Technical family:** combustion  
**Drivetrain mode:** `virtual-transmission`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Turbo rally character with urgent boost, gravel interaction and physically gated anti-lag.

## Required motion behavior

load builds boost; lift releases turbo; surface follows speed/jerk. Use deterministic RPM, load, gear, shift phase and overrun. Firing frequency follows four-stroke physics unless the profile explicitly specifies otherwise.

## Required layers

- inline combustion
- turbo
- wastegate
- drivetrain
- gravel

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

turbo beds; wastegate/flutter; gravel; shift and anti-lag variants. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

constant anti-lag, generic white noise, events without prior load.

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


---

# Space Ship

**Profile ID:** `space-ship`  
**Portfolio category:** Future  
**Technical family:** designed  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Massive fictional propulsion with hull resonance, energy buildup and weightless momentum.

## Required motion behavior

acceleration charges energy; speed sustains; regen releases. Use original procedural sonification. Keep speed, torque demand, acceleration and regen as independent controls; never disguise a single pitch ramp as a complete profile.

## Required layers

- subharmonic hull
- reactor bed
- propulsion shear
- cabin resonance

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

original reactor/hull textures; transition stingers. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

jet-engine copy, random sci-fi beeps, fatiguing constant highs.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure control independence, spectral centroid, tonal stability, transient count, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# UFO

**Profile ID:** `ufo`  
**Portfolio category:** Future  
**Technical family:** designed  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Playful classic-saucer glide with theremin-like motion and eerie spatial instability.

## Required motion behavior

acceleration bends pitch; steering/jerk may widen; regen descends. Use original procedural sonification. Keep speed, torque demand, acceleration and regen as independent controls; never disguise a single pitch ramp as a complete profile.

## Required layers

- sine glide
- formant moan
- slow beating
- spatial orbit

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

original theremin gestures and short beam accents. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

borrowed film motifs, harsh continuous 4 kHz tone.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure control independence, spectral centroid, tonal stability, transient count, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Speed Boat

**Profile ID:** `speed-boat`  
**Portfolio category:** Nautical  
**Technical family:** physical  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Outboard propulsion that moves through displacement, cavitation and planing regimes.

## Required motion behavior

speed selects water regime; load drives prop bite; impacts use jerk. Model the physical source and its operating regimes. Separate excitation, mechanism, body/resonance and environment layers.

## Required layers

- outboard motor
- prop load
- cavitation
- hull slap
- spray

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

outboard load loops; water regimes; hull-slap variants. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

speed-equals-volume mapping, endless hiss, seagull overload.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure regime transitions, cadence tracking, spectral bands, event plausibility, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Cruise Ship

**Profile ID:** `cruise-ship`  
**Portfolio category:** Nautical  
**Technical family:** physical  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Enormous slow marine machinery, hull wash and spacious low-frequency mass.

## Required motion behavior

slow load response; speed grows wake; rare horn only by explicit event. Model the physical source and its operating regimes. Separate excitation, mechanism, body/resonance and environment layers.

## Required layers

- engine-room orders
- shaft rhythm
- hull resonance
- wake

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

engine-room and wake beds; licensed/original horn. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

frequent horns, subsonic limiter pumping, speedboat behavior.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure regime transitions, cadence tracking, spectral bands, event plausibility, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Santa Sleigh

**Profile ID:** `santa-sleigh`  
**Portfolio category:** Festive  
**Technical family:** environmental  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Original festive sleigh motion built from runners, bells, winter air and restrained character moments.

## Required motion behavior

cadence follows motion; acceleration brightens bells. Use state machines, hysteresis and contextual events. Permit quiet passages. Do not map speed directly to pitch unless the physical source requires it.

## Required layers

- runner scrape
- bell rhythm
- soft hoof/air bed
- rare voice accent

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

original bells, runner snow, optional original voice one-shots. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

copyrighted melodies, constant ho-ho-ho, shrill bells.

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


---

# Wild West Carriage

**Profile ID:** `wild-west-carriage`  
**Portfolio category:** Heritage  
**Technical family:** environmental  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Four-beat horse gait, wooden carriage flex, gravel and dust.

## Required motion behavior

walk/trot/canter/gallop states from speed and acceleration. Use state machines, hysteresis and contextual events. Permit quiet passages. Do not map speed directly to pitch unless the physical source requires it.

## Required layers

- hoof gait state
- wheel rotation
- wood creak
- gravel
- wind

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

gait variants; wood/wheel loops; surface layers. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

metronomic hoof loop, random whip, motor-like pitch rise.

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


---

# Romanian '85 Carriage

**Profile ID:** `romanian-85-carriage`  
**Portfolio category:** Heritage  
**Technical family:** environmental  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Patient single-horse village cart with iron-rimmed wheels, cobbles and aged wood.

## Required motion behavior

low-speed gait; bumps from jerk; wheel cadence from speed. Use state machines, hysteresis and contextual events. Permit quiet passages. Do not map speed directly to pitch unless the physical source requires it.

## Required layers

- single-horse gait
- iron rim
- cobble impacts
- heavy creak

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

single-horse gaits; cobbles; iron wheel; cart creaks. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

Western whip clichés, four-horse cadence, comic excess.

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


---

# Laughing Machine

**Profile ID:** `laughing-machine`  
**Portfolio category:** Playful  
**Technical family:** environmental  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

An original responsive laughter instrument whose intensity follows driver demand.

## Required motion behavior

throttle/acceleration select laugh intensity; cooldown-gated peaks. Use state machines, hysteresis and contextual events. Permit quiet passages. Do not map speed directly to pitch unless the physical source requires it.

## Required layers

- breath bed
- chuckle cadence
- belly-laugh events
- cabin resonance

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

commissioned original laugh library with consent and releases. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

machine-gun samples, distressing screams, constant maximum laughter.

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


---

# Farting Car

**Profile ID:** `farting-car`  
**Portfolio category:** Playful  
**Technical family:** designed  
**Drivetrain mode:** `virtual-transmission`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Comedic pneumatic propulsion with bubbly pressure, gear-linked rhythm and lift-off releases.

## Required motion behavior

load charges pressure; shifts interrupt; lift releases. Use original procedural sonification. Keep speed, torque demand, acceleration and regen as independent controls; never disguise a single pitch ramp as a complete profile.

## Required layers

- low resonator
- pressure pulses
- bubbly turbulence
- release one-shots

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

original synthesized pressure bursts and variants. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

real biological recordings, GT V8 fallback physics, nonstop events.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Upshift, downshift, rev-match/kickdown and redline behavior.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure control independence, spectral centroid, tonal stability, transient count, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Steam Train

**Profile ID:** `steam-train`  
**Portfolio category:** Heritage  
**Technical family:** physical  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Reciprocating steam locomotive with wheel-synchronous chuffs, rods, rail and pressure release.

## Required motion behavior

cadence follows wheel speed; load changes chuff pressure. Model the physical source and its operating regimes. Separate excitation, mechanism, body/resonance and environment layers.

## Required layers

- four-beat chuff
- rod clank
- rail joints
- boiler hiss
- whistle

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

chuff load layers; rods; rail; pressure releases; whistle. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

free-running metronome, constant whistle, flat broadband steam.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure regime transitions, cadence tracking, spectral bands, event plausibility, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Kazoo Kart

**Profile ID:** `kazoo-kart`  
**Portfolio category:** Playful  
**Technical family:** designed  
**Drivetrain mode:** `virtual-transmission`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Tiny high-rev kart voiced through an original kazoo-like resonator.

## Required motion behavior

RPM drives buzz; load changes membrane saturation. Use original procedural sonification. Keep speed, torque demand, acceleration and regen as independent controls; never disguise a single pitch ramp as a complete profile.

## Required layers

- buzz membrane
- small engine pulse
- intake squeak
- shift chirp

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

original buzz loops and comic shift accents. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

GT V8 shift feel, piercing narrowband tone, copyrighted melody.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Upshift, downshift, rev-match/kickdown and redline behavior.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure control independence, spectral centroid, tonal stability, transient count, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Turbine Jet

**Profile ID:** `turbine-jet`  
**Portfolio category:** Aviation  
**Technical family:** physical  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Large turbofan with dominant broadband jet roar and embedded fan/compressor orders.

## Required motion behavior

spool has inertia; demand changes fan/jet balance; lift decays slowly. Model the physical source and its operating regimes. Separate excitation, mechanism, body/resonance and environment layers.

## Required layers

- low jet broadband
- fan broadband
- blade-pass orders
- turbine hiss

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

multi-spool recordings or synthesized fan/jet layers. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

clean whistle dominating roar, instant spool, thin white noise.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure regime transitions, cadence tracking, spectral bands, event plausibility, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Helicopter

**Profile ID:** `helicopter`  
**Portfolio category:** Aviation  
**Technical family:** physical  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Rotorcraft defined by blade-passing slap, turbine/engine bed, gearbox and airframe vibration.

## Required motion behavior

rotor cadence stable; load changes blade slap and turbine strain. Model the physical source and its operating regimes. Separate excitation, mechanism, body/resonance and environment layers.

## Required layers

- main rotor
- tail rotor
- gearbox
- turbine
- downwash

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

rotor perspectives; gearbox; turbine; downwash. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

rotor rate tied directly to road speed, machine-gun chop.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure regime transitions, cadence tracking, spectral bands, event plausibility, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Private Jet

**Profile ID:** `private-jet`  
**Portfolio category:** Aviation  
**Technical family:** physical  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Refined twin-turbofan cabin perspective with smooth spool and controlled air noise.

## Required motion behavior

slow spool inertia; load lifts fan; speed adds aero pressure. Model the physical source and its operating regimes. Separate excitation, mechanism, body/resonance and environment layers.

## Required layers

- fan orders
- pink jet bed
- cabin ventilation
- airframe rumble

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

cabin and exterior fan/jet layers; spool transitions. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

fighter-jet aggression, shrill whistle, instant response.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure regime transitions, cadence tracking, spectral bands, event plausibility, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Oide Wiesn Tractor

**Profile ID:** `wiesn-tractor`  
**Portfolio category:** Heritage  
**Technical family:** physical  
**Drivetrain mode:** `virtual-transmission`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Lanz-style hot-bulb single-cylinder two-stroke with huge separated fires and flywheel inertia.

## Required motion behavior

throttle loads the stroke before cadence rises; 280–650 RPM. Model the physical source and its operating regimes. Separate excitation, mechanism, body/resonance and environment layers.

## Required layers

- single pressure event
- flywheel
- stack chuff
- gear/chassis clatter

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

individual stroke variants; stack; mechanical clatter. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

pitched-down diesel car, fast RPM response, dense firing.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Upshift, downshift, rev-match/kickdown and redline behavior.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure regime transitions, cadence tracking, spectral bands, event plausibility, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Open Wind

**Profile ID:** `open-wind`  
**Portfolio category:** Nature  
**Technical family:** environmental  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Calm aerodynamic air shaped by motion with no engine core.

## Required motion behavior

speed controls bands; acceleration changes pressure; lift sighs. Use state machines, hysteresis and contextual events. Permit quiet passages. Do not map speed directly to pitch unless the physical source requires it.

## Required layers

- low body air
- mid rush
- high edge
- gust modulation

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

multi-band wind recordings or procedural filtered noise. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

flat white noise, random storm events, tonal motor.

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


---

# Storm Glider

**Profile ID:** `storm-glider`  
**Portfolio category:** Nature  
**Technical family:** environmental  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Weather-charged motion with layered gusts, pressure drops and distant thunder.

## Required motion behavior

motion shapes wind; jerk triggers gust edges; thunder remains rare. Use state machines, hysteresis and contextual events. Permit quiet passages. Do not map speed directly to pitch unless the physical source requires it.

## Required layers

- gust bands
- rain edge
- pressure rumble
- thunder events

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

wind intensity layers; original thunder variants. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

constant thunder, random loud surprises, clipped sub energy.

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


---

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


---

# American Muscle V8

**Profile ID:** `american-muscle-v8`  
**Portfolio category:** Classic  
**Technical family:** combustion  
**Drivetrain mode:** `virtual-transmission`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Heavy cross-plane V8 lope, exhaust-dominant load and long overrun burble.

## Required motion behavior

slow inertia; full load opens exhaust; lift produces gated burble. Use deterministic RPM, load, gear, shift phase and overrun. Firing frequency follows four-stroke physics unless the profile explicitly specifies otherwise.

## Required layers

- uneven strong/weak pulse
- low exhaust formants
- body shake

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

idle lope; load loops; overrun variants; lazy shift thump. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

smooth GT V8 polish, high-rev V10 brightness, constant pops.

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


---

# Turbo Inline-6

**Profile ID:** `turbo-inline-6`  
**Portfolio category:** Classic  
**Technical family:** combustion  
**Drivetrain mode:** `virtual-transmission`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Smooth even six with deep midrange, progressive boost and elastic response.

## Required motion behavior

boost lags load; flutter only after boost; seven-speed behavior. Use deterministic RPM, load, gear, shift phase and overrun. Firing frequency follows four-stroke physics unless the profile explicitly specifies otherwise.

## Required layers

- even-six pulse
- intake
- boost spool
- wastegate
- flutter

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

RPM/load matrix; spool bed; wastegate and flutter variants. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

V8 subharmonic, constant whistle/flutter, instant boost.

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


---

# Synthetic Hyper EV

**Profile ID:** `electric-hypercar`  
**Portfolio category:** Future  
**Technical family:** designed  
**Drivetrain mode:** `virtual-transmission`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Fictional multi-speed hyper-EV with motor orders, inverter energy and deliberate virtual shifts.

## Required motion behavior

torque controls brightness; motor RPM follows ratios; regen distinct. Use original procedural sonification. Keep speed, torque demand, acceleration and regen as independent controls; never disguise a single pitch ramp as a complete profile.

## Required layers

- motor orders
- inverter cluster
- reduction gear
- torque pulse

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

original motor/inverter layers and shift transients. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

combustion artifacts, exhaust cues, arbitrary shift noise.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Upshift, downshift, rev-match/kickdown and redline behavior.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure control independence, spectral centroid, tonal stability, transient count, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Formula Electric

**Profile ID:** `formula-electric`  
**Portfolio category:** Motorsport  
**Technical family:** designed  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Competition EV with technical motor whine, inverter clusters, reduction gear and aero.

## Required motion behavior

torque demand and motor speed remain independent dimensions. Use original procedural sonification. Keep speed, torque demand, acceleration and regen as independent controls; never disguise a single pitch ramp as a complete profile.

## Required layers

- motor orders
- inverter sidebands
- gear mesh
- tire/aero

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

motor/inverter/gear layers; curb/tire accents optional. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

road-EV softness, combustion shifts, single sine sweep.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure control independence, spectral centroid, tonal stability, transient count, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Neon Drive

**Profile ID:** `neon-drive`  
**Portfolio category:** Future  
**Technical family:** musical  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Night-drive electronic environment with original harmonic tension and motion-locked pulse.

## Required motion behavior

tempo subdivision follows motion bands; harmony follows intensity. Use an original musical grammar synchronized to motion. Constrain harmony, tempo bands and event density to prevent fatigue and avoid any recognizable borrowed melody.

## Required layers

- pad
- bass pulse
- restrained arpeggio
- transition shimmer

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

original stems designed for adaptive looping. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

recognizable song melody, busy constant beat, engine metaphor.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure tempo/state stability, note density, repetition, headroom, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Maglev Train

**Profile ID:** `maglev-train`  
**Portfolio category:** Machines  
**Technical family:** physical  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Frictionless linear propulsion, guideway electromagnetic hum and high-speed pressure.

## Required motion behavior

speed raises aero and guideway rate; load changes motor intensity. Model the physical source and its operating regimes. Separate excitation, mechanism, body/resonance and environment layers.

## Required layers

- linear motor orders
- guideway modulation
- aero
- cabin resonance

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

linear motor and aero beds; pass-by pressure accents. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

rail clatter, combustion, wheel squeal during normal glide.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure regime transitions, cadence tracking, spectral bands, event plausibility, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# High-Speed Train

**Profile ID:** `high-speed-train`  
**Portfolio category:** Machines  
**Technical family:** physical  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Electric traction, wheel/rail resonance and progressive aerodynamic rush.

## Required motion behavior

speed changes rail/aero; load changes traction; joints spatially sparse. Model the physical source and its operating regimes. Separate excitation, mechanism, body/resonance and environment layers.

## Required layers

- traction motor
- gear
- rail singing
- sparse joints
- aero

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

traction layers; rail loops; joint variants; aero beds. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

steam chuff, constant joint clack, maglev silence.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure regime transitions, cadence tracking, spectral bands, event plausibility, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Submarine

**Profile ID:** `submarine`  
**Portfolio category:** Future  
**Technical family:** physical  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Pressurized hull interior with electric propulsion, water flow and rare original sonar.

## Required motion behavior

load raises propulsion; speed raises flow; pressure events remain rare. Model the physical source and its operating regimes. Separate excitation, mechanism, body/resonance and environment layers.

## Required layers

- electric motor
- propeller
- hull creak
- water pressure
- sonar

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

motor/prop beds; hull creaks; original sonar ping. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

movie sonar cliché repetition, ship horn, excessive reverb.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure regime transitions, cadence tracking, spectral bands, event plausibility, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Jet Ski

**Profile ID:** `jet-ski`  
**Portfolio category:** Nautical  
**Technical family:** physical  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Compact high-rev watercraft with impeller cavitation, spray and hull slap.

## Required motion behavior

throttle drives RPM/load; speed selects water regime; jerk drives slap. Model the physical source and its operating regimes. Separate excitation, mechanism, body/resonance and environment layers.

## Required layers

- engine/excitation
- impeller
- cavitation
- spray
- hull slap

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

engine loads; impeller/cavitation layers; slap variants. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

speedboat low-RPM mass, endless spray hiss.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure regime transitions, cadence tracking, spectral bands, event plausibility, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Motorcycle Superbike

**Profile ID:** `motorcycle-superbike`  
**Portfolio category:** Motorsport  
**Technical family:** combustion  
**Drivetrain mode:** `virtual-transmission`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Exposed high-rev inline-four with immediate throttle, intake stacks and lightning shifts.

## Required motion behavior

very fast RPM; load opens intake; 55 ms-style shifts. Use deterministic RPM, load, gear, shift phase and overrun. Firing frequency follows four-stroke physics unless the profile explicitly specifies otherwise.

## Required layers

- even I4 firing
- intake stacks
- exhaust rasp
- chain/gear

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

high-RPM/load anchors; intake/exhaust; shift cuts. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

V-twin lope, car-cabin muffling, slow inertia.

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


---

# Big Twin

**Profile ID:** `big-twin`  
**Portfolio category:** Classic  
**Technical family:** combustion  
**Drivetrain mode:** `virtual-transmission`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Large V-twin with separated uneven pulses, flywheel mass and long rhythmic overrun.

## Required motion behavior

lazy RPM; heavy load pulses; lift creates long gated decay. Use deterministic RPM, load, gear, shift phase and overrun. Firing frequency follows four-stroke physics unless the profile explicitly specifies otherwise.

## Required layers

- uneven twin pulse
- mid body
- exhaust
- mechanical tick

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

idle/load loops; overrun; lazy shifts. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

inline-four smoothness, excessive redline, random backfire.

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


---

# Snowmobile

**Profile ID:** `snowmobile`  
**Portfolio category:** Machines  
**Technical family:** physical  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Crisp two-stroke with CVT belt whine, track cadence and soft snow spray.

## Required motion behavior

engine RPM responds to load/CVT more than road speed; track follows speed. Model the physical source and its operating regimes. Separate excitation, mechanism, body/resonance and environment layers.

## Required layers

- two-stroke buzz
- CVT
- track
- snow

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

engine/CVT matrix; track and snow beds. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

gear shifts, four-stroke bass, white-noise snow.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure regime transitions, cadence tracking, spectral bands, event plausibility, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Tank

**Profile ID:** `tank`  
**Portfolio category:** Machines  
**Technical family:** physical  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Heavy tracked machine: low diesel load, track links, drivetrain whine and hull resonance.

## Required motion behavior

load changes diesel strain; speed changes track rate; turns may bias sides. Model the physical source and its operating regimes. Separate excitation, mechanism, body/resonance and environment layers.

## Required layers

- diesel orders
- track cadence
- sprocket
- hull
- drivetrain

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

diesel load loops; track/sprocket variants; hull resonance. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

weapons/combat audio, cinematic booms, clipping sub-bass.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure regime transitions, cadence tracking, spectral bands, event plausibility, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Construction Monster

**Profile ID:** `construction-monster`  
**Portfolio category:** Machines  
**Technical family:** physical  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Industrial diesel under hydraulic load with pumps, cooling and structural strain.

## Required motion behavior

driver demand loads hydraulics before speed; jerk can trigger restrained clunk. Model the physical source and its operating regimes. Separate excitation, mechanism, body/resonance and environment layers.

## Required layers

- diesel
- hydraulic pump
- fan
- metal
- chassis

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

diesel loads; hydraulic beds; metal strain variants. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

tank tracks by default, alarms, random impacts.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure regime transitions, cadence tracking, spectral bands, event plausibility, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Horse Gallop

**Profile ID:** `horse-gallop`  
**Portfolio category:** Heritage  
**Technical family:** environmental  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Pure horse locomotion with believable walk, trot, canter and gallop transitions.

## Required motion behavior

discrete gait state with hysteresis; acceleration changes effort. Use state machines, hysteresis and contextual events. Permit quiet passages. Do not map speed directly to pitch unless the physical source requires it.

## Required layers

- hoof gait engine
- breath
- tack
- ground surface

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

multi-surface gait sets; breath and tack variants. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

pitch-shifted single loop, carriage sounds, impossible instant gait changes.

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


---

# Dragon

**Profile ID:** `dragon`  
**Portfolio category:** Future  
**Technical family:** environmental  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Original mythic creature made from breath, wing air, body resonance and rare roar.

## Required motion behavior

speed/load map to wing effort and breath; roar is contextual and rare. Use state machines, hysteresis and contextual events. Permit quiet passages. Do not map speed directly to pitch unless the physical source requires it.

## Required layers

- breathing
- wing strokes
- chest resonance
- scale movement
- roar

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

original designed creature layers and licensed performers. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

recognizable film creature, constant roar, animal distress samples.

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


---

# Thunder Beast

**Profile ID:** `thunder-beast`  
**Portfolio category:** Future  
**Technical family:** environmental  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Dark hybrid of creature mass, pressure wave and weather with premium restraint.

## Required motion behavior

acceleration raises effort; jerk triggers weight; weather evolves slowly. Use state machines, hysteresis and contextual events. Permit quiet passages. Do not map speed directly to pitch unless the physical source requires it.

## Required layers

- body pulse
- breath
- pressure
- distant storm
- footfall

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

original body/breath/weather layers. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

dragon clone, random thunder, jump scares.

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


---

# Retro Arcade

**Profile ID:** `retro-arcade`  
**Portfolio category:** Musical  
**Technical family:** musical  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Original console-inspired motion sonification using constrained square, triangle and noise voices.

## Required motion behavior

speed quantizes register; acceleration triggers notes; regen resolves. Use an original musical grammar synchronized to motion. Constrain harmony, tempo bands and event density to prevent fatigue and avoid any recognizable borrowed melody.

## Required layers

- square lead
- triangle bass
- noise percussion
- event chirps

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

procedural only or original stems. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

borrowed game melodies, uncontrolled arpeggios, harsh aliasing.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure tempo/state stability, note density, repetition, headroom, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Synthwave Drive

**Profile ID:** `synthwave-drive`  
**Portfolio category:** Musical  
**Technical family:** musical  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Original restrained synthwave atmosphere with warm pad, bass pulse and light arpeggio.

## Required motion behavior

motion selects energy states; no abrupt tempo jumps. Use an original musical grammar synchronized to motion. Constrain harmony, tempo bands and event density to prevent fatigue and avoid any recognizable borrowed melody.

## Required layers

- pad
- bass
- arpeggio
- noise air
- transitions

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

original adaptive stems and one-shots. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

copyrighted melody, full song masking motion, excessive sidechain.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure tempo/state stability, note density, repetition, headroom, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Deep Bass Pulse

**Profile ID:** `deep-bass-pulse`  
**Portfolio category:** Musical  
**Technical family:** musical  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Physical cabin-safe bass pulse whose cadence and envelope follow driving intensity.

## Required motion behavior

intensity changes cadence and weight; regen relaxes. Use an original musical grammar synchronized to motion. Constrain harmony, tempo bands and event density to prevent fatigue and avoid any recognizable borrowed melody.

## Required layers

- sub fundamental
- upper harmonic audibility
- pulse envelope
- click control

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

procedural preferred; optional calibrated bass impacts. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

inaudible-only sub, limiter pumping, unsafe peaks.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure tempo/state stability, note density, repetition, headroom, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Zen Drive

**Profile ID:** `zen-drive`  
**Portfolio category:** Nature  
**Technical family:** environmental  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Calm breath-like motion with soft air, resonant warmth and rare original chimes.

## Required motion behavior

speed opens air gently; acceleration deepens breath; silence is allowed. Use state machines, hysteresis and contextual events. Permit quiet passages. Do not map speed directly to pitch unless the physical source requires it.

## Required layers

- breath air
- warm resonance
- natural texture
- chime

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

original chimes and natural ambience. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

spa cliché loop, constant chimes, musical melody.

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


---

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


---

# Ocean Drive

**Profile ID:** `ocean-drive`  
**Portfolio category:** Nature  
**Technical family:** environmental  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Ocean-inspired driving ambience of swell, foam and coastal air—not a boat simulation.

## Required motion behavior

motion controls swell energy and air; regen recedes. Use state machines, hysteresis and contextual events. Permit quiet passages. Do not map speed directly to pitch unless the physical source requires it.

## Required layers

- slow swell
- foam
- wind
- distant water detail

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

ocean intensity beds and foam variants. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

boat motor, seagull cliché, literal wave loop repetition.

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


---

# Heartbeat

**Profile ID:** `heartbeat`  
**Portfolio category:** Musical  
**Technical family:** musical  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Intimate two-part heartbeat mapped to driving intensity rather than speed alone.

## Required motion behavior

intensity and jerk affect rate/force with physiological smoothing. Use an original musical grammar synchronized to motion. Constrain harmony, tempo bands and event density to prevent fatigue and avoid any recognizable borrowed melody.

## Required layers

- lub-dub pair
- body resonance
- breath
- subtle stress harmonics

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

procedural pulse or commissioned body-safe impacts. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

alarm-like tachycardia, medical realism claims, unsafe sub peaks.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure tempo/state stability, note density, repetition, headroom, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Cinematic Rock

**Profile ID:** `symphony-cinematic-rock`  
**Portfolio category:** Musical  
**Technical family:** musical  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Original adaptive cinematic-rock arrangement whose drums, bass, harmony and intensity follow the drive.

## Required motion behavior

motion energy selects arrangement state; acceleration adds impact; regen releases tension. Use an original musical grammar synchronized to motion. Constrain harmony, tempo bands and event density to prevent fatigue and avoid any recognizable borrowed melody.

## Required layers

- drums
- bass
- harmonic bed
- lead texture
- transitions

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

original adaptive stems and transition one-shots. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

recognizable songs or riffs, wall-to-wall maximum intensity, random transitions.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure tempo/state stability, note density, repetition, headroom, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Motion Orchestra

**Profile ID:** `symphony-motion-orchestra`  
**Portfolio category:** Musical  
**Technical family:** musical  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Original orchestral motion language that grows from sparse pulse to full kinetic arrangement.

## Required motion behavior

speed and demand control orchestration density; jerk triggers restrained accents. Use an original musical grammar synchronized to motion. Constrain harmony, tempo bands and event density to prevent fatigue and avoid any recognizable borrowed melody.

## Required layers

- low strings
- ostinato
- brass/impact
- high texture
- room

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

original sectional stems and deterministic transition cues. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

borrowed film themes, constant trailer impacts, unrealistic instrument ranges.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure tempo/state stability, note density, repetition, headroom, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Neon Run

**Profile ID:** `symphony-neon-run`  
**Portfolio category:** Musical  
**Technical family:** musical  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Original electronic night-drive score with pulse, bass, pad and controlled harmonic lift.

## Required motion behavior

motion energy controls subdivision and density; regen simplifies and resolves. Use an original musical grammar synchronized to motion. Constrain harmony, tempo bands and event density to prevent fatigue and avoid any recognizable borrowed melody.

## Required layers

- electronic pulse
- bass
- pad
- arpeggio
- shimmer

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

original adaptive electronic stems. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

recognizable synthwave melody, excessive high-frequency sparkle, tempo flutter.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure tempo/state stability, note density, repetition, headroom, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Space Drive

**Profile ID:** `world-space-drive`  
**Portfolio category:** Future  
**Technical family:** designed  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Reactive fictional space environment with propulsion, hull, field energy and spatial events.

## Required motion behavior

motion changes propulsion and field pressure; events remain deterministic and sparse. Use original procedural sonification. Keep speed, torque demand, acceleration and regen as independent controls; never disguise a single pitch ramp as a complete profile.

## Required layers

- propulsion bed
- hull
- field harmonics
- spatial pass-bys
- events

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

original world textures and event one-shots. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

generic spaceship loop, copied franchise cues, nonstop beeps.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure control independence, spectral centroid, tonal stability, transient count, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Cyber City

**Profile ID:** `world-cyber-city`  
**Portfolio category:** Future  
**Technical family:** designed  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Reactive cyber-city world combining vehicle motion with distant infrastructure, energy and urban signals.

## Required motion behavior

speed opens urban flow; acceleration raises energy; stop retains distant city life. Use original procedural sonification. Keep speed, torque demand, acceleration and regen as independent controls; never disguise a single pitch ramp as a complete profile.

## Required layers

- motion bed
- city infrastructure
- electronic signage
- pass-bys
- events

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

original city/electronic textures and pass-by events. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

police sirens by default, recognizable game ambience, random clutter.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure control independence, spectral centroid, tonal stability, transient count, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Storm Run

**Profile ID:** `world-storm-run`  
**Portfolio category:** Nature  
**Technical family:** environmental  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Reactive storm world with wind pressure, rain, distant thunder and motion-carved shelter.

## Required motion behavior

motion controls exposure and spray; thunder is sparse; stopping reveals rain detail. Use state machines, hysteresis and contextual events. Permit quiet passages. Do not map speed directly to pitch unless the physical source requires it.

## Required layers

- wind
- rain
- pressure
- thunder
- surface

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

original weather layers and thunder variants. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

constant thunder, jump scares, flat hiss, duplicate Storm Glider identity.

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


---

# Road Anthem

**Profile ID:** `fusion-road-anthem`  
**Portfolio category:** Musical  
**Technical family:** fusion  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

GT V8 machine character integrated with original cinematic rock as one controlled mix.

## Required motion behavior

machine stays present under demand; music creates space during shifts and strong engine moments. Use one AudioContext and preserve intelligibility between machine and music buses. Motion must govern both parts coherently; dynamic space is preferable to constant ducking.

## Required layers

- GT V8 machine bus
- cinematic-rock music bus
- shared events
- harmonic resonance

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

reuse licensed/original component assets through a single AudioContext. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

two unrelated tracks fighting, permanent sidechain pumping, masked engine feedback.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure machine/music masking, bus gains, harmonic coupling, transition timing, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Mechanical Symphony

**Profile ID:** `fusion-mechanical-symphony`  
**Portfolio category:** Musical  
**Technical family:** fusion  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Flat-Six precision woven into an original motion orchestra with shared harmonic movement.

## Required motion behavior

engine leads response; orchestra follows energy; shifts create arranged space. Use one AudioContext and preserve intelligibility between machine and music buses. Motion must govern both parts coherently; dynamic space is preferable to constant ducking.

## Required layers

- flat-six machine bus
- orchestra bus
- shared resonance
- transition events

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

reuse approved machine and symphony assets. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

engine and orchestra masking, copied film language, uncontrolled resonance.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure machine/music masking, bus gains, harmonic coupling, transition timing, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Midnight Boost

**Profile ID:** `fusion-midnight-boost`  
**Portfolio category:** Musical  
**Technical family:** fusion  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Turbo Inline-6 character fused with Neon Run while preserving boost and lift-off intelligibility.

## Required motion behavior

boost remains audible under music; lift-off simplifies mix and exposes release. Use one AudioContext and preserve intelligibility between machine and music buses. Motion must govern both parts coherently; dynamic space is preferable to constant ducking.

## Required layers

- turbo I6 machine bus
- neon music bus
- boost-linked resonance
- shared events

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

reuse approved I6 and Neon assets. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

constant flutter, bass masking engine midrange, excessive pumping.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure machine/music masking, bus gains, harmonic coupling, transition timing, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Future Pulse

**Profile ID:** `fusion-future-pulse`  
**Portfolio category:** Musical  
**Technical family:** fusion  
**Drivetrain mode:** `continuous`  
**Status:** Target specification for ELCAMOSO calibration; preserve the public ID for settings and saved Garage compatibility.

## Product promise

Synthetic Hyper EV fused with Neon Run as a coherent futuristic motion instrument.

## Required motion behavior

torque controls machine presence; music follows energy; regen changes both coherently. Use one AudioContext and preserve intelligibility between machine and music buses. Motion must govern both parts coherently; dynamic space is preferable to constant ducking.

## Required layers

- hyper-EV machine bus
- neon music bus
- harmonic coupling
- transitions

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

reuse approved EV and Neon assets. Any sample must have a manifest containing source, commercial rights, app-embedding permission, attribution, RPM/load or state metadata, and SHA-256 hashes. The procedural fallback must remain functional when samples are absent.

## Must not sound like

combustion cues, arbitrary musical cuts, indistinct machine feedback.

## Acceptance scenarios

1. Idle/stopped or minimum-energy state for 15 seconds.
2. Low, medium and high driver demand at identical road speed.
3. Gentle acceleration, hard acceleration, lift/regen and stop.
4. Continuous rise, sustained cruise and release without artificial gear events.
5. Sixty-second steady-state fatigue and repetition test.
6. Tesla-browser road test at fixed vehicle volume and EQ.

## Automated assertions

Measure machine/music masking, bus gains, harmonic coupling, transition timing, LUFS and true peak. Assert no NaN/Infinity, no clipping, no DC offset, stable node count, bounded event rate and deterministic output for a fixed seed. Compare against the nearest portfolio neighbors, not only against its own golden file.

## Definition of done

- The sound fulfills the product promise in blind listening.
- Fixed-speed low and high demand are audibly different for the right physical/musical reason.
- It remains recognizable after loudness matching within ±1 LU.
- No prominent loop seams, backend leaks, duplicate AudioContexts or profile-switch spikes.
- Ten-minute Tesla test produces no severe fatigue or browser underruns.
- Documentation, profile recipe, regression reference and changelog are updated together.


---

# Comprehensive Cursor Prompts — ELCAMOSO Sound Profiles

Run these prompts one at a time on a clean branch. After every prompt, review the diff, run the requested tests and commit only a working state. Cursor must read `AGENTS.md`, `elcamoso-comprehensive-spec.md`, `docs/MEMORY_BANK_AND_CHANGELOG.md`, `docs/AUDIO_REALISM_V2.md`, `docs/SOUND_CHARACTER_SPEC.md` and this package before editing. Preserve unrelated work and never rewrite published history.

## Prompt 1 — Audit and implementation map

> Audit the ELCAMOSO audio paths without changing production code. Map all 57 currently assembled Sound Profile IDs (47 core, 3 Symphony, 3 World and 4 Fusion) to catalog definition, realism family, strategy/backend, drivetrain personality, loudness trim, Dynamic Drive support, Realism V2 eligibility, regression coverage and missing/fallback behavior. Compare the result with `docs/sound-profiles/INDEX.md`. Write `docs/SOUND_PROFILE_IMPLEMENTATION_AUDIT.md`. Highlight shared fallbacks that weaken identity, especially Racing V10/Race Car sharing Flat-Six behavior and playful profiles inheriting GT V8 behavior. Include a dependency graph and prioritized gaps. Run typecheck and tests to establish a baseline.

## Prompt 2 — Typed acoustic schema

> Add a typed `AcousticProfileSpec` model under `src/lib/sound/profile-specs` without changing audible output. It must represent family, layers, control mappings, RPM/load or regime states, DSP parameters, event gates/cooldowns, loudness/headroom limits, optional sample banks and acceptance metadata. Add runtime validation with safe fallbacks and tests for all 47 IDs. Keep `SoundProfile` as the stable catalog entity and do not parse Markdown at runtime. Export `getAcousticProfileSpec(id)`. Update the comprehensive product spec and changelog.

## Prompt 3 — Diagnostics before tuning

> Instrument the active audio backend so dev diagnostics show selected backend, profile ID, AudioContext state, effective gain product, layer gains, pre/post limiter peak, approximate RMS/short-term loudness, limiter reduction, active-node estimate, underrun/stall indicators, RPM/load/gear/shift phase and event cooldown state. Keep diagnostics dev-only and cheap when disabled. Add tests proving one AudioContext, bounded nodes and clean disposal across 50 profile switches. Do not raise master gain in this prompt.

## Prompt 4 — Offline scenario renderer

> Extend the Node-safe regression system to render deterministic scenarios for every compatible profile: stopped/idle, low/medium/high demand at equal speed, gentle/hard acceleration, cruise, lift/regen, and profile-specific shift/regime events. Produce metrics for band energy, spectral centroid, crest factor, approximate LUFS/RMS, peak, DC offset, event count and render determinism. Store compact JSON references, not large PCM files. Add a command that reports nearest-neighbor similarity warnings without automatically failing all legacy profiles.

## Prompt 5 — Combustion identities

> Implement distinct typed acoustic recipes for GT V8, American Muscle V8, Flat-Six Sport, Turbo Inline-6, Racing V10, Race Car, Rally Car, Motorcycle Superbike, Big Twin and Oide Wiesn Tractor. Use the individual Markdown files as acceptance requirements. Racing V10 must receive its own V10 personality instead of Flat-Six inheritance; Race Car must be configurable independently. Preserve Realism V2 hybrid/sample hooks and the procedural fallback. At identical RPM, load must alter pulse pressure, intake/exhaust balance and spectral tilt—not only gain. Add closest-neighbor assertions and loudness-match previews before updating golden references.

## Prompt 6 — Powertrain personalities and shifts

> Create or refine dedicated deterministic drivetrain personalities for Racing V10, Race Car and playful virtual-transmission profiles where the GT V8 fallback is inappropriate. Keep RPM/gear authoritative in the PowertrainSimulator. Model torque cut, disengage, ratio transition, re-engagement and settle; the primary shift cue must be RPM/load interruption, with restrained accents. Add tests for no impossible RPM jumps, correct kickdown, bounded shift frequency and state-consistent transients.

## Prompt 7 — EV and designed future profiles

> Implement distinct designs for Cyber Pulse, Synthetic Hyper EV, Formula Electric, Neon Drive, Space Ship, UFO, World Space Drive and World Cyber City. Keep torque/load, motor speed, road speed, acceleration and regen independently controllable. Synthetic Hyper EV may use deliberate virtual shifts; Formula Electric and Cyber Pulse must remain continuous. No combustion impulses or exhaust effects. Add identity tests across the EV trio and verify that regen is audibly distinct from simple volume reduction.

## Prompt 8 — Aviation, nautical and machines

> Implement physically structured strategies for Turbine Jet, Private Jet, Helicopter, Speed Boat, Cruise Ship, Jet Ski, Steam Train, Maglev Train, High-Speed Train, Snowmobile, Tank and Construction Monster. Use excitation → mechanism → body/resonance → environment. Implement regime/state transitions with hysteresis: boat displacement/cavitation/planing, jet spool inertia, helicopter stable rotor cadence, train traction/aero balance, snowmobile engine/CVT/track separation. Prevent generic filtered-noise beds from dominating. Add transition and fatigue tests.

## Prompt 9 — Environmental, heritage and creature profiles

> Implement Open Wind, Storm Glider, World Storm Run, Rain Drive, Ocean Drive, Zen Drive, Wild West Carriage, Romanian '85 Carriage, Horse Gallop, Dragon and Thunder Beast from their Markdown specs. Build explicit gait/weather/effort state machines with hysteresis and deterministic seeded variation. Allow quiet passages. Enforce event-density ceilings and cooldowns. Romanian '85 Carriage must be a single-horse village cart and remain distinct from the four-beat Wild West carriage and carriage-free Horse Gallop. Do not use recognizable film creature cues.

## Prompt 10 — Musical and playful profiles

> Implement Retro Arcade, Synthwave Drive, Deep Bass Pulse, Heartbeat, Santa Sleigh, Laughing Machine, Farting Car and Kazoo Kart as original motion instruments. Also implement the three Symphony profiles and four Fusion profiles using one AudioContext, deterministic arrangements, clear machine/music bus separation, harmonic coupling and dynamic space instead of permanent ducking. Use constrained musical grammars and deterministic event scheduling; do not introduce recognizable melodies. Add bass safety/headroom checks, laughter/event cooldowns and profile-specific virtual mechanics for Farting Car and Kazoo Kart rather than GT V8 fallback behavior. Preserve accessibility and avoid startling events.

## Prompt 11 — Sample-bank infrastructure

> Complete the optional sample-bank pipeline described in AUDIO_REALISM_V2. Define manifests with license provenance, hashes, RPM/load/state tags, loop points, loudness, true peak and channel/perspective metadata. Implement adjacent RPM and load crossfades with playback rate clamped approximately 0.85–1.18. Decode/cache outside the render loop, handle missing/failed assets gracefully and keep premium assets out of public paths where required. Add tests using tiny generated fixtures; do not add unlicensed media.

## Prompt 12 — Loudness and Tesla calibration

> Build a calibration workflow that loudness-matches profile auditions within approximately ±1 LU while preserving 3–6 dB dynamic contrast between cruise and hard demand. Diagnose the existing MAX_GAIN, intensity ceiling, profile trim, layer gains, cabin EQ and limiter interaction. Add a Tesla calibration preset and a repeatable road-test checklist; do not silently change the user's vehicle EQ. Reject inaudible sub energy that only consumes limiter headroom. Update trims from measured renders, then verify limiter reduction remains restrained.

## Prompt 13 — Portfolio acceptance gate

> Create a release report for all 57 currently assembled profiles. For each profile list implementation status, backend, unique identity, missing assets, metric results, nearest-neighbor separation, 60-second fatigue result and Tesla status. Fail CI only for hard safety/lifecycle defects initially; emit actionable warnings for identity targets until each family is calibrated. Add a command to promote a profile from experimental to calibrated after its regression reference and listening checklist are approved.

## Prompt 14 — Documentation and product consistency

> Reconcile the implemented profile behavior with every Markdown file, the 47-profile catalog, product spec and changelog. Preserve public names/IDs unless a migration is intentionally added. Ensure user-facing copy says Sound Profile, Motion and character—not oscillator, fusion internals or DSP jargon. Confirm no OEM branding or claims of exact vehicle reproduction. Run formatting, typecheck, unit tests, audio regression and production build; summarize any remaining manual Tesla tests.
