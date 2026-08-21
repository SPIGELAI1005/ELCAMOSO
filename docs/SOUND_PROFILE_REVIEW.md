# Sound Profile Review

Listening/status notes after the 25-profile expansion (47 built-ins total) and the **2026-08-21 noise / fidelity pass**.
Statuses are engineering judgments from architecture + short offline renders — not a claim that every profile is finished studio-grade.

**Noise & environments:** see `docs/SOUND_NOISE_AND_FIDELITY.md` (Showroom `textureScale: 0`, global hiss cuts, Horse Gallop gait rewrite).

| Profile | Status | Strength | Known limitation | Next tuning step |
|---------|--------|----------|------------------|------------------|
| GT V8 | solid | Heavier exhaust body vs intake | Idle was mild | Mild lump + stronger body |
| Flat-Six Sport | solid | Mid rasp under throttle | Was thin in 1.5–4 kHz | Intake + nasal-mid / rasp layers |
| American Muscle V8 | solid | Lumpy idle + heavy exhaust | Was too even at idle | `lumpiness` + idle presence |
| Turbo Inline-6 | solid | Lagging spool + lift dump | Blowoff was rare | Longer lag + wastegate + blowoff |
| Electric Hypercar | solid | Motor + inverter mesh on accel | Mesh was subtle | `meshBoost` + throttle inverter |
| Formula Electric | solid | Technical whine + reduction | Was harsh above 4 kHz | Softened shimmer + 2.6 kHz filter ceiling |
| Neon Drive | needs listen | Pulse density with speed | Was metronomic; may still feel synthetic | A/B vs Showroom; gate density |
| Maglev Train | solid | Guideway hum at low speed | Low speed was thin | Idle hum + stronger structure |
| High-Speed Train | solid | Denser mid-speed joints | Joints were sparse | Cobble joints + densityScale |
| Submarine | solid | Hull + manual/auto sonar | Ping was rare beam | `sonar` kind + Studio/Debug trigger |
| Jet Ski | solid | Agile water + hull slap | Slap weakly tied to jerk | Stronger jerkWeight on stone |
| Motorcycle Superbike | solid | Immediate high-rev | Was bright on phones | 3 kHz ceiling, quieter chain/intake |
| Big Twin | strong | Asymmetrical cadence + mid body | Phone sub loss | Mid body 95–240 Hz + filter ceiling |
| Snowmobile | solid | Soft snow thumps + belt | Snow felt like gravel | `softThump` packed-snow hits |
| Tank | solid | Tracks + mid hull knock | Diesel was thin | Knock pulse + midKnock tracks |
| Construction Monster | needs listen | Hydraulics as cue | Can still read as machinery bed | Solo accents in Showroom |
| Horse Gallop | improved | Speed-mapped walk/trot/canter/gallop + flight | Procedural only; no sample neigh | Listen at rising speed; breath on throttle |
| Dragon | needs listen | Organic breath + rare roar | Mythic, not literal animal | Darker breath vs Thunder |
| Thunder Beast | solid | Dark pressure + thunder | Overlapped Dragon | Darker breath, brown bed, no wing |
| Retro Arcade | solid | 8-bit with phone-safe LP | HF square edge | Softer square, more triangle, mid cabinet |
| Synthwave Drive | solid | Long filter evolution | Arp was dense | Slower arp + lagged LP envelope |
| Deep Bass Pulse | strong | 58–160 Hz presence for cabin | Easy to bury on phones | Presence oscillator + mid air bed |
| Zen Drive | solid | Calm wind + rare chimes | Chimes were frequent | ~55s interval, quieter bells |
| Rain Drive | improved | Mid-speed spray + wash | Was too hissy | Lower noise + rain layer; Showroom = dry voice |
| Ocean Drive | improved | Slow swell, foam with speed | Swell tracked speed too much | Quieter beds; Showroom A/B |
| Heartbeat | strong | Lub-dub + intensity BPM | Not medical | Ensure no kick-drum feel |
| Turbine Jet / Private Jet | improved | Spool character | Were white-noise heavy | Cut voice.noise + wind/sizzle textures |

## Strongest five (current)

1. Big Twin  
2. Deep Bass Pulse  
3. Heartbeat  
4. Maglev Train  
5. Turbo Inline-6  

## Most needing subjective tuning

1. Settings → Environment → **Showroom**, then A/B Horse Gallop vs Wild West Carriage  
2. Cabin EQ → **Phone speakers** for jets and Rain Drive  
3. Neon Drive and Construction Monster title fidelity  
4. Dragon vs Thunder Beast differentiation on headphones  

### Chrome / sticky UI

- Removed `overflow-x: clip` from `html`/`body` (it broke `position: sticky`).  
- BrandNav fixed at top with safe-area inset; MiniPlayer sits under it.  
- Sounds + Studio listen strips use `chromeStickyTopClass` so they stick under nav (+ MiniPlayer when live).

### Pass notes (optional set: Submarine / Ocean / Deep Bass / Zen / Twin+Arcade)

- **Submarine**: dedicated `sonar` one-shot (ping + soft return); auto cadence + hard-accel ping; Studio **Sonar ping** + Debug **Trigger**.
- **Ocean Drive**: slower swell LFO; foam opens with speed; crest energy on accel.
- **Deep Bass Pulse**: fundamental ~58–95 Hz + 90–160 Hz presence for phones; mid air bed.
- **Zen Drive**: chimes ~55s ±28s at lower level (stay rare).
- **Big Twin**: mid-body resonances + 2.8 kHz filter ceiling for phone clarity.
- **Retro Arcade**: lower LP ceiling, triangle-forward mix, mid cabinet bed.

### Noise / Showroom pass (2026-08-21)

See `docs/SOUND_NOISE_AND_FIDELITY.md`.

## Assets

All expansion profiles are **procedural** (`sourceMode: "procedural"`). No sample packs were added. No YouTube/commercial extracts.

## Performance notes

- Only the active profile graph is built (existing `SoundEngine` / `ImprovedSynth` path).
- Expansion layers reuse shared primitives; arcade/synthwave keep oscillator counts low.
- Prefer `/debug` layer solo when tuning bright electrics and arcade profiles on iPhone Safari.
- Prefer Environment **Showroom** when judging core voice without beds.
