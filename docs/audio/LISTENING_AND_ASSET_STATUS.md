# Listening and asset status (realization follow-up)

**Date:** 2026-10-10  
**Decision fork (plan):** fill Muscle pilot approved assets **or** execute headphone listening and update matrix statuses honestly.  
**Chosen path:** **assets remain unavailable** (do not invent recordings or licenses) **and** listening checklist is recorded as **not human-executed**. Matrix statuses stay honest: no row promoted to `listening verified`.

Related: [`ARTIFACTS_AND_TRACKING.md`](./ARTIFACTS_AND_TRACKING.md), [`AMERICAN_V8_HYBRID_PILOT.md`](../AMERICAN_V8_HYBRID_PILOT.md), [`driving-experience-validation.md`](./driving-experience-validation.md), [`profile-upgrade-matrix.md`](./profile-upgrade-matrix.md).

## Separation of gates

| Gate | Meaning | Status 2026-10-10 |
| --- | --- | --- |
| Implemented | Code/config present in worktree | Yes for diagnostics, drivetrain, procedural V2, experience-config, pilot wiring |
| Technically tested (offline signal) | Deterministic OfflineAudioContext renders / analysis.json | Local artifacts present (untracked); 57/57 portfolio, 11 A/B pairs |
| Listening approved | Human headphone + optional Tesla cabin checklist signed | **No — 0 / 57** |
| Sample-assisted realism | Approved WAVs active in hybrid bank | **No — pilot slots empty** |

Automated metrics and commit messages do **not** establish audible realism.

---

## Fork A — American Muscle V8 approved assets

### Runtime check

Typed manifest: `src/lib/sound/realism/v2/american-v8-pilot-manifest.ts`.

| Metric | Value |
| --- | --- |
| Required slots | 9 |
| Approved (`isPilotEntryApproved`) | **0** |
| Missing IDs | `american-v8-idle`, `american-v8-onload-low`, `american-v8-onload-mid`, `american-v8-onload-high`, `american-v8-offload-low`, `american-v8-offload-mid`, `american-v8-offload-high`, `american-v8-overrun-low`, `american-v8-overrun-high` |

Every slot currently has `assetPath: null`, `sourceLicense.approval: "unknown"`, unknown engine identity / perspective / RPM / load / loop / trim / overlap.

### Explicit rejection

- Research extracts under `ELCAMOSO_Sound_Profile_Package/.../extracted-labeled-audio/` (`V8_source-1/2/7.wav`) are **not** registered: license unknown, identity unverified, RPM/load/loop unknown; autocorrelation too weak for steady loops. Inventoried with SHA-256 / levels only in `american-muscle-v8-research-inventory.json`.
- No commercial rights or app-embedding approval was invented.
- Procedural Realism V2 + empty bank fallback remains authoritative.
- Config status for `american-muscle-v8` stays **`hybrid`** (integration capable), **not** `listening verified`.
- Full pilot packet: [`AMERICAN_MUSCLE_V8_PILOT_REVIEW.md`](./AMERICAN_MUSCLE_V8_PILOT_REVIEW.md). Gates: implemented · technically verified · **not** reference-compared · **not** listening approved.

### Still required before sample realism can be claimed

Same list as [`AMERICAN_V8_HYBRID_PILOT.md`](../AMERICAN_V8_HYBRID_PILOT.md): one consistent perspective; steady idle / on-load / off-load / overrun loops with measured metadata and approved license records.

---

## Fork B — Headphone listening checklist (honest execution log)

Source checklist: [`driving-experience-validation.md`](./driving-experience-validation.md). Intended audition set: `artifacts/audio-comparisons/2026-10-10/` (matched + untouched; supersedes the 2026-09-26 set for Realism V2 because that set was rendered with the fallback excitation).

| Step | Environment | Result |
| --- | --- | --- |
| 0. Shift = torque cut → thump → reengage bark; rev-match flare on downshift (V2.2) | Headphones | **Not performed** (metrics only, see below) |
| 1. Idle Muscle vs GT character | Headphones | **Not performed** (requires human) |
| 2. 3–5 s accel load texture (not gain-only) | Headphones | **Not performed** |
| 3. 5–7 s cruise fatigue / loop / whistle | Headphones | **Not performed** |
| 4. 7–9 s lift / regen restraint | Headphones | **Not performed** |
| 5. 9–11 s shift coherence | Headphones | **Not performed** |
| 6. Stereo vs mono hollow / cancel | Headphones | **Not performed** |
| T1–T3 Tesla fixed EQ/volume | Vehicle browser | **Not performed** (correctly not fabricated) |

### Technical evidence available without listening approval

From local `artifacts/audio-comparisons/2026-09-26/analysis.json` and portfolio report (worktree-only until committed):

- Identical 16.5 s deterministic manual-input replay across variants.
- Approximate meters only (not true peak / certified LUFS).
- Prior validation write-up: 0 clipped samples on 57-profile portfolio; documented offline vs worklet differences.

#### Realism V2.2 technical pass (2026-10-10, `artifacts/audio-comparisons/2026-10-10/analysis.json`)

Rendered after the V2.2 changes (legacy gearbox fix, FREE virtual transmission, transient choreography, de-synthesised excitation, order resonators, pipe IR). The worklet-loading bug fixed in this pass means this is the **first** offline evidence of the real worklet excitation: all 9 combustion V2 renders report `realism-v2-worklet` (2026-09-26: all `realism-v2-fallback`).

| Check | Realism V2.2 (9 combustion profiles) | Current engine (same profiles) |
| --- | --- | --- |
| Clipped samples (22 renders) | 0 | 0 |
| Cruise → hard-acceleration contrast | 11.8–14.7 dB (pre-calibration 18.5–25.2 dB; target 12–16) | 2.9–5.5 dB |
| Shift event: loudest 20 ms after shift vs 300 ms bed before | +4.6 to +8.8 dB | +1.6 to +4.2 dB |
| Shift event: net RMS lift over 180 ms | +0.2 to +4.3 dB (torque cut included) | -0.1 to +1.2 dB |
| Cruise L/R correlation | 0.31–0.83 | 1.00 (mono) |
| Scheduler events fired | upshift, downshift, drivetrain-thump on all; rev-match + overrun on Muscle / Big Twin | n/a |

Calibration performed during the pass (documented in `docs/AUDIO_REALISM_V2.md`): excitation loudness decoupled from intensity with rate compensation so idle does not vanish; load contrast consolidated on the combustion bus; transient voice peaks raised with a 40 % floor so pulses read over the bed. Master gain / limiter untouched.

`motorcycle-superbike` light-demand map was remapped (factor 0.82 → 0.2) so 1→2 lands in the city band; the offline replay now produces upshifts around the 50 km/h and 65 km/h cruises while WOT still holds 1st past 120 km/h. `electric-hypercar` and `wiesn-tractor` do not use V2 by design.

This supports **technically tested**, not **listening approved**. Nobody has listened to the 2026-10-10 renders on headphones or in a vehicle.

---

## Matrix status honesty

| Status value | Count policy after this follow-up |
| --- | --- |
| `listening verified` | Remains **unused** (0 profiles) |
| `hybrid` | `american-muscle-v8` only — wiring, no approved bank |
| `procedural upgrade` | Remainder of registry |
| `unchanged` | Unused |

No matrix row was promoted to `listening verified` based on this review.

---

## Next human actions

1. Commit or externally archive untracked evidence per [`ARTIFACTS_AND_TRACKING.md`](./ARTIFACTS_AND_TRACKING.md) when ready.
2. Supply approved Muscle recordings **or** complete the headphone/Tesla checklist and only then update specific matrix rows + `profile-experience-config` status fields.
3. Do not raise master gain to simulate realism.
