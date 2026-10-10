# American Muscle V8 pilot review (2026-10-10)

**Public profile ID:** `american-muscle-v8` (unchanged)  
**Personality / sample bank key:** `american-v8`  
**Renderer:** Realism V2 `HybridCombustionSynth` (procedural default; sample-assist when approved)

This document is the single review packet for the Muscle pilot. It does **not** expand the change to other profiles.

---

## Gate status (keep these separate)

| Gate | Meaning | Status |
| --- | --- | --- |
| **Implemented** | Code/config for Muscle V2 + sample bank wiring + coverage diagnostics | **Yes** |
| **Technically verified** | Offline deterministic render + metrics for Muscle (clipping, shift lift, stereo, backend) | **Yes** (see `artifacts/audio-comparisons/american-muscle-v8-pilot-2026-10-10/`) |
| **Reference-compared** | Side-by-side vs **approved** steady-state reference loops with known RPM/load/perspective | **No** — no approved references |
| **Listening approved** | Human headphone (and optional Tesla cabin) checklist signed | **No** |

Automated meters and commit messages do not grant listening approval or vehicle replication claims.

---

## 1. Target (verified facts vs design choices)

### Verified facts (architecture / product)

| Fact | Source |
| --- | --- |
| Eight-cylinder, four-stroke combustion profile | `acoustic-engine.ts` `AMERICAN_V8`, personality `american-v8` |
| Cross-plane V8 lope architecture code | `architecture: "cross-plane-v8-lope"`, worklet `architectureCode: 1` |
| Naturally aspirated (no turbo path) | `forcedInduction: false` |
| Idle / redline anchors 680 / 6000 RPM | drivetrain personality |
| Virtual transmission on live Drive (FREE gears + core shift transients) | entitlements + PowertrainSimulator |
| Cabin output / Road Feel V3 master staging is separate from engine identity | `perceptual-volume.ts`, MasterBus — do not raise master to fake realism |

### Design choices (not a named vehicle)

| Choice | Intent |
| --- | --- |
| Deep exhaust formants (~78 / 156 / 312 / 580 Hz) | Heavy muscle cabin/exhaust body |
| High idle irregularity (~0.4) | Lope at idle without claiming a specific cam |
| Softer combustion sharpness than GT | Body over metallic edge |
| Stronger overrun character than GT | Lift-off presence; still NA, not pop-heavy fake |
| Exhaust-near / cabin hybrid listening intent | Product Drive context; not trackside mic |

**Do not claim** exact vehicle replication (no OEM, no named crate motor, no verified exhaust perspective from approved recordings).

**Intended exhaust character (design):** deep, uneven lope at idle; dense midrange pressure under load; restrained lift-off; mechanical thump on shifts from the shared transient scheduler.

**Listening perspective (design):** driver / cabin-biased product mix (engine identity settings), separate from Tesla/cabin EQ preset.

---

## 2. Sound-source audit

### Approved production recordings

| Slot | Asset | Status |
| --- | --- | --- |
| idle | — | **Missing** |
| on-load low / mid / high | — | **Missing** |
| off-load low / mid / high | — | **Missing** |
| overrun low / high | — | **Missing** |

Typed source of truth: `src/lib/sound/realism/v2/american-v8-pilot-manifest.ts`.  
`isPilotEntryApproved` count: **0**. `SOUND_ASSET_CATALOG`: **empty**. Runtime bank: **procedural only**.

### Research extracts (not approved, not shipped)

Path (private research only):

`ELCAMOSO_Sound_Profile_Package/Videos for sound profiles/trimmed-minus-5s/extracted-labeled-audio/`

| File | Duration | Peak | RMS | SHA-256 (prefix) | Notes |
| --- | --- | --- | --- | --- | --- |
| `V8_source-1.wav` | 9.42 s | −0.8 dBFS | −9.9 dBFS | `27417990…` | Video label “V8” only |
| `V8_source-2.wav` | 6.92 s | −5.5 dBFS | −17.3 dBFS | `350d77f4…` | Video label “V8” only |
| `V8_source-7.wav` | 7.50 s | −15.0 dBFS | −26.6 dBFS | `328c970c…` | Video label “V8” only |

From the folder README (2026-09-26):

- Labels reproduce on-screen video text; they **do not prove** engine architecture.
- Third-party TikTok branding; **no documented commercial or app-embedding license**.
- Suitable for private acoustic research only; **must not** be distributed with the app until rights are documented.

Measured autocorrelation for steady pulse locking is weak (research scores ≪ usable loop threshold). These files are **not** accepted as steady RPM/load loops. **No RPM labels, licenses, or muscle identity were invented.**

### Synthesized vs recorded (runtime)

| Layer | Kind |
| --- | --- |
| Combustion excitation (worklet / fallback) | Synthesized |
| Formants, body, order resonators, pipe IR | Synthesized |
| Shift / thump / overrun / rev-match voices | Synthesized noise envelopes |
| Sample bank voices | Recorded (when approved + decoded) — currently none |

### Gap list (asset dependency)

1. Idle steady loop — approved license, muscle V8 identity, perspective, RPM, loop, trim, overlap.
2. On-load low / mid / high — same.
3. Off-load low / mid / high — same.
4. Overrun low / high — same.
5. Optional event one-shots (shift / pop) — still optional; procedural scheduler covers events.

Until (1–4) exist, sample-assisted realism is **not** complete. Procedural V2 remains authoritative.

Inventory JSON: [`american-muscle-v8-research-inventory.json`](./american-muscle-v8-research-inventory.json).

---

## 3. Sample playback architecture (implemented)

Already shared; Muscle uses the same path:

- RPM-indexed neighbors + independent load-anchor interpolation (`selectSampleMix`).
- Playback rate = target RPM / source RPM, clamped per asset `permittedPlaybackRate`.
- Linear-amplitude weights (not assumed equal-power).
- Uncovered rate / load → sample layer fades; procedural stays up.
- Diagnostics now expose `uncoveredOperatingRegions` (all nine when bank empty).

Cabin / Road Feel gains stay outside engine identity.

---

## 4. Drivetrain behavior (Muscle)

| Signal | Role |
| --- | --- |
| Measured / fused road speed | VehicleMotionState `speedKmh` |
| Estimated / commanded load | Powertrain `engineLoad`, driver demand |
| Simulated RPM | Powertrain RPM from gear × final drive × wheel (plus shift phases) |

Personality `american-v8`: 5-speed, idle 680, redline 6000, long shift durations, rev-match enabled (premium extras). Live Drive uses PowertrainSimulator when `virtual_transmission` is entitled (FREE). Noisy / stale telemetry: dual speed filters (`mechanicalSpeedKmh` vs `shiftDecisionSpeedKmh`); reconnect blend avoids abrupt pitch disconnects.

---

## 5. Comparisons produced this pass

Folder: `artifacts/audio-comparisons/american-muscle-v8-pilot-2026-10-10/` (local / untracked).

| Artifact | Role |
| --- | --- |
| `elcamoso-*-untouched.wav` / `*-loudness-matched.wav` | Muscle V2 offline segments |
| `research-extracts/V8_source-*.wav` | Copies of research files for private A/B only |
| `analysis.json` | Supported meters only (peak, RMS, approx LUFS, clip count, shift lifts) |

**Reference-compared = No** because research extracts are not approved steady loops.

---

## 6. Listening checklist (human — not performed)

Use loudness-matched ELCAMOSO segments on headphones first; keep cabin preset separate.

1. Idle: lope present, not a pitched click train.
2. Steady cruise: no frozen loop seam / whistle from procedural bed.
3. Loaded accel: pressure and brightness change (not gain-only).
4. Lift-off: restrained character; no random cruise pops.
5. Shift: torque cut → thump → reengage bark; RPM follows simulated gear.
6. If research extracts are auditioned: treat as unlabeled third-party audio only — do not score “vehicle match.”

**Listening approved: No.**
