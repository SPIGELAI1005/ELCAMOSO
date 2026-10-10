# American Muscle V8 hybrid sound pilot

Status: integration complete; recorded-sample realism not delivered.

The `american-muscle-v8` Realism V2 path always starts with continuous procedural combustion, intake/body resonances, valvetrain texture, overrun and shift events. The Current renderer remains available on `/debug` for controlled A/B comparison.

The typed source-of-truth is `src/lib/sound/realism/v2/american-v8-pilot-manifest.ts`. Every candidate must have an approved source and license record, confirmed American Muscle V8 identity, a consistent recording perspective, steady RPM and load anchors with confidence, verified loop boundaries, gain trim, overlap trim and a permitted playback-rate range. A changing-RPM rev sweep is not accepted as a steady loop.

No repository recording currently meets those requirements. The extracted V8 research files are not registered because their license approval, engine identity, RPM/load anchors and loop metadata are unknown. Runtime check 2026-10-10: all nine slot IDs remain missing (`missingPilotRecordingRequirements()`); approved count **0**. Honest status log: [`docs/audio/LISTENING_AND_ASSET_STATUS.md`](./audio/LISTENING_AND_ASSET_STATUS.md).

## Recordings still required

All recordings should use one consistent perspective and capture stable, steady operating points:

1. Idle loop.
2. Low-RPM on-load loop.
3. Mid-RPM on-load loop.
4. High-RPM on-load loop.
5. Low-RPM off-load loop.
6. Mid-RPM off-load loop.
7. High-RPM off-load loop.
8. Low-RPM overrun loop.
9. High-RPM overrun loop.

For each file, provide the asset path, source record, approved license record, perspective, measured RPM anchor, load state and normalized load anchor, loop start/end in seconds, trim in dB, permitted playback-rate range, RPM/load confidence and measured overlap trim.

At runtime, adjacent RPM and load anchors are blended with normalized linear-amplitude weights. This intentionally does not assume equal-power crossfades are correct for correlated recordings. If no entry covers the requested target/source RPM ratio, the sample layer fades out and procedural combustion remains authoritative.

Fetching and decoding run outside the AudioWorklet callback. Missing, rejected, partially delivered or undecodable assets leave the drive operational on procedural fallback. Profile switches abort stale loading and dispose all sample voices.
