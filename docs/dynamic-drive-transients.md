# Dynamic Drive transients

One-shot procedural accents layered on top of continuous RPM bands. The transient scheduler turns powertrain events into believable, varied bursts rather than repeating the same cue every time.

## Transient kinds

| Kind             | Layer                 | Typical trigger                              |
| ---------------- | --------------------- | -------------------------------------------- |
| Upshift          | `dd-upshift`          | Shift-up started under load                  |
| Rev-match        | `dd-rev-match`        | Rev-match flare on meaningful downshift      |
| Downshift        | `dd-downshift`        | Shift-down started under load                |
| Overrun          | `dd-overrun`          | Lift-off overrun with prior throttle         |
| Exhaust pop      | `dd-exhaust-pop`      | NA lift-off after hard throttle (subtle)     |
| Turbo flutter    | `dd-turbo-flutter`    | Turbo profiles: partial throttle under boost |
| Wastegate        | `dd-wastegate`        | Turbo profiles: throttle opening under load  |
| Drivetrain thump | `dd-drivetrain-thump` | Late phase of loaded downshift               |

## Scheduler controls

Each kind has **probability**, **cooldown**, and **contextual eligibility** (min load, min speed, min throttle drop, etc.). Personalities override defaults via `transient.scheduler` and supply multiple **variant pools** (`transient.variantPools`).

Per fire:

- **Random variant** — picks among 2–3 sample-ready shapes per kind.
- **Intensity jitter** — ±14% on peak gain so repeats feel human, not robotic.
- **Subtle bias** — exhaust pops favor lower-intensity variants ~62% of the time.
- **Cap** — at most two new transients per audio tick to avoid stacking exaggeration.

Aspiration gates:

- **NA** — no turbo flutter or wastegate; exhaust pops only on NA profiles.
- **Turbo** — flutter and wastegate enabled; exhaust pops remain rare.
- **Electric** — no exhaust, turbo, or wastegate; minimal thump only.

## Believability rules (examples)

- **No exhaust pop on every lift** — cooldown (~3.6s NA), probability (~17%), min speed (~42 km/h), and min throttle drop (~0.3) required.
- **No turbo flutter on NA** — aspiration check before scheduling.
- **No aggressive rev-match on tiny corrections** — min speed, min load, min speed delta (~9 km/h), unless a real downshift is in progress (`targetGear` drops).

## Integration

```
PowertrainSimulator → DriveState → DynamicDriveSynth.update()
  → tickTransientScheduler() → computeDynamicLayerWeights() → Web Audio layers
```

State is seeded per synth instance (`createTransientSchedulerState`) for repeatable variation within a session. Previous powertrain and speed are tracked frame-to-frame for edge detection and speed-delta gating.

## Tuning

Defaults live in `defaultSchedulerProfile()` in `src/lib/sound/dynamic-drive/transient-scheduler.ts`. Per-personality pools and overrides are in `src/lib/drive/drivetrain-personalities.ts` under each personality’s `transient` block.

When adding sample assets later, keep variant `id` strings stable — they map to future WAV/OGG filenames in the asset manifest.
