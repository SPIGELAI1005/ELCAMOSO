# Drivetrain personalities

Each **Sound Profile** with `drivetrainMode: "virtual-transmission"` references a **drivetrain personality** by id. Personalities are pure configuration: the powertrain simulator, legacy transmission model, and Dynamic Drive audio layers all read the same values. Runtime code resolves configuration — it does not branch on profile names.

## Core personalities (launch set)

| Id | Sound profiles | Gears | Idle → Redline | Upshift (ms) | Kickdown | Overrun | Transient character |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| `flat-six-sport` | Flat-Six Sport, Race Car, Racing V10 | 7 | 880 → 8000 | 110 / 160 | Late, high threshold | Moderate | NA, crisp rev-match |
| `american-v8` | American Muscle V8 | 5 | 680 → 6000 | 280 / 340 | Lazy, floor pedal | Strong | NA, long overrun pops |
| `turbo-inline-6` | Turbo Inline-6, Rally Car | 7 | 750 → 7000 | 130 / 180 | Early, elastic | Medium | Turbo flutter, wastegate |
| `gt-v8` | GT V8 | 6 | 900 → 6500 | 95 / 140 | Sport, refined | Light | NA, quick rev-match |
| `synthetic-ev` | Synthetic Hyper EV | 6 | 0 → 12000 | 75 / 90 | Instant, low threshold | Low | Electric clunk, no rev-match |

Extended personalities: `motorcycle-inline-4`, `v-twin-cruiser`, `single-cylinder-ag`.

Registry: `src/lib/drive/drivetrain-personalities.ts`.

## Configuration blocks

| Block | Controls |
| --- | --- |
| `engine` | Idle and redline RPM |
| `transmission.gearRatios` | Physical gear spacing (count = number of gears) |
| `transmission.upshiftRpm` | Load-dependent shift RPM (low / medium / high) |
| `transmission.kickdown` | Floor-pedal downshift threshold, min speed, max steps |
| `transmission.shift` | Shift duration, min hold, rev-match, torque dip |
| `throttle` | Pedal attack / release (engine response feel) |
| `overrun` | Lift-off probability, cooldown, prior-throttle gate |
| `behavior` | Shift aggression multiplier, engine response scaling |
| `transient` | Dynamic Drive crossfade strengths, aspiration, scheduler overrides, **variant pools** |
| `motion` | Pitch smoothing for improved synth path |
| `legacy` | Simplified ratios for Legacy Mode (`computeDriveState`) |

## Attach a personality to a Sound Profile

```typescript
{
  id: "my-profile",
  name: "My Profile",
  drivetrainMode: "virtual-transmission",
  drivetrainPersonalityId: "gt-v8",
  voice: { /* timbre only — oscillators, filters, textures */ },
}
```

At runtime:

- **Dynamic Drive on** — `resolveDrivetrain(profile)` → `PowertrainSimulator` + layered audio
- **Legacy Mode** — `withPersonalityTransmission(profile)` syncs the legacy `transmission` box for `computeDriveState`

Resolution order (`src/lib/drive/drivetrain-resolve.ts`):

1. `soundProfile.drivetrainPersonalityId`
2. Legacy map for older profile ids (e.g. `race-car` → `flat-six-sport`)
3. Default `gt-v8`

## Create a new personality

1. Add an object to `DRIVETRAIN_PERSONALITIES` in `drivetrain-personalities.ts` with a unique `id`.
2. Tune `transmission` (gear count, ratios, shift RPM, kickdown, shift duration).
3. Tune `overrun`, `behavior`, and `transient` (include `variantPools` for one-shot shapes).
4. Set `legacy.gearRatios` for Legacy Mode (kmh→RPM slopes, same gear count).
5. Point Sound Profiles at it: `drivetrainPersonalityId: "your-id"`.
6. Validate:
   - `npx vitest run src/lib/drive/drivetrain-personalities.test.ts src/lib/powertrain`
   - `/debug/powertrain` — scenario traces
   - `/debug` — Dynamic Drive audio layers

No engine changes are required unless you introduce a new **aspiration** class (`na` | `turbo` | `electric`). Aspiration selects default scheduler probabilities in `transient-scheduler.ts`; everything else is data-driven.

## Create a new Sound Profile (reuse existing personality)

1. Add a `SoundProfile` in `profiles.ts` or `profiles-expansion.ts`.
2. Set `drivetrainMode: "virtual-transmission"` and `drivetrainPersonalityId`.
3. Define `voice` only for timbre — do not duplicate transmission tuning in the profile.
4. Optional: register a strategy in `realism/strategies*.ts` for Improved / Legacy synth layers.

## Files

| File | Role |
| --- | --- |
| `src/lib/drive/drivetrain-personalities.ts` | Personality registry (source of truth) |
| `src/lib/drive/drivetrain-resolve.ts` | Sound Profile → powertrain + transients |
| `src/lib/powertrain/profiles.ts` | Re-exports `POWERTRAIN_PROFILES` |
| `src/lib/powertrain/types-config.ts` | Transmission TypeScript interfaces |
| `src/lib/sound/dynamic-drive/layer-weights.ts` | RPM band crossfade from config |
| `src/lib/sound/dynamic-drive/transient-scheduler.ts` | Event scheduling from config |
