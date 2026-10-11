# Granular synthesis decision note (Prompt 05)

**Date:** 2026-10-11  
**Question:** Would a granular engine improve available recordings enough to justify CPU/complexity on the existing Web Audio hybrid path?

## Measured context (repository facts)

| Fact | Value |
| --- | --- |
| Approved runtime combustion sample banks | **0** (`SOUND_ASSET_CATALOG` empty; Muscle pilot approvals 0/9) |
| Delivery mode today | `procedural_only` |
| Hybrid layer | BufferSource loops + bounded `playbackRate` + RPM/load crossfade under procedural excitation |
| Worklet already present | Continuous combustion excitation (Realism V2.2) — pulse-driven, not oscillator beds |

There are **no licensed steady loops in the shipping catalog** to granulate. Any granular engine would either run on invented/placeholder buffers (rejected by Prompt 05) or on unlicensed research extracts (also rejected).

## Cost / complexity estimate (order-of-magnitude)

| Approach | Main-thread / audio-thread cost | Complexity | Benefit with 0 approved beds |
| --- | --- | --- | --- |
| Current hybrid (BufferSource + rate + crossfade) | Low; few voices | Low | N/A until assets exist |
| Granular (many overlapping grains, envelope, cloud density) | Medium–high at drive rates; harder OfflineAudioContext parity | High (scheduler, grain pool, seam control, QC) | **None** — no legal source material |
| Improve procedural pulse / raw-mechanical (Prompt 04) | Already paid (worklet) | Medium (landed) | Immediate; no asset dependency |

## Decision

**Do not add a granular engine in Prompt 05.**

Reasons:

1. **No approved recordings** — granular synthesis does not create rights-cleared assets.
2. **Insufficient justification** — the term “granular” does not improve perceived realism by itself; with empty banks the procedural/worklet path remains authoritative.
3. **CPU / complexity** — grain clouds would compete with the combustion worklet, formants, and cabin chain on mobile Tesla browsers without a measured listening win on real loops.
4. **Revisit trigger** — after Priority-1 profiles (`american-muscle-v8`, `flat-six-sport`) have **≥3 steady on-load RPM beds + idle** approved, A/B a short OfflineAudioContext experiment: BufferSource crossfade vs a minimal grain cloud on the **same** licensed files, loudness-matched, human-scored. Only then consider an opt-in flag.

## What to do instead (now)

- Finish acquisition per [`SAMPLE_ACQUISITION_BRIEF.md`](./SAMPLE_ACQUISITION_BRIEF.md).
- Keep hybrid BufferSource + bounded stretch + procedural fallback.
- Continue Prompt 04 raw-mechanical / worklet texture for pilots while assets are pending.
