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
