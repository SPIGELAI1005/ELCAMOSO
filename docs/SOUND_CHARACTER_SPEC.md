# ELCAMOSO — Sound Character Specification

**Purpose:** Long-term driving engagement. The same Sound Profile should feel subtly different drive to drive because sound emerges from **driving behavior**, not random effects.

**Last updated:** 2026-09-17

**Related:** `docs/audio-asset-requirements.md`, `docs/drivetrain-personalities.md`, `docs/DYNAMIC_DRIVE_ARCHITECTURE.md`, `docs/AUDIO_REALISM_V2.md`

---

## 1. Problem and objective

A continuous procedural sound impresses for minutes, then the ear learns the envelope. ELCAMOSO must keep interest through **state-linked expression**:

| Must hear at identical road speed | Mechanism |
| --------------------------------- | --------- |
| 80 km/h cruise vs 80 km/h hard accel | `load`, `throttle`, `accelerationMs2` → RPM hold/climb, gear, high-load layer |
| 60 km/h Gear 3 vs Gear 5 | Gear ratios → different RPM (~40–70% delta) → different harmonic bands |
| Lift-off vs steady throttle | `overrun` entry, exhaust-pop gates, turbo flutter (turbo) |
| Kickdown vs gentle tip-in | Downshift steps, rev-match, load surge |

**Rules**

- **Deterministic drivetrain** — never random RPM, gear, or speed.
- **Expressive audio** — variant pick, timing jitter (±12–14% intensity), cooldown-gated probability within state bounds.
- **No decoupled random** — every transient requires shift phase, load delta, overrun entry, or prior-throttle gate.
- **Restraint** — target ≤ 1 meaningful transient / 8–15 s in normal city driving (personality defaults).

### Realism V2 (combustion)

For GT V8 / American Muscle / Flat-Six / Turbo I6 / Racing V10 / Race Car / Rally Car, prefer **`HybridCombustionSynth`** (dev A/B: Current vs Realism V2) over sawtooth-dominant stacks. See `docs/AUDIO_REALISM_V2.md`. Do not treat oscillator EQ as the realism path.
---

## 2. Asset and path reality (2026-08-29)

| Fact | Detail |
| ---- | ------ |
| **Sample library** | **None shipped.** `public/` has no engine `.wav` assets. All 47 profiles are procedural Web Audio. |
| **Motion-matched path** | `settings.dynamicDrive` + virtual-transmission profile → `PowertrainSimulator` + `DynamicDriveSynth`. |
| **Legacy path** | `computeDriveState` + Improved synth — same profiles, no gear/RPM separation at equal speed. |
| **Personalities** | **8** configs in `drivetrain-personalities.ts`: `flat-six-sport`, `american-v8`, `turbo-inline-6`, `gt-v8`, `synthetic-ev`, `motorcycle-inline-4`, `v-twin-cruiser`, `single-cylinder-ag`. |
| **Variant pools** | Per-personality procedural shapes via `resolveVariantPools()` — sample filenames reserved in asset doc. |
| **Continuous load proxy** | `computeSyntheticLoad()` in `motion.ts` — throttle + accel + jerk for profiles without gears. |

Recorded assets would **materially** improve shift/overrun/turbo identity; procedural fallbacks remain until then.

---

## 3. Driving scenario matrix

Behavior when **Motion-matched sound** is on and fusion is healthy. ✓ = audible differentiation today; ~ = partial; ✗ = weak.

| Scenario | Powertrain (deterministic) | Dynamic Drive audio | Legacy / continuous |
| -------- | -------------------------- | ------------------- | ------------------- |
| **Idle / start** | N/P, idle RPM | `dd-idle` band; strategy idle layers | ✓ idle timbre |
| **Gentle launch** | Rising load, short gear hold | Low→mid bands; soft upshift if prob | ~ speed-only on continuous |
| **Hard launch** | High load, fast upshifts | `dd-high-load` + upshift variant | ✓ load on DD |
| **City acceleration** | Frequent upshifts, rev-match prep | Shift + rev-match transients | ✓ DD; ~ legacy |
| **Steady city cruise** | Stable gear, load 0.15–0.35 | Mid band steady; few transients | **~ monotone** — main fatigue risk |
| **Lift-off** | Overrun, throttle→0 | Overrun + exhaust-pop (NA) | ✓ NA/V8; ✗ EV |
| **Braking** | Load drop, downshift block | Overrun tail; downshift if kickdown reverse | ~ |
| **Downshift** | Rev-match flare | downshift + rev-match + thump | ✓ best moments |
| **Re-acceleration** | Load spike | high-load + wastegate (turbo) | ✓ turbo best |
| **Highway cruise** | High gear, low RPM | low/mid bands quiet | **~ monotone** |
| **Highway kickdown** | 1–2 downshifts, RPM flare | Downshift + rev-match + load | ✓ |
| **High RPM** | Near upshift threshold | high/redline bands | ✓ |
| **Redline** | Soft limiter, shift imminent | redline + upshift | ✓ |
| **Stop** | N, RPM→idle | Idle fade | ✓ |
| **Restart** | Launch repeat | Same as launch | ✓ |

---

## 4. Variation architecture

### Implemented

| Layer | Module | Role |
| ----- | ------ | ---- |
| RPM bands | `layer-weights.ts` | idle / low / mid / high / redline crossfade |
| Load layer | `dd-high-load` | Scales with `pt.load` above personality threshold |
| Shift envelope | `layer-weights.ts` | Bell on `shiftProgress` |
| Transient scheduler | `transient-scheduler.ts` | Contextual events, cooldowns, 2–3 variants per kind |
| Throttle model | `throttle-model.ts` | Attack/release τ → response speed |
| Gear logic | `gear-selector`, `shift-controller` | Aggression, hold, kickdown |
| Improved strategies | `realism/strategies*.ts` | Timbre (intake, exhaust, turbo beds) |
| Synthetic load | `motion.ts` | Continuous profiles: cruise vs WOT at same speed |

### Recommended (no random drivetrain)

1. **Recorded one-shots** — shift, overrun, turbo (see asset doc); procedural mix-under.
2. **Cruise micro-dynamics** — ±2–4% gain from `dload/dt`, not free-running LFO.
3. **Session load memory** — after sustained high load, slightly raise shift transient prob (capped, cooldown).
4. **Playful profile personalities** — map `farting-car`, `kazoo-kart` to intentional physics (today: fallback `gt-v8`).

---

## 5. Personality reference (physics + audio)

Source: `src/lib/drive/drivetrain-personalities.ts`. Scheduler defaults in `transient-scheduler.ts`.

### Summary table

| Personality | Profiles | Gears | Idle→Red | Upshift ms | Overrun | Turbo | 30-min |
| ----------- | -------- | ----- | -------- | ---------- | ------- | ----- | ------ |
| `flat-six-sport` | Flat-Six, Race Car, Racing V10 | 7 | 880–8000 | 110 | Moderate | — | 4/5 twisty; 3/5 highway |
| `american-v8` | American Muscle | 5 | 680–6000 | 280 | **Hero** | — | 4/5 |
| `turbo-inline-6` | Turbo I6, Rally Car | 7 | 750–7000 | 130 | Medium | Flutter/WG | **5/5** |
| `gt-v8` | GT V8, fallback | 6 | 900–6500 | 95 | Light | — | 4/5 |
| `synthetic-ev` | Electric Hypercar | 6 | 0–12000 | 75 | Low | — | 3/5 |
| `motorcycle-inline-4` | Motorcycle Superbike | 6 | 1200–14000 | 55 | Short rasp | — | 4/5 |
| `v-twin-cruiser` | Big Twin | 6 | 900–5500 | 240 | Long potato | — | 4/5 |
| `single-cylinder-ag` | Wiesn Tractor | 4 | 280–650 | 380 | Coast stack | — | 4/5 (slow roads) |

### Per-personality character (Dynamic Drive)

#### `flat-six-sport`

| Dimension | Spec |
| --------- | ---- |
| **RPM** | Tight mid/high bands; screams upper third; redline 8k |
| **Load** | Threshold 0.4; high-load layer from spirited driving |
| **Shift** | Crisp (0.82), rev-match 0.8, fast aggression |
| **Downshift** | Rev blip + thump; prob ~0.42 gated |
| **Overrun** | Moderate 0.58; pops prob 0.22, prior throttle ≥ 0.38 |
| **Exhaust** | NA pops only |
| **Cruise** | Mid band buzz; minimal transients |
| **Response** | Attack τ 0.08 s; shift aggression 1.1 |
| **Transient rate** | Upshift ~8–12 s city; overrun ~20–40 s lift |
| **Assets needed** | `flat6_shift_up_*.wav`, `flat6_overrun_*.wav` — high impact |

#### `american-v8`

| Dimension | Spec |
| --------- | ---- |
| **RPM** | Lumpy idle/low; early upshifts 3.8–5.4k |
| **Load** | Threshold 0.48 — must work pedal for load layer |
| **Shift** | Lazy 280 ms; soft upshift 0.65 |
| **Downshift** | Heavy thump; slow rev-match 0.45 |
| **Overrun** | **Primary character** — strength 0.85, prob 0.5 |
| **Exhaust** | Burble decay; pops prob 0.22 |
| **Cruise** | Low RPM lope — can repeat without sample variants |
| **Assets needed** | `v8_overrun_*.wav` (3 variants) — **critical** |

#### `turbo-inline-6`

| Dimension | Spec |
| --------- | ---- |
| **RPM** | Elastic 7-speed; high band from 5.5k |
| **Load** | Flutter/WG need load ≥ 0.42–0.52 |
| **Shift** | Smooth-fast; rev-match on downshift prep |
| **Turbo** | Flutter on lift prob 0.38; wastegate tip-in 0.28 |
| **Overrun** | Smoother than NA (0.7) |
| **Cruise** | Residual boost texture in strategy layer |
| **Assets needed** | `i6t_turbo_flutter_*.wav`, `i6t_wastegate_*.wav` — **highest ROI** |

#### `gt-v8`

| Dimension | Spec |
| --------- | ---- |
| **RPM** | Warm mid 2–4.5k cruise; refined high |
| **Load** | Threshold 0.42; distinguishes gentle vs hard same-gear |
| **Shift** | Quick 95 ms; rev-match moderate |
| **Overrun** | Restrained 0.5 |
| **Note** | Default fallback for unmapped VT profiles |

#### `synthetic-ev`

| Dimension | Spec |
| --------- | ---- |
| **RPM** | Motor speed 0–12k; no combustion metaphor |
| **Load** | Inverter/motor whine in strategy |
| **Shift** | 75 ms clicks; no rev-match |
| **Overrun** | Regen pitch bias only |
| **Assets needed** | `ev_shift_up_*.wav`, `ev_motor_load_whine_*.wav` |

#### `motorcycle-inline-4`

| Dimension | Spec |
| --------- | ---- |
| **RPM** | 12k–14k redline; stack-pipe variants (high filterHz) |
| **Load** | Threshold 0.34; very fast attack τ 0.04 |
| **Shift** | 55 ms upshift; aggressive rev-match |
| **Overrun** | Short rasp only |
| **Gear aggression** | 1.38; holds short in city |
| **Assets needed** | `bike_shift_up_*.wav`, `bike_high_load_10000rpm.wav` |

#### `v-twin-cruiser`

| Dimension | Spec |
| --------- | ---- |
| **RPM** | Loping 900 idle; upshift 3.1–4.7k |
| **Load** | Threshold 0.5; lazy response τ 0.14 |
| **Shift** | 240 ms lazy; weak rev-match 0.38 |
| **Overrun** | **Hero** — 3 variant pools, strength 0.88 |
| **Character** | 45° pulse in improved strategy |
| **Assets needed** | `twin_idle_loop_01.wav`, `twin_overrun_*.wav` |

#### `single-cylinder-ag`

| Dimension | Spec |
| --------- | ---- |
| **RPM** | 280–650; stroke-rate limited |
| **Load** | Threshold 0.52; flywheel inertia in RPM τ |
| **Shift** | 380 ms; no rev-match |
| **Overrun** | Long coast stack variants |
| **Improved path** | Hot-bulb chuff in strategy syncs with DD when both on |
| **Assets needed** | `ag_single_stroke_*.wav` — **defines identity** |

---

## 6. Profile catalog — all 47 built-in

**Engagement score (30 min):** 1 = fatigues quickly · 5 = stays interesting with restraint  
**DD** = Motion-matched sound path viable  
**Same-speed test:** ✓ = load/RPM separates cruise vs WOT at equal km/h

### Virtual-transmission (17 profiles)

| ID | Name | Personality | DD | Eng | Same-speed | RPM | Load | Shift | Overrun | Turbo | Cruise gap |
| -- | ---- | ----------- | -- | --- | ---------- | --- | ---- | ----- | ------- | ----- | ---------- |
| `gt-v8` | GT V8 | gt-v8 | ✓ | 4 | ✓ | mid warm | 0.42 thresh | quick refined | light | — | highway monotone |
| `flat-six-sport` | Flat-Six Sport | flat-six-sport | ✓ | 4 | ✓ | high raspy | 0.4 | crisp | moderate | — | needs samples |
| `american-muscle-v8` | American Muscle V8 | american-v8 | ✓ | 4 | ✓ | low lope | 0.48 | lazy | **hero** | — | lope repeats |
| `turbo-inline-6` | Turbo Inline-6 | turbo-inline-6 | ✓ | **5** | ✓ | elastic | 0.42+ | smooth-fast | medium | **flutter/WG** | best VT |
| `electric-hypercar` | Electric Hypercar | synthetic-ev | ✓ | 3 | ✓ | motor whine | inverter | click | regen bias | — | whine wears |
| `racing-v10` | Racing V10 | flat-six-sport | ✓ | 4 | ✓ | bright voice | shared | shared | shared | — | timbre only diff |
| `race-car` | Race Car | flat-six-sport | ✓ | 4 | ✓ | track voice | shared | shared | shared | — | same |
| `rally-car` | Rally Car | turbo-inline-6 | ✓ | **5** | ✓ | + gravel/antilag strategy | boost | rally | medium | antilag | **best overall** |
| `motorcycle-superbike` | Motorcycle Superbike | motorcycle-inline-4 | ✓ | 4 | ✓ | 14k | 0.34 | 55 ms | short | — | samples help |
| `big-twin` | Big Twin | v-twin-cruiser | ✓ | 4 | ✓ | lope | 0.5 | lazy | long | — | overrun carries |
| `wiesn-tractor` | Oide Wiesn Tractor | single-cylinder-ag | ✓ | 4 | ✓ | stroke-rate | 0.52 | slow | coast | — | chuff samples |
| `farting-car` | Farting Car | **gt-v8 fallback** | ✓ | 3 | ~ | comedy rhythm | parody | wrong physics | strategy gas | — | map to playful |
| `kazoo-kart` | Kazoo Kart | **gt-v8 fallback** | ✓ | 3 | ~ | kazoo bed | — | mismatched | — | — | map to turbo/playful |

### Continuous (30 profiles)

No gear/RPM at equal speed unless `computeSyntheticLoad` + strategy layers provide intent.

| ID | Name | Eng | Load proxy | Primary variation | 30-min note |
| -- | ---- | --- | ---------- | ----------------- | ----------- |
| `cyber-pulse` | Cyber Pulse | 3 | throttle+accel | pitch vs speed, regen dip | EV whine; synthetic load helps |
| `formula-electric` | Formula Electric | 3 | accel | motor + inverter cluster | track feel |
| `neon-drive` | Neon Drive | 2 | speed | city haze bed | ambient |
| `space-ship` | Space Ship | 3 | load proxy | plasma + shimmer events | designed sweeps |
| `ufo` | UFO | 2 | speed | theremin | thin |
| `speed-boat` | Speed Boat | 4 | cavitation on accel | regime-based water | good accel cues |
| `cruise-ship` | Cruise Ship | 2 | steady | engine room + rare horn | monotone cruise |
| `turbine-jet` | Turbine Jet | 3 | throttle spool | fan + blade-pass | needs spool sample |
| `helicopter` | Helicopter | 3 | collective proxy | rotor cadence | cadence helps |
| `private-jet` | Private Jet | 2 | speed | cabin fan | very smooth |
| `steam-train` | Steam Train | 4 | accel | chuff rate + whistle | cadence saves |
| `wild-west-carriage` | Wild West Carriage | 4 | speed tiers | hoof gait | gait changes |
| `romanian-85-carriage` | Romanian Carriage | 4 | speed | hoof + cobbles | rich texture |
| `horse-gallop` | Horse Gallop | **5** | speed | walk→gallop | **best continuous** |
| `santa-sleigh` | Santa Sleigh | 3 | speed | bells + hooves | festive |
| `laughing-machine` | Laughing Machine | 3 | throttle | laugh cadence | event-driven |
| `open-wind` | Open Wind | 2 | speed | wind bed | calm OK |
| `storm-glider` | Storm Glider | 3 | surge | storm + rare thunder | weather drama |
| `maglev-train` | Maglev Train | 2 | speed | structure hum | steady |
| `high-speed-train` | High-Speed Train | 3 | accel | traction + rail joints | joints help |
| `submarine` | Submarine | 4 | manual sonar | prop + cavitation | interactive |
| `jet-ski` | Jet Ski | 4 | turn load | engine + hull slap | good |
| `snowmobile` | Snowmobile | 3 | speed | 2-stroke + CVT | CVT static |
| `tank` | Tank | 3 | speed | diesel + track clack | rhythm |
| `construction-monster` | Construction Monster | 3 | load | diesel strain + clunk | machine |
| `dragon` | Dragon | 3 | throttle | roar layers | theatrical |
| `thunder-beast` | Thunder Beast | 3 | surge | growl + rare thunder | drama |
| `retro-arcade` | Retro Arcade | 2 | speed | cabinet bleeps | musical loop |
| `synthwave-drive` | Synthwave Drive | 2 | speed | arpeggio | musical |
| `deep-bass-pulse` | Deep Bass Pulse | 2 | energy | pulse BPM | meditative |
| `zen-drive` | Zen Drive | 2 | slow speed | drone + chimes | low variation OK |
| `rain-drive` | Rain Drive | 2 | speed | glass rain | ambient |
| `ocean-drive` | Ocean Drive | 2 | speed | waves | ambient |
| `heartbeat` | Heartbeat | 2 | throttle | BPM vs energy | meditative |

---

## 7. Scenario × profile quick reference

For **virtual-transmission + Motion-matched**, all listed VT profiles pass the critical tests when fusion is healthy. Continuous profiles pass **only** where load proxy or cadence exists.

| Test | VT + DD | Continuous + improved |
| ---- | ------- | ---------------------- |
| 80 km/h cruise vs WOT | ✓ load + RPM | ~ synthetic load |
| 60 km/h G3 vs G5 | ✓ gear ratios | ✗ N/A |
| Lift-off audible < 2 s | ✓ NA/V8/turbo | ~ strategy overrun |
| Kickdown from highway | ✓ | ✗ |
| 30 min not hiss-only | ~ cruise gap | varies |

---

## 8. Engagement verdict by tier

### Tier A (30 min — strong, 4–5)

`turbo-inline-6`, `rally-car`, `american-muscle-v8`, `flat-six-sport`, `gt-v8`, `motorcycle-superbike`, `big-twin`, `wiesn-tractor`, `horse-gallop`, `speed-boat`, `steam-train`, `jet-ski`

### Tier B (adequate, 3)

Most remaining physical/designed continuous; `electric-hypercar`, playful VT with wrong fallback

### Tier C (ambient/musical — low variation acceptable, 2)

`zen-drive`, `rain-drive`, `ocean-drive`, `neon-drive`, `deep-bass-pulse`, `retro-arcade`, `synthwave-drive`, `open-wind`, `private-jet`, `maglev-train`, `cruise-ship`

---

## 9. Priorities

| P | Action | Type |
| - | ------ | ---- |
| P0 | Record turbo flutter + wastegate + V8 overrun variants | Assets |
| P0 | Map `farting-car` → `american-v8`, `kazoo-kart` → playful config | Config |
| P1 | Record flat-six + gt-v8 shift/rev-match one-shots | Assets |
| P1 | Cruise micro-dynamics from load derivative | Code |
| P2 | EV motor load loop + shift clunk samples | Assets |
| P2 | Tractor single-stroke + twin idle loop | Assets |
| P3 | Session load memory for transient probability | Code |

---

## 10. Verification checklist

Run `/debug` scenarios (`realism/debug-scenarios.ts`) and driving scenarios A–E:

- [ ] 80 km/h cruise vs WOT — clearly different timbre (DD on)
- [ ] 60 km/h G3 vs G5 (`/debug/powertrain`) — different pitch
- [ ] Lift-off overrun within 2 s (NA/V8)
- [ ] Highway kickdown — downshift + rev flare
- [ ] 30 min mixed — transients not annoying; cruise not hiss-only
- [ ] No transients fire without shift/overrun/load gate (inspect debug export)

---

## 11. File map

| Concern | Path |
| ------- | ---- |
| Personalities | `src/lib/drive/drivetrain-personalities.ts` |
| Layer weights | `src/lib/sound/dynamic-drive/layer-weights.ts` |
| Transient scheduler | `src/lib/sound/dynamic-drive/transient-scheduler.ts` |
| Dynamic synth | `src/lib/sound/dynamic-drive/synth.ts` |
| Improved timbre | `src/lib/sound/realism/strategies*.ts` |
| Synthetic load | `src/lib/sound/realism/motion.ts` |
| Profiles | `src/lib/sound/profiles.ts`, `profiles-expansion.ts` |
| Asset requirements | `docs/audio-asset-requirements.md` |
