# Turbine Jet (Fighter Jet)

> **Nov 2026 (George): Fighter Jet.** Name and id unchanged (`turbine-jet`, "Turbine Jet").
> Sound = Rocket Car while moving, unchanged and +1.5 dB (`SOUND_ALIASES` in
> `src/lib/sound/engine.ts`), in the same airfield frame as Private Jet Oberpfaffenhofen
> (`src/lib/sound/private-jet/fighter-jet.ts`):
> - parked: this profile's own turbofan idle (the spec below, same level as before) plus snappy
>   control-surface checks (short aileron twitches, some flap runs) every 7-12 s; no Rocket Car idle;
> - moving: equal-power crossfade to Rocket Car (full from 12 km/h or on a launch);
> - take-off (strong launch from below 30 km/h): afterburner light (deep thump + burst) and a
>   flickering reheat roar, plus a 2.6-5.5 kHz turbine scream that climbs with speed; both fade
>   on lift-off or once the pull settles into cruise.
> The parked idle runs on its own random stream so Rocket Car plays exactly as on its own.
> The specification below now describes the parked idle only.

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
