# Caravan Carriage

**Profile ID:** `caravan-carriage`  
**Portfolio category:** Heritage  
**Technical family:** environmental  
**Drivetrain mode:** `continuous`

A new catalog identity with its own name, description and hero still. The carriage audio engine, samples, gait and wheel behaviour are reused unchanged from `romanian-85-carriage`. This is not the planned carriage-sound upgrade.

## Street calls

Occasional Romanian scrap-collector cries. Exact text:

- Woman: Fiare vechi. Fiare vechi luăm
- Man: Fiare vechi, frigidere vechi, calorifere, electronice luăm


**TEST ONLY:** the runtime overlays are currently cuts from the Suno song “Fiare Vechi Luam” (https://suno.com/s/vVWzRwhQvHSreHOw), made on the free plan and **not licensed for commercial use**. They must be replaced by a paid-plan regeneration or the Piper v2 fallback in `assets/caravan-carriage/fiare-vechi-*-piper-v2.*` before this is merged. Playback timing is unchanged (woman first, then the man; first pair after a short delay, then at most once every few minutes).

The woman plays first, then the man a few seconds later. The pair starts after a short delay and then at most once every few minutes.

v2 is sung and shouted: held vowels last 0.65–1.45 s, with a chant contour (rise on *Fiaaa*, high hold on *re*, falling fourth on *vechiii*, long fall on *luaaam*). The woman is formant-shifted Mihai around D♯4; the man is lower and rougher around D♯3. There was no commercially licensed official female Romanian Piper voice. TTS may sound robotic, and the takes have not been checked by ear. The earlier shorter takes are kept as `assets/caravan-carriage/fiare-vechi-*-v1.*`.
