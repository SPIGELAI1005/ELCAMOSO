# Caravan Carriage assets

## Hero still

- `original-george.png` — George’s reference, already 1672×941 RGB (the catalog hero size). Kept unchanged as the source.
- `caravan-carriage.png` — prepared catalog still: mild denoise and sharpen, slightly crushed studio-black backdrop, same composition. Also at `public/hero/sound-profiles/caravan-carriage.png`.
- `before-after.png` — original vs prepared, including a 100% crop.

No Real-ESRGAN/waifu2x pass was used: the source was already the target resolution, so a faithful cleanup was applied instead of upscaling.

## Street-call one-shots

**TEST ONLY — do not merge or ship as-is.** The runtime files
`public/sample-packs/caravan-carriage/fiare-vechi-{woman,man}.m4a` are currently
cuts from George’s Suno song “Fiare Vechi Luam”
(https://suno.com/s/vVWzRwhQvHSreHOw), made on the **free plan**. Suno’s help
article [If I subscribe, do I get rights for the songs I made before
subscribing?](https://help.suno.com/en/articles/2425729) says: “Subscribing to
a Pro or Premier plan does not give you retroactive commercial use licensing
for the songs made with a free plan by default.” If the cries are kept, they
must be regenerated on a paid plan (same prompt, new download) or replaced
with the Piper v2 fallback below.

Piper v2 fallback (CC0 Mihai, commercially listed), kept here:

- `fiare-vechi-{woman,man}-piper-v2.wav` / `.mp3` / `.m4a`


Exact Romanian text (with diacritics):

- Woman: **Fiare vechi. Fiare vechi luăm**
- Man: **Fiare vechi, frigidere vechi, calorifere, electronice luăm**

Piper v2 (fallback) is a drawn-out sung/shouted street cry. Stressed and final vowels are held for 0.65–1.45 s (pitch-synchronous overlap-add of a stable Mihai vowel grain, plus a same-voice vowel bank). A chant melody is imposed with Praat PSOLA: rise on *Fiaaa*, hold high on *re*, a falling fourth on *vechiii* (with a glide toward /i/), and a long fall on *luaaam*. The man's list items are each held (*frigidereee, caloriferee, electroniceee*). Light 5.4 Hz vibrato sits on the long notes. Outdoor shout processing: 2–4 kHz presence, light saturation, compression, slap echo and distance. The woman is the same Mihai voice with formants shifted up (~+21%) and the chant set around D♯4 (311–373 Hz); the man is slightly darker (formant 0.97) and rougher, chanted around D♯3 (156–187 Hz, falling to 109 Hz on *luaaam*).

v1 (the shorter, less sung takes) is kept as `fiare-vechi-{woman,man}-v1.wav` and `.mp3`.

Generated locally with Piper 1.8 (`piper-tts`) and the official **ro_RO-mihai-medium** voice downloaded from [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices/tree/main/ro/ro_RO/mihai/medium). The accompanying `MODEL_CARD` says the dataset is CC0 and the checkpoint was finetuned from the **rdh** base (CC0). That retrained medium voice is listed for commercial use in [OHF-Voice/piper1-gpl docs/COMMERCIAL_USE.md](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/COMMERCIAL_USE.md). Piper itself is not shipped in the app.

Official Piper currently has no female Romanian voice. Third-party female Romanian Piper voices (Lili, Sanda, Raluca, Liana from eduardem) are **CC BY-NC 4.0** and were not used.

Spectrogram + pitch-contour plots: `fiare-vechi-woman-contour.png` and `fiare-vechi-man-contour.png`.

TTS may sound robotic, and the long held vowels are looped from short grains, so they may still not match a real street cry. These files have not been checked by ear.

Runtime files (currently the Suno TEST-ONLY cuts): `public/sample-packs/caravan-carriage/fiare-vechi-woman.m4a` and `fiare-vechi-man.m4a`.

Listen-on-the-box previews (WAV + MP3, plus the v1 copies and contour plots) also live at `/workspace/elcamoso-pending-assets/caravan-carriage/`.
