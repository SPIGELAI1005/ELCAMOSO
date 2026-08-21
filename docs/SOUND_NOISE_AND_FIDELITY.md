# Sound noise control and fidelity pass

**Date:** 2026-08-21  
**Scope:** Built-in environments + voice noise / texture beds across all 47 profiles; Horse Gallop gait fidelity; documentation.

## Goals

1. Reduce built-in white / broadband hiss that was drowning many profiles.
2. Add a professional **Showroom** environment with effectively no texture noise.
3. Improve profiles that did not match their titles (priority: **Horse Gallop**), using published gait research.
4. Leave a clear review trail for further listening.

## Environment: `textureScale`

Each `EnvironmentPreset` now has `textureScale` (0..1).

| Value | Meaning |
|-------|---------|
| `0` | Mute texture beds + legacy voice noise + profile texture beds (Showroom) |
| `< 1` | Quieter beds / hiss while keeping character |
| `1` | Full texture (legacy feel; rain/countryside stay near full) |

Applied in `SoundEngine` to:

- Layer bus **beds** balance (`applyMix` / `updateSpace`)
- Legacy `voice.noise` gain
- Profile `textures[]` bed levels (`updateTextures`)

### Presets (current)

| Id | Name | textureScale | Notes |
|----|------|--------------|-------|
| `showroom` | Showroom | **0** | Quiet floor: dry, intimate, core voice + accents only |
| `open` | Open road | 0.72 | Default listening; beds pulled back |
| `city` | City street | 0.78 | Accents forward, less hiss |
| `countryside` | Countryside gravel | 0.9 | Still textured |
| `rain` | Rain road | 0.95 | Spray remains intentional |
| `old-town` | Old town | 0.8 | Warm space, quieter beds |

UI: Environment picker on Demo / Settings surfaces lists **Showroom** first.

## Global noise reductions

### Engine

- Legacy noise gain curve softened (`~0.35` master scale → `~0.22`, lower load/regen weights).
- Wind layer HF (white) band contribution reduced.

### Profile `voice.noise`

Batch remap of values above 0.12 in `profiles.ts` and `profiles-expansion.ts` (28 values):

- Mid hiss (0.12–0.22) × 0.75  
- High (0.22–0.4) × 0.55  
- Extreme (>0.4) × 0.48, capped ~0.45  

Largest cuts: Turbine Jet, Private Jet, Rain Drive, steam / ocean / wind beds.

### Texture beds

Lowered loud wind / water / sizzle texture levels on aviation and nature profiles so Showroom + Open road stay clean without killing character when textureScale is high.

## Horse Gallop fidelity

Research basis (transverse gallop / Mad Barn gait guide / biomechanics literature):

- **Walk:** even four-beat  
- **Trot:** diagonal two-beat pairs  
- **Canter:** three-beat + short suspension  
- **Gallop:** four distinct footfalls (e.g. RH–LH–RF–LF) + **gathered flight** after the lead  

Implementation (`createHoofLayer` in `layers.ts`):

- Single horse focus (was 4 overlapping → muddy hiss)
- Brown grit + low thud (not white-noise click)
- Stereo limb placement (hind / fore)
- Stride interval includes flight multiplier at canter/gallop
- Strategy: drop continuous wind; soft ground thumps; quieter pink breath/snort under throttle

Legacy `fireGallop` rhythm in the classic engine path aligned to the same relative footfall pattern.

## Listening checklist

1. Environment → **Showroom**, Demo Start, GT V8 then Horse Gallop: voice clear, no constant hiss.  
2. Environment → **Open road**: light beds only.  
3. Environment → **Rain road** + Rain Drive: spray present but not white-noise wash.  
4. Horse Gallop: walk → speed up → hear gait change and airborne gap at gallop.  
5. Cabin EQ → Phone speakers for jet / rain profiles.

## Follow-ups (not all done this pass)

- Sample-assisted accents for neigh / whip (still procedural).  
- Dedicated canter vs gallop user toggle (today speed-mapped).  
- Per-profile `textureBias` override if a nature profile must ignore Showroom mute (not required yet).  
- Further title-vs-timbre reviews: Dragon, Neon Drive, Construction Monster (see `SOUND_PROFILE_REVIEW.md`).

## Files touched

- `src/lib/sound/environments.ts`
- `src/lib/sound/engine.ts`
- `src/lib/sound/dsp/layers.ts`
- `src/lib/sound/realism/strategies-extra.ts`
- `src/lib/sound/profiles.ts`
- `src/lib/sound/profiles-expansion.ts`
- `docs/SOUND_NOISE_AND_FIDELITY.md` (this file)
- `docs/SOUND_PROFILE_REVIEW.md`
- `docs/MEMORY_BANK_AND_CHANGELOG.md`
