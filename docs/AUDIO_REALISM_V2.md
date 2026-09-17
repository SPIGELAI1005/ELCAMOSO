# Audio Realism V2

**Status:** Implemented (procedural-first). Sample-assisted path is schema-ready; no combustion WAVs ship yet.

**Related:** `docs/SOUND_CHARACTER_SPEC.md`, `docs/audio-asset-requirements.md`, `docs/SOUND_NOISE_AND_FIDELITY.md`, `docs/DYNAMIC_DRIVE_ARCHITECTURE.md`

---

## Goal

Combustion Sound Profiles (GT V8, American Muscle V8, Flat-Six Sport, Turbo Inline-6, Racing V10, Race Car, Rally Car) must stop reading as oscillator stacks. Realism V2 uses a **hybrid** backend:

1. **Procedural fallback (always available)** — continuous combustion excitation → resonant formants → restrained support harmonics.
2. **Sample-assisted (optional)** — licensed/self-recorded loops crossfaded by RPM × load, with procedural continuity underneath.

Do **not** solve realism by EQ-ing sawtooth voices or raising broadband noise.

---

## A/B mechanism (dev only)

| Control | Values | Where |
| ------- | ------ | ----- |
| `SoundEngine.setRealismEngine` | `"current"` \| `"v2"` | Not a customer setting |
| Debug harness | **Current Engine** / **Realism V2** | `/debug` (DEV only) |

- **Current:** existing ImprovedSynth + optional Dynamic Drive synth (unchanged).
- **V2:** for eligible combustion profiles, `HybridCombustionSynth` owns the tonal core. Same motion / powertrain trace can be replayed through both.

Lifecycle preserved: environment buses, cabin EQ, master bus, limiter (`MAX_GAIN` 0.85), profile crossfade, snippets.

---

## Signal flow (V2)

```
DriveState (+ optional VirtualPowertrainState)
  → HybridCombustionSynth.update
       ├─ firingHz = RPM/60 × cylinders/2   (true four-stroke; no 40 Hz event-node path)
       ├─ AudioWorklet excitation (or AM brown fallback)
       │     → exhaust formants (semi-stationary) → body bus
       │     → intake formants → beds bus
       ├─ triangle/sine support harmonics (order-linked, not sawtooth stack) → body
       ├─ mechanical bandpass (restrained) → accents
       ├─ overrun / turbo (state-gated) → beds / accents
       └─ shift: resonant impulse + RPM/load envelope (not white-noise burst)
  → body / accents / beds → cabin EQ → master → limiter → destination
```

Legacy `createCombustionPulseLayer` (per-fire OscillatorNodes, 40 Hz cap) is **not** used on the V2 path.

---

## Excitation performance

| Mode | Mechanism |
| ---- | --------- |
| Worklet | `/audio/combustion-processor.js` — one processor, impulse train at `firingHz` |
| Fallback | Single looping brown buffer AM’d by one sine at `firingHz` |

No hundreds of `OscillatorNode`s per second. Worklet is prefetched in `SoundEngine.start`. Diagnostics: `getHybridCombustionDiagnostics()` → `excitationMode`, `firingHz`, gains.

---

## Acoustic archetypes

Configured in `src/lib/sound/realism/v2/acoustic-engine.ts` and mirrored on drivetrain personality `engine.acoustic`:

| Profile | Character |
| ------- | --------- |
| GT V8 | Refined cross-plane pulse, darker body |
| American Muscle V8 | Stronger idle lope / uneven LF exhaust |
| Flat-Six / Race Car | Overlapping pulse, upper-mid mechanical/intake |
| Turbo Inline-6 / Rally | Smooth I6 + load-linked spool / lift flutter |
| Racing V10 | Dense firing, strong high-RPM intake |

Irregularity is **idle-gated** and fades under load — no random pitch wobble at cruise.

---

## Sample-bank schema

See `src/lib/sound/realism/v2/sample-bank.ts`:

```ts
interface CombustionSampleEntry {
  assetId: string;
  personalityId: string;
  rpmRef: number;
  load: "idle" | "low" | "medium" | "high" | "overrun";
  loopStart?: number;
  loopEnd?: number;
  gain?: number;
}
```

- Crossfade adjacent RPM refs; playback-rate window ≈ **0.85–1.18**, then switch neighbor.
- Register assets in `sound-assets/catalog.ts` (never `public/` for premium WAVs).
- Empty banks today → 100% procedural.

Suggested GT V8 loop set (when recorded): idle 900, low 1800/2500/3500, high 2500/3500/4500/5500, overrun — see `docs/audio-asset-requirements.md`.

---

## Load must change timbre

At fixed RPM, rising `driverDemand` / `engineLoad`:

- raises combustion intensity and upper formant energy
- opens intake presence
- keeps formant **centers** mostly stationary (anti “pitch-bent synth”)

Highway cruise vs kickdown at similar speed is therefore distinguishable.

---

## Shift / overrun / turbo

| Event | V2 behaviour |
| ----- | ------------ |
| Upshift | Torque-cut intensity dip from shift progress; short resonant engagement impulse |
| Rev-match downshift | Intensity flare with rev-match progress; RPM from powertrain |
| Overrun | Intake drops; overrun bed; optional contextual pop after prior load |
| Turbo | Spool inertia from RPM×demand; flutter only on strong lift after boost |

---

## Profiles out of scope

Electronic, ambient, nature, playful, and EV continuous profiles keep Current Improved / classic paths. V2 button disables for non-combustion ids on `/debug`.

---

## Manual listening checklist

1. GT V8 idle → 3k → 5k: same mechanical character, not a bent sawtooth.
2. Same RPM, light vs heavy load: clearly different body/intake.
3. Cruise 30 s: no constant hiss.
4. Upshift: RPM fall + brief engagement, not a noise burst.
5. Turbo I6: spool with load; flutter only after boost lift.
6. A/B Current vs V2 on the same `/debug` scenario.

---

## What still needs licensed recordings

- Personality-specific idle/cruise/high-load loops
- Shift / rev-match / overrun one-shots replacing procedural impulses
- Turbo BOV / wastegate character samples

Procedural V2 is the production fallback until those assets exist.
