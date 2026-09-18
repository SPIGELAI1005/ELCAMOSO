# Audio asset requirements

**Status:** No engine samples are shipped. ELCAMOSO uses **procedural Web Audio** by default. Realism V2 adds a hybrid combustion backend (`docs/AUDIO_REALISM_V2.md`) that is sample-ready via this schema. This document specifies recorded assets that would **materially improve** long-term driving engagement.

**Do not fabricate files** — implement procedural fallbacks until assets exist. When adding samples, follow naming and metadata below.

**Related:** `docs/SOUND_CHARACTER_SPEC.md`, `docs/AUDIO_REALISM_V2.md`, `src/lib/sound/dynamic-drive/transient-scheduler.ts`, `src/lib/sound/realism/v2/sample-bank.ts`, `docs/premium-sound-asset-protection.md`

**Personalities implemented (8):** `flat-six-sport`, `american-v8`, `turbo-inline-6`, `gt-v8`, `synthetic-ev`, `motorcycle-inline-4`, `v-twin-cruiser`, `single-cylinder-ag`. Procedural `variantPools` exist for all eight; WAV files replace noise bursts per event kind.

### Steady combustion loops (Realism V2)

In addition to one-shots below, sample-assisted mode expects **RPM × load** loop entries (see `CombustionSampleEntry`):

| Field         | Requirement                                              |
| ------------- | -------------------------------------------------------- |
| `rpmRef`      | Center RPM of the recording                              |
| `load`        | `idle` \| `low` \| `medium` \| `high` \| `overrun`       |
| Loop seams    | Zero-crossing; optional `loopStart` / `loopEnd`          |
| Playback rate | Prefer neighbor crossfade outside ~0.85–1.18 vs `rpmRef` |

Example GT V8 set: 900 idle; 1800/2500/3500 low; 2500/3500/4500/5500 high; overrun bed.
---

## Fallback policy

| Priority | Event type                | Current fallback                                      | When sample wins                                |
| -------- | ------------------------- | ----------------------------------------------------- | ----------------------------------------------- |
| P0       | Upshift / downshift       | Bandpass noise burst (`DynamicDriveSynth` transients) | Character-specific mechanical bite              |
| P0       | Overrun / exhaust pop     | Pink/white noise envelope                             | NA burble, boxer overlap                        |
| P1       | Rev-match blip            | Pink noise                                            | Distinct throttle-blip identity                 |
| P1       | Turbo flutter / wastegate | Filtered noise                                        | Real BOV / wastegate texture                    |
| P2       | High-load steady layer    | Extra harmonic band                                   | Rich recorded load at fixed RPM                 |
| P3       | Idle loop                 | Harmonic idle band                                    | Subtle real idle recording (loop seam critical) |

Loader integration (future): optional `sampleMap` on `SoundProfile` or personality; `DynamicDriveSynth` plays one-shot `AudioBuffer` on scheduler fire with procedural mix-under. **Delivery:** register files in `src/lib/sound-assets/catalog.ts` and fetch via signed manifest — see `docs/premium-sound-asset-protection.md`. Never place premium WAVs in `public/`.

---

## Global technical requirements

| Field           | Requirement                                                                               |
| --------------- | ----------------------------------------------------------------------------------------- |
| **Format**      | 48 kHz, 24-bit WAV, mono or stereo (stereo preferred for exhaust; pan optional in engine) |
| **Loudness**    | Peak −6 dBFS; normalized batch; limiter-friendly                                          |
| **Loop points** | Loop assets: zero-crossing seams; note loop start/end in manifest                         |
| **Variants**    | Minimum **2**, target **3** per event per personality for scheduler `pickVariant`         |
| **Naming**      | `{personality}_{event}_{variant}.wav` — see examples below                                |
| **Manifest**    | JSON sidecar optional: `{ "rpmHint": 5500, "load": "high", "durationMs": 180 }`           |

---

## Personality: `flat-six-sport`

**Profiles:** Flat-Six Sport, Race Car, Racing V10  
**Recording character:** Flat-six overlap, metallic upper mid, sharp upshift cut, short overrun bark (not muscle burble)

### One-shots (non-loop)

| Suggested filename            | Event             | Approx RPM | Load       | Duration   | Character            |
| ----------------------------- | ----------------- | ---------- | ---------- | ---------- | -------------------- |
| `flat6_shift_up_01.wav`       | upshift           | 6500→5200  | medium     | 120–180 ms | Crisp dogleg upshift |
| `flat6_shift_up_02.wav`       | upshift           | 7200→5800  | high       | 100–150 ms | Hard track upshift   |
| `flat6_shift_up_03.wav`       | upshift           | 5000→4200  | low        | 140–200 ms | Street upshift       |
| `flat6_shift_down_01.wav`     | downshift + thump | 4500→6200  | medium     | 150–220 ms | Rev flare into gear  |
| `flat6_rev_match_01.wav`      | rev-match         | 5500       | medium     | 80–140 ms  | Single blip          |
| `flat6_rev_match_02.wav`      | rev-match         | 7000       | high       | 70–120 ms  | Aggressive blip      |
| `flat6_overrun_small_01.wav`  | overrun           | 4000       | low        | 300–500 ms | Short decel rasp     |
| `flat6_overrun_medium_01.wav` | overrun           | 5500       | medium     | 400–700 ms | Lift-off bark        |
| `flat6_exhaust_pop_01.wav`    | exhaust-pop       | 3500       | high prior | 60–100 ms  | Single pop           |
| `flat6_exhaust_pop_02.wav`    | exhaust-pop       | 5000       | high prior | 50–90 ms   | Crack pop            |

### Optional loops

| Suggested filename            | Event            | Approx RPM | Load | Duration | Loop |
| ----------------------------- | ---------------- | ---------- | ---- | -------- | ---- |
| `flat6_high_load_5500rpm.wav` | high-load layer  | 5500       | high | 2–4 s    | yes  |
| `flat6_cruise_3200rpm.wav`    | cruise reference | 3200       | low  | 3–5 s    | yes  |

**Material impact:** High — current procedural shifts are the main predictability source for sport profiles.

---

## Personality: `american-v8`

**Profiles:** American Muscle V8, (incorrectly) Wiesn Tractor until dedicated personality  
**Recording character:** Lumpy idle, long overrun burble, lazy shift, occasional pop on aggressive lift

| Suggested filename         | Event       | Approx RPM | Load       | Duration    | Character               |
| -------------------------- | ----------- | ---------- | ---------- | ----------- | ----------------------- |
| `v8_shift_up_01.wav`       | upshift     | 4200→3200  | medium     | 200–280 ms  | Soft long shift         |
| `v8_shift_up_02.wav`       | upshift     | 5200→4000  | high       | 180–260 ms  | Performance upshift     |
| `v8_shift_down_01.wav`     | downshift   | 2800→4500  | medium     | 220–320 ms  | Lazy downshift thump    |
| `v8_overrun_small_01.wav`  | overrun     | 2500       | low        | 500–800 ms  | Mild burble             |
| `v8_overrun_medium_01.wav` | overrun     | 3500       | medium     | 700–1200 ms | Classic decel burble    |
| `v8_overrun_large_01.wav`  | overrun     | 4500       | high prior | 900–1500 ms | Long aggressive overrun |
| `v8_exhaust_pop_01.wav`    | exhaust-pop | 3000       | high prior | 80–120 ms   | Backfire pop            |
| `v8_exhaust_pop_02.wav`    | exhaust-pop | 4000       | high prior | 70–110 ms   | Secondary pop           |

| `v8_idle_loop_01.wav` | idle | 680 | idle | 4–6 s | yes — subtle lope |

**Material impact:** High for overrun character; **critical** for Muscle V8 identity.

---

## Personality: `turbo-inline-6`

**Profiles:** Turbo Inline-6, Rally Car  
**Recording character:** Smooth six + turbo whistle; flutter on lift; wastegate chatter on tip-in

| Suggested filename          | Event         | Approx RPM | Load   | Duration   | Character                  |
| --------------------------- | ------------- | ---------- | ------ | ---------- | -------------------------- |
| `i6t_shift_up_01.wav`       | upshift       | 5800→4600  | medium | 130–190 ms | Smooth turbo shift         |
| `i6t_shift_up_02.wav`       | upshift       | 6600→5200  | high   | 110–170 ms | Hard shift                 |
| `i6t_shift_down_01.wav`     | downshift     | 3200→5200  | medium | 160–240 ms | Boost rebuild              |
| `i6t_rev_match_01.wav`      | rev-match     | 6000       | medium | 90–150 ms  | Blip under boost           |
| `i6t_turbo_flutter_01.wav`  | turbo-flutter | 4500       | high   | 120–200 ms | BOV flutter                |
| `i6t_turbo_flutter_02.wav`  | turbo-flutter | 5500       | high   | 100–180 ms | Alternate flutter          |
| `i6t_wastegate_01.wav`      | wastegate     | 5000       | high   | 80–140 ms  | Wastegate chatter          |
| `i6t_wastegate_02.wav`      | wastegate     | 6000       | high   | 70–130 ms  | Shorter chatter            |
| `i6t_overrun_medium_01.wav` | overrun       | 4000       | medium | 400–600 ms | Six decel + residual boost |

**Rally-specific (profile `rally-car`, hybrid layer):**

| Suggested filename          | Event              | Approx RPM | Load         | Duration   | Character            |
| --------------------------- | ------------------ | ---------- | ------------ | ---------- | -------------------- |
| `rally_antilag_01.wav`      | antilag (strategy) | 4500       | high         | 150–300 ms | Pop-bang (sparingly) |
| `rally_gravel_spray_01.wav` | texture accent     | —          | speed-linked | 1–2 s      | yes — low level bed  |

**Material impact:** Very high — turbo events are primary non-speed variation today.

---

## Personality: `gt-v8`

**Profiles:** GT V8, **default fallback** for unmapped VT profiles  
**Recording character:** Refined GT exhaust, quicker shifts than american-v8, shorter overrun

| Suggested filename           | Event     | Approx RPM | Load   | Duration   | Character             |
| ---------------------------- | --------- | ---------- | ------ | ---------- | --------------------- |
| `gtv8_shift_up_01.wav`       | upshift   | 5200→4200  | medium | 90–140 ms  | Refined upshift       |
| `gtv8_shift_up_02.wav`       | upshift   | 5900→4800  | high   | 80–130 ms  | Sport upshift         |
| `gtv8_shift_down_01.wav`     | downshift | 2600→4200  | medium | 140–200 ms | Rev-match downshift   |
| `gtv8_rev_match_01.wav`      | rev-match | 4800       | medium | 70–120 ms  | Clean blip            |
| `gtv8_overrun_medium_01.wav` | overrun   | 3800       | medium | 350–550 ms | Restrained GT overrun |

**Material impact:** Medium-high — also wrongly used for bike/twin until personalities fixed.

---

## Personality: `synthetic-ev`

**Profiles:** Electric Hypercar  
**Recording character:** Motor whine, inverter whirr, synthetic shift clunk — no exhaust

| Suggested filename             | Event            | Approx RPM | Load   | Duration   | Character        |
| ------------------------------ | ---------------- | ---------- | ------ | ---------- | ---------------- |
| `ev_shift_up_01.wav`           | upshift          | 9000→7000  | medium | 40–80 ms   | Synthetic clunk  |
| `ev_shift_up_02.wav`           | upshift          | 11000→8500 | high   | 35–70 ms   | Faster clunk     |
| `ev_drivetrain_thump_01.wav`   | drivetrain-thump | —          | medium | 60–100 ms  | Mount thump      |
| `ev_motor_load_whine_01.wav`   | high-load layer  | 8000       | high   | 2–3 s      | yes — motor load |
| `ev_inverter_transient_01.wav` | tip-in           | 6000       | rising | 100–200 ms | Inverter surge   |

**Material impact:** High for EV — procedural sawtooth wears quickly on long drives.

---

## Extended personalities (implemented — assets optional)

Procedural `variantPools` in `drivetrain-personalities.ts` are active. WAV files below replace bandpass-noise transients.

### `motorcycle-inline-4` (`motorcycle-superbike`)

| Suggested filename            | Event     | Approx RPM  | Load   | Duration   | Loop | Character               |
| ----------------------------- | --------- | ----------- | ------ | ---------- | ---- | ----------------------- |
| `bike_shift_up_01.wav`        | upshift   | 11000→9000  | high   | 60–100 ms  | no   | Stack pipe scream shift |
| `bike_shift_up_02.wav`        | upshift   | 13000→10500 | high   | 50–90 ms   | no   | Race shift              |
| `bike_shift_down_01.wav`      | downshift | 7000→10500  | medium | 80–120 ms  | no   | Quick blip down         |
| `bike_rev_match_01.wav`       | rev-match | 10000       | high   | 70–110 ms  | no   | Short scream blip       |
| `bike_overrun_small_01.wav`   | overrun   | 8000        | medium | 200–400 ms | no   | Decel rasp              |
| `bike_overrun_small_02.wav`   | overrun   | 9500        | high   | 180–350 ms | no   | Hard decel              |
| `bike_high_load_10000rpm.wav` | high-load | 10000       | high   | 2–3 s      | yes  | Wide-open pipe          |

**Fallback:** `bike-shift-up-stack`, `bike-rev-blip`, `bike-overrun-rasp` procedural IDs.

### `v-twin-cruiser` (`big-twin`)

| Suggested filename           | Event   | Approx RPM | Load   | Duration    | Loop | Character           |
| ---------------------------- | ------- | ---------- | ------ | ----------- | ---- | ------------------- |
| `twin_idle_loop_01.wav`      | idle    | 900        | idle   | 4–6 s       | yes  | 45° pulse lope      |
| `twin_shift_up_01.wav`       | upshift | 3500→2800  | medium | 150–220 ms  | no   | Lazy twin shift     |
| `twin_shift_up_02.wav`       | upshift | 4100→3300  | high   | 140–200 ms  | no   | Loaded shift        |
| `twin_overrun_medium_01.wav` | overrun | 2800       | medium | 600–900 ms  | no   | Potato-potato decel |
| `twin_overrun_medium_02.wav` | overrun | 3200       | high   | 700–1100 ms | no   | Long decel          |
| `twin_overrun_medium_03.wav` | overrun | 2400       | low    | 500–800 ms  | no   | Soft coast          |

**Fallback:** `twin-overrun-potato`, `twin-shift-lazy` procedural IDs.

### `single-cylinder-ag` (`wiesn-tractor`)

| Suggested filename        | Event             | Approx RPM | Load   | Duration    | Loop | Character            |
| ------------------------- | ----------------- | ---------- | ------ | ----------- | ---- | -------------------- |
| `ag_single_stroke_01.wav` | combustion stroke | 450        | medium | 400–600 ms  | yes  | One chuff per stroke |
| `ag_single_stroke_02.wav` | combustion stroke | 520        | high   | 350–550 ms  | yes  | Loaded chuff         |
| `ag_single_stroke_03.wav` | combustion stroke | 380        | low    | 450–650 ms  | yes  | Light chuff          |
| `ag_overrun_coast_01.wav` | coasting          | 380        | low    | 800–1200 ms | no   | Flywheel coast       |
| `ag_shift_clunk_01.wav`   | upshift           | 510→470    | medium | 200–350 ms  | no   | Agricultural clunk   |

**Fallback:** `ag-shift-chuff`, `ag-overrun-coast`, `ag-flywheel-thump` procedural IDs.

### Profiles without dedicated personality

| Profile       | Fallback today | Suggested map                 | Assets                          |
| ------------- | -------------- | ----------------------------- | ------------------------------- |
| `farting-car` | `gt-v8`        | `american-v8`                 | Low — comedy strategy dominates |
| `kazoo-kart`  | `gt-v8`        | keep or future `playful-mini` | Low                             |

---

## Continuous profiles — sample optional (P2/P3)

Procedural strategies suffice for many; samples would help:

| Profile        | Suggested assets                                           | Impact                       |
| -------------- | ---------------------------------------------------------- | ---------------------------- |
| `horse-gallop` | `horse_hoof_soft_01.wav`, `horse_snort_01.wav` (one-shots) | Medium — gait already strong |
| `steam-train`  | `steam_chuff_01–03.wav`, `steam_whistle_01.wav`            | Medium                       |
| `turbine-jet`  | `jet_spool_up_loop.wav`, `jet_wind_bed.wav`                | High for aviation fans       |
| `speed-boat`   | `boat_cavitation_01.wav` (accel one-shot)                  | Medium                       |
| `submarine`    | `sonar_ping_01.wav` (already event-driven)                 | Low                          |

**Ambient/musical** (`zen-drive`, `rain-drive`, `ocean-drive`, `synthwave-drive`): **no engine assets recommended** — variation should stay environmental/musical, not faux-mechanical.

---

## Implementation order

1. **turbo-inline-6** flutter + wastegate + shift (highest engagement ROI)
2. **american-v8** overrun set (3 variants)
3. **flat-six-sport** shift + rev-match
4. **gt-v8** shift (fallback personality cleanup)
5. **v-twin-cruiser** idle loop + overrun variants
6. **single-cylinder-ag** stroke loops + coast
7. **motorcycle-inline-4** shift + high-load loop
8. **synthetic-ev** shift clunk + load whine loop

---

## Acceptance criteria (per asset batch)

- [ ] A/B vs procedural in `/debug` — same powertrain state, sample wins on shift/overrun blind listen
- [ ] No clipping after master limiter (0.85 ceiling)
- [ ] Variants perceptually distinct, not louder-only
- [ ] 30-min drive: transient rate feels **eventful not noisy**
- [ ] Cruise loops seamless (if used) with no audible seam every 3 s

---

## What we are **not** requesting

- Random ambient loops unrelated to vehicle state
- Per-minute “surprise” effects decoupled from load/RPM/shift
- OEM brand recordings or trademarked vehicle captures
- Large multi-GB libraries — start with **~8–12 one-shots per priority personality**
