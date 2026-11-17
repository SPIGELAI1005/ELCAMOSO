# Caravan Carriage assets

## Hero still

- `original-george.png` — George’s reference, already 1672×941 RGB (the catalog hero size). Kept unchanged as the source.
- `caravan-carriage.png` — prepared catalog still: mild denoise and sharpen, slightly crushed studio-black backdrop, same composition. Also at `public/hero/sound-profiles/caravan-carriage.png`.
- `before-after.png` — original vs prepared, including a 100% crop.

No Real-ESRGAN/waifu2x pass was used: the source was already the target resolution, so a faithful cleanup was applied instead of upscaling.

## Street-call one-shots

Exact Romanian text (with diacritics):

- Woman: **Fiare vechi. Fiare vechi luăm**
- Man: **Fiare vechi, frigidere vechi, calorifere, electronice luăm**

Generated locally with Piper 1.8 (`piper-tts`) and the official **ro_RO-mihai-medium** voice downloaded from [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices/tree/main/ro/ro_RO/mihai/medium). The accompanying `MODEL_CARD` says the dataset is CC0 and the checkpoint was finetuned from the **rdh** base (CC0). That retrained medium voice is listed for commercial use in [OHF-Voice/piper1-gpl docs/COMMERCIAL_USE.md](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/COMMERCIAL_USE.md). Piper itself is not shipped in the app.

Official Piper currently has no female Romanian voice. Third-party female Romanian Piper voices (Lili, Sanda, Raluca, Liana from eduardem) are **CC BY-NC 4.0** and were not used. The woman's call is the same Mihai take, pitch-shifted up (~5 semitones) with formants shifted, then given a slight chant contour, light outdoor echo and distance EQ. Length scale was raised so vowels sit a little longer. Loudness was peak-normalised to −1.5 dBFS.

TTS may sound robotic. These files have not been checked by ear.

Runtime files: `public/sample-packs/caravan-carriage/fiare-vechi-woman.m4a` and `fiare-vechi-man.m4a`.

Listen-on-the-box previews (WAV + MP3) also live at `/workspace/elcamoso-pending-assets/caravan-carriage/`.
