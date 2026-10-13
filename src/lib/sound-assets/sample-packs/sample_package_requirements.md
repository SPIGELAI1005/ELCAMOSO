# ELCAMOSO — complete sample package requirements

Written 13 Oct 2026 from a read of the app code (`src/lib/sound/realism/samples/*`, `realism/v2/sample-bank.ts`, `dynamic-drive/transient-scheduler.ts`, signature/texture kinds in `sound/engine.ts`) and the 57 profile docs in `docs/sound-profiles/`. All files: 48 kHz / 24-bit mono WAV, true peak ≤ −1.2 dBTP, 38 Hz 4th-order high-pass (Tesla speakers). Loops are RMS-normalized (−20 dBFS on-load, −24 part-load, −27 off-load, −22 non-combustion). One-shots are peaked to −3 dBFS, then true-peak limited. 

## Final status (v2, 13 Oct 2026, 17:45 CEST): all 57 profiles + ambient/ui/signature

Totals: **1112 files** across 60 folders (57 app profiles + `ambient`, `ui`, `signature`). Index: `index.json`. Every profile has `manifest.json` and `demo_reels/<profile>.mp3`.

Quality flags: **good** = convincing synthesis of a mechanical/electronic source; **approximate** = recognisable but stylized; **needs-recording** = synthesis is clearly artificial and a recording would be needed for realism. Flags are per profile and per manifest entry (e.g. `horse-gallop` neigh entries are `needs-recording`).

### Contents of every set
- **Combustion engines (9):** idle, cold-start idle, 6 WOT + 6 part-load + 3 light-load RPM loops, 4 off-load loops, reverse whine loop; 3 rev blips, accel and decel sweeps, 3 upshifts, 3 downshifts with blip, 3 drivetrain thumps, 3 pops, 2 crackles, start-up, shutdown, limiter, launch control, and turbo spool/blow-off/flutter on turbo engines.
- **Every other profile:** idle/standstill loop, speed-keyed cruise loops (3–7 steps), pull loops (full demand) at alternate speeds, accel sweep, decel sweep, plus its characteristic one-shots (2–6 variants each). Music beds loop on whole 4-bar phrases, rhythm loops (hooves, chuffs, heartbeats, pulses, swells, rotors) on whole cycles.
- **Horses (horse-gallop, wild-west-carriage, romanian-85-carriage, santa-sleigh):** hoof loops for walk (4-beat, 5 km/h), trot (2-beat, 11), canter (3-beat, 20), gallop (4-beat, 35 and 50 km/h), stride rate = gait base + 0.01 Hz per km/h. horse-gallop has dirt and cobble surfaces, wild-west dirt with 2 horses, romanian cobble, sleigh snow. Breathing is synced 1 per stride in canter/gallop. One-shots: lip flutter ×4, snort ×4, blow-out ×3, stride-synced heavy breathing ×3, tack/bridle jingle ×4, saddle creak ×4, neigh ×3 (needs-recording); carriages add whip crack, brake squeal, iron-rim bumps; sleigh adds ho-ho-ho ×3 and bell shakes.
- **Earlier gaps now filled:** light-load cruise loops, drivetrain thump, 3rd rev blip, reverse whine, cold-start idle (all engines); train horn and converter staircase (high-speed-train); helicopter spool up/down; maglev-specific loops (linear-motor tone + guideway hum, no rail joints); tractor RPM loops 400–650 rpm; zen rare chimes ×6.

### Per-profile status

| Profile | Loops | One-shots | Quality | One-shot kinds | Notes |
|---|---|---|---|---|---|
| `ambient` | 10 | 3 | good | thunder |  |
| `american-muscle-v8` | 22 | 23 | good | accel, decel_overrun, downshift_blip, drivetrain_thump, exhaust_pop, launch, overrun_crackle, rev, rev_blip, shutdown, startup, upshift | Physical firing-order synthesis. |
| `big-twin` | 22 | 23 | approximate | accel, decel_overrun, downshift_blip, drivetrain_thump, exhaust_pop, launch, overrun_crackle, rev, rev_blip, shutdown, startup, upshift | Physical firing-order synthesis. Seam needs a listen. |
| `construction-monster` | 5 | 8 | approximate | accel, bucket_clank, decel, hydraulic_relief, reverse_alarm |  |
| `cruise-ship` | 7 | 5 | approximate | accel, anchor_chain, decel, ship_horn |  |
| `cyber-pulse` | 8 | 6 | approximate | accel, boost_zap, decel, regen_wash |  |
| `deep-bass-pulse` | 7 | 4 | good | accel, decel, drop | LF share capped at 20 % by the 70 Hz guard; carried by 90/135 Hz harmonics. Seam needs a listen. |
| `dragon` | 7 | 10 | approximate | accel, decel, fire_breath, roar, wing_flap | Creature voice is stylized. |
| `electric-hypercar` | 11 | 10 | good | accel, avas_pedestrian_tone, decel, gear_shift_2speed, launch, regen | 2-speed Taycan-style gearing, motor orders 4/8/12 + 31-tooth mesh. |
| `farting-car` | 7 | 10 | approximate | accel, decel, idle_putt, squeaky_deflation, upshift_blat |  |
| `flat-six-sport` | 22 | 23 | good | accel, decel_overrun, downshift_blip, drivetrain_thump, exhaust_pop, launch, overrun_crackle, rev, rev_blip, shutdown, startup, upshift | Physical firing-order synthesis. |
| `formula-electric` | 11 | 8 | good | accel, avas_pedestrian_tone, decel, launch, regen |  |
| `fusion-future-pulse` | 7 | 2 | approximate | accel, decel | Stylized synthesized music bed; real app stems are richer. Seam needs a listen. |
| `fusion-mechanical-symphony` | 7 | 2 | approximate | accel, decel | Stylized synthesized music bed; real app stems are richer. |
| `fusion-midnight-boost` | 7 | 2 | approximate | accel, decel | Stylized synthesized music bed; real app stems are richer. |
| `fusion-road-anthem` | 7 | 2 | approximate | accel, decel | V8 machine layer + rock-ish bed. |
| `gt-v8` | 22 | 23 | good | accel, decel_overrun, downshift_blip, drivetrain_thump, exhaust_pop, launch, overrun_crackle, rev, rev_blip, shutdown, startup, upshift | Physical firing-order synthesis. |
| `heartbeat` | 5 | 3 | approximate | accel, decel, skip_beat | Loop length is matched at d=0.5; idle/pull loops use the same length (slight tempo rounding). |
| `helicopter` | 7 | 5 | approximate | accel, autorotation_whoosh, decel, spool_down, spool_up |  |
| `high-speed-train` | 8 | 7 | approximate | accel, brake_hiss, converter_staircase, decel, train_horn |  |
| `horse-gallop` | 11 | 27 | approximate | accel, blow_out, breath_stride_gallop, decel, lip_flutter, neigh, saddle_creak, snort, tack_jingle | Hoof/gait rhythm good; breath/snort/lip-flutter/neigh are synthesized vocal approximations (neigh: needs-recording for realism). |
| `jet-ski` | 8 | 7 | approximate | accel, decel, drift_wash, hull_slap |  |
| `kazoo-kart` | 7 | 5 | good | accel, decel, shift_honk | A kazoo is buzz+comb formant; synthesis is convincing. |
| `laughing-machine` | 5 | 10 | needs-recording | accel, belly_laugh, decel, giggle, wind_down_chuckle | Formant-synth laugh is clearly artificial. |
| `maglev-train` | 7 | 5 | approximate | accel, decel, door_chime, passby_whoosh | No wheel/rail joints by design. |
| `motorcycle-superbike` | 22 | 23 | good | accel, decel_overrun, downshift_blip, drivetrain_thump, exhaust_pop, launch, overrun_crackle, rev, rev_blip, shutdown, startup, upshift | Physical firing-order synthesis. |
| `neon-drive` | 7 | 4 | approximate | accel, arp_riser, decel | Stylized synthesized music bed; real app stems are richer. |
| `ocean-drive` | 5 | 5 | good | accel, decel, wave_crash |  |
| `open-wind` | 7 | 5 | good | accel, decel, gust |  |
| `private-jet` | 5 | 5 | good | accel, cabin_chime, decel, spool_down | Heard from cabin (LPF 2 kHz). |
| `race-car` | 22 | 23 | good | accel, decel_overrun, downshift_blip, drivetrain_thump, exhaust_pop, launch, overrun_crackle, rev, rev_blip, shutdown, startup, upshift | Physical firing-order synthesis. |
| `racing-v10` | 22 | 23 | good | accel, decel_overrun, downshift_blip, drivetrain_thump, exhaust_pop, launch, overrun_crackle, rev, rev_blip, shutdown, startup, upshift | Physical firing-order synthesis. |
| `rain-drive` | 7 | 7 | good | accel, decel, puddle_splash, wiper_swipe |  |
| `rally-car` | 22 | 26 | approximate | accel, decel_overrun, downshift_blip, drivetrain_thump, exhaust_pop, launch, overrun_crackle, rev, rev_blip, shutdown, startup, turbo, turbo_blowoff, turbo_flutter, upshift | Physical firing-order synthesis. |
| `retro-arcade` | 8 | 7 | good | accel, coin, decel, power_down, power_up | Chiptune is inherently synthetic. |
| `romanian-85-carriage` | 6 | 21 | approximate | accel, decel, iron_rim_bump, lip_flutter, saddle_creak, snort, tack_jingle | Single horse, iron rims on cobbles. |
| `santa-sleigh` | 6 | 11 | approximate | accel, bell_shake, decel, ho_ho_ho, snort | Ho-ho-ho is formant-synthesized (needs-recording for natural voice). |
| `signature` | 4 | 2 | approximate | ship, whip |  |
| `snowmobile` | 7 | 6 | approximate | accel, cvt_engagement, decel, rev_blip | 2-stroke twin + CVT hold. |
| `space-ship` | 7 | 8 | approximate | accel, airlock_hiss, decel, thruster_burst, warp_whoosh |  |
| `speed-boat` | 8 | 7 | approximate | accel, decel, exhaust_bubble, planing_transition, wake_wash |  |
| `steam-train` | 7 | 7 | approximate | accel, brake_squeal, decel, safety_valve, whistle |  |
| `storm-glider` | 7 | 5 | good | accel, decel, thunder |  |
| `submarine` | 7 | 8 | approximate | accel, decel, hull_creak, sonar_ping |  |
| `symphony-cinematic-rock` | 7 | 4 | approximate | accel, decel, power_chord_hit | Stylized rock bed (distorted saw power chords, drums); no real guitar. |
| `symphony-motion-orchestra` | 7 | 5 | approximate | accel, brass_stab, decel, timpani_roll | Synth-string orchestral approximation; needs-recording for true orchestra. |
| `symphony-neon-run` | 7 | 2 | approximate | accel, decel | Stylized synthesized music bed; real app stems are richer. |
| `synthwave-drive` | 7 | 4 | approximate | accel, decel, gated_snare_hit | Stylized synthesized music bed; real app stems are richer. |
| `tank` | 8 | 7 | approximate | accel, decel, shift_clunk, startup, turret_traverse | Diesel V12 + track clank. Seam needs a listen. |
| `thunder-beast` | 7 | 7 | approximate | accel, decel, roar, thunder_roll |  |
| `turbine-jet` | 5 | 4 | good | accel, decel, ignition_tick, spool_up |  |
| `turbo-inline-6` | 22 | 26 | good | accel, decel_overrun, downshift_blip, drivetrain_thump, exhaust_pop, launch, overrun_crackle, rev, rev_blip, shutdown, startup, turbo, turbo_blowoff, turbo_flutter, upshift | Physical firing-order synthesis. |
| `ufo` | 7 | 6 | good | accel, beam_warble, decel, dive_glide | Theremin-style sine; inherently synthetic. |
| `ui` | 0 | 7 | good | chime, horn_dual, indicator_tick, reverse |  |
| `wiesn-tractor` | 13 | 7 | approximate | accel, chassis_rattle, decel, hot_bulb_start, missed_beat | Lanz-Bulldog style single cylinder, one bang per rev. |
| `wild-west-carriage` | 6 | 25 | approximate | accel, brake_squeal, decel, lip_flutter, neigh, saddle_creak, snort, tack_jingle, whip_crack | Two-horse team + wooden wheel creak. |
| `world-cyber-city` | 7 | 2 | approximate | accel, decel | Stylized synthesized music bed; real app stems are richer. Seam needs a listen. |
| `world-space-drive` | 7 | 2 | approximate | accel, decel | Stylized synthesized music bed; real app stems are richer. |
| `world-storm-run` | 7 | 5 | approximate | accel, decel, thunder | Stylized synthesized music bed; real app stems are richer. |
| `zen-drive` | 5 | 8 | good | accel, decel, rare_chime |  |

### Self-check (selfcheck_report.json)
- 1112 files, 0 silent/non-finite, max true peak -1.2 dBTP, worst <60 Hz energy share 19.5 % (target < 25 %).
- Loop seams: 6 loops show a spectral change across the seam without a click: big-twin/onload_high_3600rpm.wav, deep-bass-pulse/cruise_90kmh.wav, world-cyber-city/cruise_130kmh.wav, fusion-future-pulse/idle_standstill.wav, tank/cruise_70kmh.wav, tank/pull_15kmh.wav.
- Firing-order dominance (firing order vs crank order 1 / vs half-firing order, dB, full-throttle loops): gt-v8 ≥ 8.7 / ≥ 10.8, american-muscle-v8 ≥ 9.5 / ≥ 7.6, big-twin 11–40 dB vs half-order from 2200 rpm (at 1500 rpm both tones sit below the 38 Hz high-pass, so that point isn't meaningful).

### Still not covered
- Real voices/animals (neigh, laugh, ho-ho-ho), real orchestra/guitar stems: synthesized approximations only, flagged.
- Loudness is per-file RMS-normalized; the "pull ≥ cruise +3 dB" relation must come from the app's gain staging (intended demand is in each entry's `demand` field).
- Owner listening approval: `license.approval` stays `"unknown"`.
