# Symphony audio assets

ELCAMOSO Drive Symphony must never ship copyrighted commercial songs or artist-imitating packs.

## Allowed sources

- Original compositions created for ELCAMOSO
- Commissioned works with written license
- Explicitly compatible / cleared library material with documentation

## Required format (production stems)

| Spec          | Value                                                          |
| ------------- | -------------------------------------------------------------- |
| Sample rate   | **48 kHz** preferred (44.1 kHz accepted if documented)         |
| Bit depth     | 24-bit WAV source                                              |
| Channels      | Stereo                                                         |
| Loop          | Seamless; exact integer bars at pack BPM                       |
| Normalization | Integrated loudness target ≈ −18 LUFS per stem before packGain |
| Headroom      | Leave ≥6 dB before master limiter when all stems peak          |
| Naming        | `/public/audio/symphony/{packId}/{stemId}.wav`                 |

## Manifest fields (per pack)

- `bpm`, `key`, `beatsPerBar`, `barsPerLoop`
- Stem list with `assetPath` (or procedural fallback)
- `licensing.source`: `original` \| `commissioned` \| `licensed`
- `licensing.notes`, creator, asset version

## V1 status

Cinematic Rock, Motion Orchestra, and Neon Run include development synthesis for local iteration.
They do not ship as production music. Each stem must receive an approved manifest and decoded WAV
through `assetPath`; production loading and playback fail closed until every stem passes the asset
audit.

## Do not

- Use chart songs, film scores, or recognizable artist styles as placeholders
- Claim licensed audio until files and paperwork exist in-repo or CDN
