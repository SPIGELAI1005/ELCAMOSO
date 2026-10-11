# Engine Simulator → ELCAMOSO extraction report

**Inspection date:** 2026-10-11  
**Upstream:** [ange-yaghi/engine-sim@85f7c3b](https://github.com/ange-yaghi/engine-sim/tree/85f7c3b959a908ed5232ede4f1a4ac7eafe6b630)  
**Archive ELCAMOSO comparison rev:** [38beb9b](https://github.com/SPIGELAI1005/ELCAMOSO/tree/38beb9b65b2030f0d94ea62004a475e8dd53e1ed)  
**Current checkout HEAD:** `38beb9b65b2030f0d94ea62004a475e8dd53e1ed` (matches archive)  
**Working tree:** HEAD plus substantial uncommitted local work (Drive Audio V3 overlay, catalog tuning, worklet seed port, Cockpit, entitlements, etc.). Production audio behaviour was **not** changed by this extraction task.

## Archive location

| Item | Path |
| --- | --- |
| Supplied package (already expanded) | `Prompt Updates/ELCAMOSO_EngineSim_Extraction/ELCAMOSO_EngineSim_Extraction/` |
| Upstream subset | `…/upstream/` |
| This reference output | `docs/audio/engine-sim-reference/` |

The path `Prompt Updates/ELCAMOSO_EngineSim_Extraction.zip/…` does not exist as a nested zip mount; the expanded folder is the usable source.

Treat the package as a **selected source-reference subset**, not a standalone build or browser port. No native simulator install, external services, commit, push, or deploy were performed.

---

## 1. Source integrity

All **25** files listed in `SOURCE_MANIFEST.json` were verified against Git blob SHAs (header `blob <nbytes>\0` + exact file bytes, SHA-1).

| Result | Count |
| --- | --- |
| Present | 25 |
| Hash match | 25 |
| Missing | 0 |
| Mismatch | 0 |

Upstream license (MIT, Copyright 2022 AngeTheGreat / Ange Yaghi) is retained at `upstream/LICENSE`. Retain that notice with any copied or substantially adapted code.

**Not in the package (referenced by extracted code):** `units.h`, `constants.h`, `utilities.h`, `crankshaft.h`, `function.h`, `part.h`, `filter.h`, `ring_buffer.h`, Butterworth / leveling filters, rigid-body SCS headers, impulse-response library binaries / WAV assets, and most other engine scripts. Values that depend on those includes are recorded as expressions with **resolved SI = unknown** where conversion cannot be proven from this subset alone.

---

## 2. Inspected revisions vs current checkout

| Revision | Role |
| --- | --- |
| Upstream `85f7c3b` | Pinned Engine Simulator sources in the archive |
| ELCAMOSO `38beb9b` | Archive comparison baseline **and** current `git rev-parse HEAD` |
| Working tree (uncommitted) | Newer than the archive’s inspected audio surface |

Relevant uncommitted audio-related deltas since `38beb9b` (must be preserved; not treated as “already fixed archive findings”):

- `public/audio/combustion-processor.js`: optional `port` seed message; slight `bodyTauSeconds` retune. **Truthiness `||` defaults remain.**
- `src/lib/sound/realism/v2/acoustic-engine.ts`: catalog-tuning wrapper (`acousticEngineForProfile`). **`FLAT_PLANE_V8_TRACK.architectureCode` still `5`.**
- `src/lib/sound/realism/v2/hybrid-combustion-synth.ts`: large Drive Audio V3 / raw-mechanical overlay path. **Order bands still hardcoded; shared excitation unchanged.**
- `src/lib/sound/realism/v2/combustion-excitation.ts`: seed plumbing.
- New `src/lib/sound/realism/v3/*` (opt-in pilots), catalog-tuning, samples manifests, gain-staging, shift-events.
- `SOUND_ASSET_CATALOG` / empty combustion banks still empty.

Unrelated uncommitted work (account, entitlements, cockpit, rewards, etc.) was left untouched.

---

## 3. Extracted functionality (code-verified)

Scope note: the GM LS script (`07_gm_ls.mr`) is **one configured example engine**, not a universal engine model. Generic capabilities come from C++ classes; numeric topology values below marked **script-scoped** apply only to that asset.

### 3.1 Cylinder count and engine-cycle conventions

| Item | Evidence | Notes |
| --- | --- | --- |
| Per-cylinder plugs | `IgnitionModule::initialize` — `m_cylinderCount = params.cylinderCount`; allocates `SparkPlug[m_cylinderCount]` (`ignition_module.cpp` L32–38) | Generic |
| Cycle angle domain | `update` uses `fourPi = 4 * constants::pi` (`ignition_module.cpp` L57–61) | Four-stroke **720°** (2π×2) in radians; `constants::pi` not in package → exact float unknown |
| Script cycle label | `label cycle(2 * 360 * units.deg)` (`07_gm_ls.mr` L6) | Script-scoped convention |
| GM LS banks | Two `cylinder_bank` with four cylinders each (`07_gm_ls.mr` L268–365) | Script: **8 cylinders**, V-angle `90 * units.deg` |

**Reuse:** adaptation / reference. Browser should keep `firingHz = RPM × cylinders / 120` (already in ELCAMOSO) while moving to explicit 720° event tables.

### 3.2 Firing order and per-cylinder firing angles

| Item | Evidence |
| --- | --- |
| API | `setFiringOrder(cylinderIndex, angle)` stores `m_plugs[i].angle` (`ignition_module.cpp` L41–46) |
| Event emit | On cycle-angle crossing of `adjustedAngle = positiveMod(plug.angle - advance, fourPi)`, set `ignitionEvent` (`ignition_module.cpp` L53–85) |
| GM LS order comment | `// 1 8 7 2 6 5 4 3` (`07_gm_ls.mr` L105, L200) |
| GM LS wire angles | `connect_wire(wire1..wire3, n * 90 * units.deg)` for n=0..7 (`07_gm_ls.mr` L413–421) |

**Script-scoped pattern:** equal **90°** ignition spacing over the cycle with order 1-8-7-2-6-5-4-3. That is not “every V8”; flat-plane and other layouts differ.

**Relevance:** engine identity, mechanical texture, responsiveness.  
**Reuse:** concepts → worklet topology; not a direct JS port of crankshaft/rigid-body coupling.

### 3.3 Cylinder-to-bank and cylinder-to-exhaust routing

| Item | Evidence |
| --- | --- |
| Bank B0 → `exhaust0` | Cylinders on `b0` set `exhaust_system: exhaust0` (`07_gm_ls.mr` L270–310) |
| Bank B1 → `exhaust1` | Cylinders on `b1` set `exhaust_system: exhaust1` (`07_gm_ls.mr` L318–358) |
| Runtime routing | `writeToSynthesizer` indexes `exhaustSystem->getIndex()` and accumulates into `m_exhaustFlowStagingBuffer[index]` (`piston_engine_simulator.cpp` L405–409) |

**Script note:** odd firing wires (1,3,5,7) sit on bank 0 / exhaust0; even (2,4,6,8) on bank 1 / exhaust1. Cross-plane identity is bank sequence, not only L/R pan.

**Relevance:** engine identity, bass body via collector interference.  
**Reuse:** adaptation (topology tables + collector buses).

### 3.4 Primary / header lengths, exhaust lengths, acoustic delays

| Item | Expression / values | Scope |
| --- | --- | --- |
| Delay init | `exhaustLength = headerPrimary + exhaust->getLength()`; `delay = exhaustLength / speedOfSound` with `speedOfSound = 343.0 * units::m / units::sec`; `m_delayFilters[i].initialize(delay, 10000.0)` (`piston_engine_simulator.cpp` L221–226) | Generic |
| Delay line | Integer sample delay `round(delay * audioFrequency)` (`delay_filter.h` L20–26) | Generic; **integer**, not fractional |
| Shared primary tube (script) | `primary_tube_length: 29.0 * units.inch` (`07_gm_ls.mr` L242) | Script |
| Exhaust system lengths (script) | `exhaust0` `length: 100 * units.inch`; `exhaust1` `length: 172 * units.inch` (`07_gm_ls.mr` L247–258) | Script |
| Per-cylinder `primary_length` (script) | Unequal: `k * spacing + offset` with `spacing = 2 * units.inch` (`07_gm_ls.mr` L266–357) | Script |
| Audio path attenuation | Staging adds `… * (1 / (exhaustLength * exhaustLength))` (`piston_engine_simulator.cpp` L406–409) | Generic formula; scale is native-specific |

**Unresolved:** SI metres for inch-based script lengths without `units` definitions. Delay in seconds ≈ `exhaustLength_SI / 343` if `units::m/units::sec` normalises to 1.

**Relevance:** bass / pulse spacing / identity.  
**Reuse:** adaptation with **bounded fractional** delays; do not copy `1/length²` or `1600` without calibration.

### 3.5 Ignition timing and rev-limiter

| Item | Evidence |
| --- | --- |
| Advance | `getTimingAdvance()` → `m_timingCurve->sampleTriangle(-crankshaft.v_theta)` (`ignition_module.cpp` L110–112) |
| Defaults | `revLimit = units::rpm(6000)`, `limiterDuration = 0.5 * units::sec` (`ignition_module.h` L16–17) |
| Limiter behaviour | If `|v_theta| > m_revLimit`, set `m_revLimitTimer = m_limiterDuration`; while timer > 0, no new ignition events (`ignition_module.cpp` L56, L88–95) |
| GM LS curve | 12° @ 0–1000 rpm → 40° by 4000 rpm (`07_gm_ls.mr` L397–407) | Script |
| GM LS limiter | `rev_limit: 6800 * units.rpm`, `limiter_duration: 0.2` (`07_gm_ls.mr` L409–412) | Script |

**ELCAMOSO note:** keep `PowertrainSimulator` authoritative for RPM / redline behaviour; optional audio-side cut is secondary.

**Reuse:** reference / light adaptation for ignition-cut texture only.

### 3.6 Combustion-pressure and exhaust-flow calculations

| Item | Evidence |
| --- | --- |
| Chamber flow | `CombustionChamber::flow` exchanges gas chamber ↔ intake runner and exhaust runner/primary via `GasSystem::flow` (`combustion_chamber.cpp` L235–305) |
| Static pressure | `P = E_k / (0.5 * dof * V)` (`gas_system.h` L239–243) |
| Dynamic pressure | Mach-based expression from momentum (`gas_system.h` L196–232) |
| Audio sample from runner | `exhaustFlow = attenuation_3 * 1600 * (1.0*(P - 1 atm) + 0.1*dyn(+x) + 0.1*dyn(-x))` (`piston_engine_simulator.cpp` L394–398) |
| Speed attenuation | `attenuation = min(|filteredEngineSpeed|, 40)/40`; cubed (`L376–377`) | Units of “40” depend on `filteredEngineSpeed()` / rpm helpers — **resolved threshold unknown** without full units |

**Reuse:** reference-only for full thermodynamics; **adaptation** as a lightweight blowdown / flow-tail envelope shaped by load/RPM.

### 3.7 Pulse attenuation and collector mixing

Documented in §3.4–3.6: per-cylinder delay → sound attenuation × audio volume × delayed pulse / cylinderCount × `1/length²` → sum into exhaust-system channels → `synthesizer().writeInput(...)`.

Fixed `lastValveLift[8]` in `writeToSynthesizer` (`piston_engine_simulator.cpp` L379) is **not** a production-quality port template for >8 cylinders.

### 3.8 Intake / exhaust parameters and response shaping

**ExhaustSystem parameters** (`exhaust_system.h` L13–21): length, collectorCrossSectionArea, outletFlowRate, primaryTubeLength, primaryFlowRate, velocityDecay, audioVolume, impulseResponse.

**Intake parameters** (`intake.h` L10–36): plenum volume/area, flow Ks, runner length (default `4 inch`), velocity decay (default 0.5), idle throttle plate, molecular AFR default 25/2.

GM LS intake script values (`07_gm_ls.mr` L229–237): plenum `1.325 L`, runner length `12 inch`, velocity_decay `0.5`, etc. — **script-scoped**.

**Reuse:** inform profile load/resonance modelling; not a WASM gas solver for v1.

### 3.9 Convolution and impulse-response handling

| Item | Evidence |
| --- | --- |
| Per-channel IR load | `initializeImpulseResponse` trims to last sample with `|x|>100`, caps at 10000 samples, scales `volume * sample / INT16_MAX` (`synthesizer.cpp` L86–104) |
| Processing | Time-domain FIR shift-register (`convolution_filter.cpp` L37–51) |
| Mix | `v = convAmount * conv(v_in) + (1-convAmount)*v_in` (`synthesizer.cpp` L311–313); default `convolution = 1.0` (`synthesizer.h` L22) |
| Script | Both exhaust systems reference `ir_lib.default_0` (`07_gm_ls.mr` L251–258) — **IR binary not in package** |

**ELCAMOSO already has** `ConvolverNode` + synthetic ~70 ms pipe IR. Upstream difference is **per-collector** IRs, not “missing convolution.”

**Reuse:** reuse Web Audio convolution; avoid naive per-sample FIR in the worklet.

### 3.10 Derivative mix, jitter, filtered noise, DC removal

Defaults (`synthesizer.h` L20–30):

- `dF_F_mix = 0.01`
- `airNoise = 1.0`, `airNoiseFrequencyCutoff = 2000`
- `inputSampleNoise = 0.5`, cutoff `10000`
- DC filter cutoff `10 Hz` (`synthesizer.cpp` L65–66)
- Derivative `m_dt = 1/audioSampleRate` (`L63`); `(sample - previous) / m_dt` (`derivative_filter.cpp` L12–16)
- Mix: `v_in = f_p * dF_F_mix + f * r_mixed * (1 - dF_F_mix)` with `r_mixed = airNoise * LPF(noise) + (1-airNoise)` (`synthesizer.cpp` L294–306)
- Jitter: filtered fractional read of delay history, default maxJitter 10 (`jitter_filter.h` L22–46; init in `synthesizer.cpp` L68–71)
- Incidental detail: air-noise LPF uses `m_filters->airNoiseLowPass` (channel 0) inside the per-channel loop (`L300`)

**Reuse:** optional experiments only; derivative amplifies HF and needs normalisation in float graphs. Not a bass generator.

### 3.11 Simulation vs audio sample rates and resampling

| Rate | Value | Source |
| --- | --- | --- |
| Default simulation frequency | `10000` Hz (`simulator.cpp` L13); GM LS sets `simulation_frequency: 10000` | |
| Synth input sample rate | simulation frequency (× speed) (`simulator.cpp` L72, L210) | |
| Audio output rate | `44100` (`simulator.cpp` L207; `synthesizer.h` L38) | |
| Delay filter init freq | `10000.0` hardcoded with delay (`piston_engine_simulator.cpp` L226) | |
| Target synth latency | `m_targetSynthesizerLatency = 0.1` s (`simulator.cpp` L12) | ~100 ms — **not** a browser default to copy |
| Antialias | 1900 Hz per channel + master `0.45 * audioSampleRate` (`synthesizer.cpp` L73, L79) | |

Resampling path between input and output buffers exists in the synthesizer thread; full interpolator implementation spans omitted helpers — treat as **reference**, use AudioContext sampleRate in browser.

### 3.12 Gain, leveling, clipping, output format

- Leveler targets `30000`, max gain `1.9`, min `1e-5` (`synthesizer.h` L28–30) — **int16-scale** assumptions.
- Output: `lround(leveled * volume)` then clamp to `INT16_MAX/MIN` (`synthesizer.cpp` L321–330).
- Hard clipping and integer PCM are **not appropriate** to transplant; ELCAMOSO uses float Web Audio + master limiter (max gain 0.85 per product rules).

### 3.13 Transmission / clutch

`Transmission::update` sets clutch constraint torque to `± maxClutchTorque * clutchPressure` when in gear; gear change remaps rotating-mass inertia via gear×diff×tire (`transmission.cpp` L33–81). GM LS example: six ratios 2.97…0.57, max clutch `500 lb_ft` (`07_gm_ls.mr` L438–448).

**Reuse:** reference only. **ELCAMOSO `PowertrainSimulator` remains authoritative** for virtual RPM, gear, and load.

---

## 4. Worklet diagnostic (current processor)

Original `reproduce-worklet-controls.cjs` **fails** on the working-tree processor because the constructor assigns `this.port.onmessage` and the harness’s stub `AudioWorkletProcessor` has no `port`.

Adapted Node VM harness (port stub only; processor code unchanged) against `public/audio/combustion-processor.js`:

| Parameter | Zero equals `\|\|` fallback (≤1e-7) | maxAbsDiff |
| --- | --- | --- |
| `firingHz` | **true** | 0 |
| `intensity` | **true** | ~3e-8 |
| `load` | **true** | ~3e-8 |
| `sharpness` | **true** | ~1.5e-8 |

**Confirmed:** zero-valued controls are still overwritten by truthiness defaults. Scope: offline Node VM only — not browser, Tesla, or listening validation.

Results saved conceptually with this report; see also archive `worklet-control-results.json` (same qualitative conclusion at older body-tau tuning).

---

## 5. Dependencies and limitations

- Subset excludes thermodynamics support headers, IR assets, and unit definitions.
- No listening tests or Tesla browser runs in this task.
- Automated signal checks ≠ acoustic quality.
- Do not present GM LS geometry as universal.
- Native threads, mutexes, int16 clipping, and full gas/rigid-body solvers are out of scope for the initial browser adaptation.

## 6. Deliverables in this directory

| File | Purpose |
| --- | --- |
| `EXTRACTION_REPORT.md` | This document |
| `EXTRACTED_PARAMETERS.json` | Machine-readable verified values / expressions |
| `ELCAMOSO_GAP_MATRIX.md` | Capability gap classifications |
| `BROWSER_ADAPTATION_PLAN.md` | Files to extend, interfaces, tests, rollout |
| `NEXT_CURSOR_PROMPT.md` | Single next implementation prompt |
