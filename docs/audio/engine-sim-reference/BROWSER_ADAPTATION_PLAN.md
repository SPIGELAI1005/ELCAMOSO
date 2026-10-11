# Browser adaptation plan (Engine Simulator → ELCAMOSO)

**Inspection date:** 2026-10-11  
**Upstream pin:** `85f7c3b`  
**Constraint:** Do not change production defaults until flagged rollout + matched listening. This extraction task does not implement audio changes.

## Principles (binding)

1. Keep **`PowertrainSimulator`** authoritative for virtual RPM, gear, and load.
2. Prioritise: explicit cylinder schedules → per-runner delays / collectors → load-shaped pulses → profile resonance / mechanical character.
3. Reuse existing convolution, worklet, transient scheduling, and audio diagnostics.
4. Do **not** transplant native threads, mutexes, int16 scales, hard clipping, ~100 ms latency targets, or the full thermodynamic solver without a separate design.
5. Do not assume “more bass / lower pitch / more derivative” improves realism. Preserve distinct engine identities.
6. Scope combustion adaptations to combustion profiles only (nine V2 map + pilots). Never force into electric, Symphony, World, Fusion, nature, or creature paths.
7. Separate code-verified findings from acoustic hypotheses. Node diagnostics ≠ cabin quality.

## Exact files to extend (no duplicate engines)

| Area | Extend | Do not create |
| --- | --- | --- |
| Worklet excitation | `public/audio/combustion-processor.js` | Second worklet “engine-sim-processor” as default |
| Worklet host | `src/lib/sound/realism/v2/combustion-excitation.ts` | Parallel host module |
| Hybrid graph | `src/lib/sound/realism/v2/hybrid-combustion-synth.ts` | Forked synth class for production |
| Acoustic configs | `src/lib/sound/realism/v2/acoustic-engine.ts` (+ catalog-tuning overlays) | Shadow config tree |
| Optional V3 colour | `src/lib/sound/realism/v3/*` stays overlay-only | Do not merge V3 into topology silently |
| Personalities / RPM | `src/lib/powertrain/*`, `src/lib/drive/drivetrain-personalities.ts` | Native transmission port |
| Samples (parallel) | `src/lib/sound-assets/catalog.ts`, `sample-bank.ts`, pilot manifest | Fake approved assets |
| Specs / memory | `elcamoso-comprehensive-spec.md`, `docs/MEMORY_BANK_AND_CHANGELOG.md`, `docs/AUDIO_REALISM_V2.md` | — |

New **reference-only** docs live under `docs/audio/engine-sim-reference/` (this folder). Optionally later: a small shared topology TypeScript module that **emits JSON** consumed by the worklet (worklet cannot import TS).

## Proposed interfaces

### 1. Versioned topology message (worklet)

```ts
interface CombustionTopologyV1 {
  version: 1;
  cycleDegrees: 360 | 720;
  cylinderCount: number; // bounded, e.g. 1..12
  cylinders: Array<{
    id: number;
    firingAngleDegrees: number; // [0, cycleDegrees)
    collectorId: number;
    pulseWeight: number; // finite, >0, bounded
    primaryLengthMetres: number; // bounded, documented
  }>;
  collectors: Array<{
    id: number;
    // response params or IR key — synthetic allowed if labelled
  }>;
  soundSpeedMetresPerSecond: number; // default 343, documented
}
```

- Validate on host before `port.postMessage({ type: "topology", topology })`.
- Apply atomically with documented reset/crossfade policy.
- Dynamic RPM/load/sharpness remain AudioParams; topology is static-ish.

### 2. Architecture contract

Replace overloaded `architectureCode` 0–5 with either:

- validated mapping table generated into a small JS snippet next to the worklet, or
- topology-only mode where architecture enums only select **preset topology tables**.

`flat-plane-v8` and `single` must not share code `5`. Rally Turbo 3 lope shortcut must be explicit until a 3-cylinder schedule ships.

### 3. Order-band schema

Connect `supportRatios` / `supportWeights` **or** replace them with:

```ts
interface EngineOrderBand {
  /** Crank orders (cycles per crank revolution), not firing-frequency multiples — document which. */
  crankOrder: number;
  weight: number; // 0..1
  q: number; // bounded
}
```

Renderer must consume the schema under a flag; old three-band construction remains default until enabled.

### 4. Parameter read helpers (worklet)

```js
function readParam(values, fallback, min, max) {
  const v = values[0];
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}
```

Zero firingHz → no new fires; tails decay. Intensity/load/sharpness at 0 keep defined timbre semantics (not silently remapped to defaults).

## DSP adaptations

| Stage | Approach |
| --- | --- |
| Cylinder events | Continuous crank phase; `phaseAdvanceDegrees = RPM * 6 / sampleRate`; schedule all crossed angles including wrap; fractional subsample timing |
| Pulse shape | Start from existing env/edge/burst; evolve to asymmetric blowdown + flow tail vs load/RPM; no full `GasSystem` |
| Runner delay | Preallocated fractional delay lines; `delay = clamp(primaryLengthMetres / soundSpeed)`; level **not** automatically `1/L²` |
| Collectors | N mono buses (start N=2 for V8 pilots) summed before existing formant/order/pipe graph |
| Convolution | Reuse `ConvolverNode`; optional per-collector send; synthetic IRs labelled non-measured |
| Derivative / air-noise | Feature-flag default **off**; sample-rate normalise; anti-harsh LP |
| Output | Existing master bus / limiter; no int16 clip |

## Tests

1. **Unit:** finite param reads (0, NaN, missing, OOR); architecture/topology validation; fires-per-cycle at several RPM×sampleRate; wrap; no double-fire; deterministic seed.
2. **Worklet VM:** extend diagnostic harness with `port` stub (required after seed message).
3. **Graph:** mono sum finite; collector mute; topology hot-swap; Powertrain RPM still drives rate.
4. **Regression:** Current/V2 A/B on `/debug` unchanged when flags off; V3 pilots unaffected when topology flag off.
5. **Fixtures:** matched dry / topology / collector renders for muscle + race-car (offline lab scripts).
6. **Non-claims:** do not mark listening-verified or Tesla-approved from automated metrics alone.

## Reversible rollout

| Flag / mode | Behaviour |
| --- | --- |
| Default | Current V2.2 aggregate worklet + hybrid graph |
| `topologyPilot` (name TBD) | Muscle V8 + Race Car only |
| Order-schema flag | Optional; default off |
| Derivative experiment | Default off |
| V3 raw mechanical | Remains separate `VITE_DRIVE_AUDIO_V3` |

Rollback = disable flags; no migration of user settings required if defaults unchanged.

## Phased delivery

1. **Contract fixes** — zero params, architecture mapping, order-band schema honesty (`NEXT_CURSOR_PROMPT.md`).
2. **Topology pilot** — explicit schedules + collectors for `american-muscle-v8` and `race-car`.
3. **Runner delays + collector responses** — fractional delays; extend pipe IR path.
4. **Pressure-shaped pulses** — lightweight model; layer-isolated listening.
5. **Roll out** remaining seven combustion IDs with identity rationales.
6. **Samples** — parallel acquisition; empty banks stay valid.

## License

Retain MIT notice from `upstream/LICENSE` wherever Engine Simulator code is copied or substantially adapted.
