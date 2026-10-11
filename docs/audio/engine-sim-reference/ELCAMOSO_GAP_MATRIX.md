# ELCAMOSO ↔ Engine Simulator gap matrix

**Inspection date:** 2026-10-11  
**Upstream:** `ange-yaghi/engine-sim@85f7c3b`  
**ELCAMOSO HEAD:** `38beb9b` + uncommitted working-tree audio extensions (V3 overlay, catalog tuning, seed port).  
**Evidence basis:** source inspection + adapted Node worklet diagnostic. No listening / Tesla validation.

Classification key:

| Tag | Meaning |
| --- | --- |
| Already implemented | Present on the inspected V2 execution path |
| Partially implemented | Related mechanism exists but differs materially |
| Missing from inspected execution path | Not present where combustion audio is actually generated |
| Previously reported issue, now fixed | Archive finding rechecked and fixed in current tree |
| Not appropriate for browser | Native-only or harmful to transplant |
| Unverified | Incomplete evidence |

---

| Capability | Upstream evidence | Current ELCAMOSO evidence | Classification | Expected benefit | Implementation risk | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Explicit per-cylinder firing schedule over 720° | `IgnitionModule::setFiringOrder/update` | Aggregate `phase` impulse train in `combustion-processor.js`; architecture only modulates punch/intervals | Missing from inspected execution path | Stronger engine identity / bank pattern | Medium (worklet contract + tests) | **P0** |
| Cylinder→bank→collector routing | GM LS banks + `writeToSynthesizer` staging buffer | Shared excitation → formants/orders; optional tiny L/R pan by `bank` flip | Missing from inspected execution path | Cross-plane / flat-plane character without OEM branding | Medium–high | **P0** |
| Per-runner length delays | `DelayFilter` from primary+exhaust length / 343 | Synthetic shared pipe IR delays only (`buildPipeImpulse`) | Missing from inspected execution path | Pulse spacing / lower-mid body | Medium (ring buffers, level independence) | **P0** |
| Load/RPM pressure-shaped pulses from flow | Runner P + dynamic P → audio (`writeToSynthesizer`) | Hand-designed env/edge/burst tails shaped by load/sharpness | Partially implemented | Less “electronic click train” | Medium (aliasing, headroom) | **P1** |
| Per-collector impulse responses | Per synth input channel convolution + script IR refs | One shared ConvolverNode pipe IR | Partially implemented | Collector identity | Low–medium (assets/synth IRs) | **P1** |
| Profile-specific engine-order schema consumed by renderer | N/A (physics-driven spectrum) | `supportRatios/supportWeights` on config; `HybridCombustionSynth` hardcodes ½/1/2× firing order; recipe metadata copies weights only | Missing from inspected execution path (metadata exists) | Tunable identity without misleading fields | Low–medium | **P0** (contract) |
| Architecture / topology contract | Explicit angles + exhaust systems | `architecture` string vs `architectureCode` 0–5; `FLAT_PLANE_V8_TRACK` uses code **5** (“single”); Rally Turbo 3 uses lope code **1** | Partially implemented / defect | Correct flat-plane vs single semantics | Low | **P0** |
| Zero-valued worklet parameter semantics | N/A | `parameters.x[0] \|\| fallback` still present; adapted diagnostic: zero ≡ fallback | Previously reported issue, **still open** (not fixed) | Correct stop/idle edge behaviour; safer topology work | Low | **P0** |
| DC removal on excitation | Synth DC filter @ 10 Hz | Worklet bipolar DC block (`0.9975`) | Already implemented | Stability | — | — |
| Cycle jitter / event variability | `JitterFilter` + script jitter | Per-fire timing/amp jitter + wander (V2.2) | Partially implemented | Texture | Low | P2 |
| Derivative / air-noise mix | `dF_F_mix`, airNoise LPF | Burst noise + grit; no exact derivative stage | Partially implemented | Optional edge texture | Medium (harshness) | P3 (default off) |
| Convolution infrastructure | Custom FIR | `AudioContext.createConvolver` | Already implemented | Space | — | Keep |
| Authoritative RPM/gear/load | Native transmission + engine | `PowertrainSimulator` + personalities | Already implemented (ELCAMOSO path) | Motion lock | — | Preserve |
| Full thermodynamic / rigid-body solver | `GasSystem`, chamber, SCS | Perceptual procedural model | Not appropriate for browser (initial) | — | Very high | Out of scope |
| Native int16 leveling / hard clip / ~100 ms latency | Leveler 30000, INT16 clamp, latency 0.1 s | Float graph + master limiter (≤0.85) | Not appropriate for browser | — | High if copied | Do not port |
| Threads / mutex synth | `std::thread`, locks | AudioWorklet + main thread messages | Not appropriate for browser | — | — | Do not port |
| Recorded combustion sample banks | Not required by upstream pressure pipeline | `SOUND_ASSET_CATALOG=[]`; `EMPTY_COMBUSTION_SAMPLE_BANKS`; Muscle pilot slots unapproved | Missing from inspected execution path (independent gap) | Optional recorded texture | Asset/legal | Parallel track |
| Drive Audio V3 raw-mechanical overlay | N/A | Opt-in `v3` for muscle / flat-six pilots on HybridCombustionSynth | Partially implemented (ELCAMOSO-only) | Extra mechanical colour for pilots | Medium; listening pending | Keep separate from engine-sim port |
| Catalog tuning overlays | N/A | Prompt 07 overlays on acoustic configs | Already implemented (metadata→some runtime knobs) | Differentiation | Low | Does not replace topology |
| Shared vs separate runner signals | Separate delayed channels | Single excitation node fans out | Missing from inspected execution path | Identity / interference | Medium | **P0** with topology |
| Aggregate vs scheduled fires | Per-cylinder events | Aggregate firingHz train | Missing from inspected execution path | Rhythm identity | Medium | **P0** |

### Recheck of archive “Concrete ELCAMOSO issues”

| Earlier finding | Status after recheck |
| --- | --- |
| Zero-valued worklet controls via `\|\|` | **Fixed (2026-10-11).** Finite `readParam`; diagnostic + unit tests. |
| Flat-plane V8 `architectureCode: 5` = single | **Fixed (2026-10-11).** Contract v1: flat-plane = **6**, single = **5**. Race Car remapped. |
| `supportRatios` / `supportWeights` unused by V2 resonators | **Partially addressed.** Consumed when `VITE_COMBUSTION_PROFILE_ORDER_BANDS=1`; default OFF keeps legacy three-band path. |
| Aggregate pulse vs explicit cylinder schedule | **Pilot (flagged).** `VITE_COMBUSTION_TOPOLOGY_PILOT` for Muscle V8 + Race Car; default off. |
| Shared excitation vs runner/collector signals | **Pilot (flagged).** Per-cylinder primary delays + collector pan in worklet when topology on. Full per-collector IR path still open. |
| Empty approved combustion sample banks | **Still true.** |
