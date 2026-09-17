# ELCAMOSO

Your EV. Your Sound. More Emotion.

ELCAMOSO is a motion-responsive sound experience for electric vehicles.

It uses smartphone speed and motion data to create dynamic sound profiles that react to the
drive in real time. In a Tesla browser, pair a phone via QR (`/pair`) for better motion while
sound stays on the car — see `docs/PHONE_PAIRING.md`.

## Architecture

- `src/lib/drive/model.ts` — the shared `DriveState` telemetry interface (speed, acceleration,
  throttle, regen, virtual RPM, gear, load) and the model that derives it.
- `src/lib/drive/useDriveSession.ts` — geolocation/demo motion source plus the render loop that
  feeds telemetry into the sound engine.
- `src/lib/drive-relay/` — Tesla↔phone pairing sessions and WebSocket sensor relay.
- `src/lib/sound/profiles.ts` — sound profiles. Each declares a `drivetrainMode`:
  - `virtual-transmission` (GT V8, Racing V10): speed → gear → virtual RPM → synthesis.
  - `continuous` (Cyber Pulse): speed, acceleration, throttle and regen → one continuous
    sound-state parameter → synthesis.
- `src/lib/sound/engine.ts` — Web Audio synthesis consuming `DriveState` through the strategy
  declared by the active profile.
- `src/components/ElcamosoLogo.tsx` — the O ))) mark, wordmark and full lockup as SVG/CSS.

Product working memory: `docs/MEMORY_BANK_AND_CHANGELOG.md`. Spec: `elcamoso-comprehensive-spec.md`.

ELCAMOSO is architected as a motion-to-sound platform, not an engine simulator: future profiles
(turbine, cinematic, ambient, manufacturer EV signatures) map the same telemetry differently.

## Development

```sh
npm i
npm run dev
```
