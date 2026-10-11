# Next Cursor prompt — Pressure-shaped pulses on the topology pilot

Contract reconciliation and the topology pilot foundation are in place (2026-10-11). Defaults remain off for topology / profile order bands. Use this prompt next.

---

```text
You are working in the ELCAMOSO repository. Implement only a lightweight pressure-shaped pulse model on top of the existing topology pilot. Do not port the native Engine Simulator gas solver. Do not commit/push/deploy unless asked.

Read first:
- AGENTS.md, elcamoso-comprehensive-spec.md, docs/MEMORY_BANK_AND_CHANGELOG.md
- docs/audio/engine-sim-reference/BROWSER_ADAPTATION_PLAN.md
- docs/audio/engine-sim-reference/ELCAMOSO_GAP_MATRIX.md
- public/audio/combustion-processor.js
- src/lib/sound/realism/v2/combustion-topology.ts
- Prompt Updates/.../upstream/src/combustion_chamber.cpp and piston_engine_simulator.cpp writeToSynthesizer (reference only)

Already done (do not redo):
- Finite worklet AudioParam reads; architecture contract v1 (flat-plane=6, single=5)
- Opt-in profile order bands (VITE_COMBUSTION_PROFILE_ORDER_BANDS)
- Opt-in topology pilot for american-muscle-v8 / race-car (VITE_COMBUSTION_TOPOLOGY_PILOT) with collector routing and primary delays

Implement only:
1. Behind the existing topology pilot flag (or a nested default-off subflag), replace/extend the single decaying env punch with a controlled asymmetric blowdown + flow-tail shaped by RPM and Powertrain load. Preserve the firing schedule; random timing must not replace topology.
2. Keep body energy linked to crank/combustion orders. Optional low-level mechanical/valve micro-events only if gated and phase-related.
3. Optional derivative/air-noise experiment only behind a separate default-off switch with sample-rate normalisation.
4. Tests: DC/finite output, event density, deterministic seed, topology still 8 fires/cycle, flag off = previous topology pilot envelope.
5. Update MEMORY_BANK + short listening questions; do not claim cabin/Tesla validation.

Out of scope: rolling topology to all nine profiles, sample banks, native thermodynamics, int16 clipping, commits.
```
