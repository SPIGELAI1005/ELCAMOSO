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

## Runtime vs package technical family

The **Family** column above is package design intent. Runtime routing uses `familyForProfile()` in `src/lib/sound/realism/families.ts`. Three IDs currently disagree (`neon-drive`, `dragon`, `thunder-beast`). Runtime assignments are preserved because changing them alters motion envelopes. Details: `docs/FAMILY_CLASSIFICATION_MISMATCHES.md`. Typed specs expose both via `AcousticProfileSpec.family` (runtime) and `AcousticProfileSpec.packageFamily` (this table).

## Recommended typed model

`SoundProfile` remains the stable product/catalog entity. `AcousticProfileSpec` under `src/lib/sound/profile-specs` is keyed by the same ID and holds family (runtime), packageFamily (design intent), layer plan, control curves, DSP parameters, event gates, loudness limits, optional sample-bank hooks and acceptance metadata. Resolve it for validation and future backends; do not parse Markdown at runtime. Do not let `packageFamily` drive audible routing until a dedicated sound-improvement prompt realigns `families.ts`.

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
