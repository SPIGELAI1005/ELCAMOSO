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

- Research extracts under `ELCAMOSO_Sound_Profile_Package/.../extracted-audio-research/` are **not** registered: license, identity, RPM/load anchors and loops remain unknown.
- No SHA-256, commercial rights, or app-embedding record was invented.
- Procedural Realism V2 + empty bank fallback remains authoritative.
- Config status for `american-muscle-v8` stays **`hybrid`** (integration capable), **not** `listening verified`.

### Still required before sample realism can be claimed

Same list as [`AMERICAN_V8_HYBRID_PILOT.md`](../AMERICAN_V8_HYBRID_PILOT.md): one consistent perspective; steady idle / on-load / off-load / overrun loops with measured metadata and approved license records.

---

## Fork B — Headphone listening checklist (honest execution log)

Source checklist: [`driving-experience-validation.md`](./driving-experience-validation.md). Intended audition set: `artifacts/audio-comparisons/2026-09-26/` (matched + untouched).

| Step | Environment | Result |
| --- | --- | --- |
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

This supports **technically tested**, not **listening approved**.

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
