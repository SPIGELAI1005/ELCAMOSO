# Journey Composer

**Status:** V1 local
**Promise:** Every drive creates a different song — without storing routes by default.

## Pipeline

```
DriveSession.stop
  → TraceRecorder snapshot or Silent Capture JourneyTraceV1
  → summariseJourneyFromTrace / summariseJourneyFromJourneyTrace
  → JourneySummary (IndexedDB elcamoso-journeys)
  → Post-drive screen
  → JourneyComposer (condensed chapters)
  → OfflineAudioContext + Symphony pack → WAV blob
```

## Journey schema (retained)

| Field                                | Notes                                          |
| ------------------------------------ | ---------------------------------------------- |
| id, date, duration                   | Local                                          |
| distanceM                            | Optional, from integrated speed — not GPS path |
| Experience / profile / Symphony pack | Names + ids                                    |
| seed                                 | Deterministic variation                        |
| energyTimeline                       | Downsampled 0..1 energy                        |
| semantic / gear markers              | Musical events only                            |
| cruise / regen periods               | Time ranges                                    |
| arrangementTimeline                  | Movement-state markers                         |
| Drive DNA                            | Five dimensions + archetype                    |
| song / reel metadata                 | Composition + optional audio blob key          |

## Excluded (default)

- latitude / longitude
- exact route / polyline
- home / work / street labels
- raw sensor upload for rendering

Existing `DriveTrace` samples are motion telemetry (`DriveState`) — no coordinates today. Journey summarisation never copies coordinate-like keys.

## Composition

Target **~2–3 minutes** (`90–180s`). Chapters:

INTRO → BUILD → GROOVE → RISE → PEAK → RELEASE → OUTRO

Moments picked from opening, first build, peak, cruise, regen, ending. Same seed + summary → same structure.

Journey Composer is not Journey Replay:

- **REPLAY DRIVE** follows the original `JourneyTraceV1` in real time and can reinterpret it through Engine / Symphony / World / Fusion.
- **DRIVE SONG** selects and condenses moments into a 2–3 minute musical work.
- Silent Capture can create a Drive Song directly; its composer summary keeps the JourneyTrace id, so the same Journey is enriched rather than duplicated.
- Saving a Replay **Remix** stores a `JourneyInterpretationV1`; creating or remixing a Drive Song stores composition metadata/audio on the `JourneySummary`.

## Rendering

- Prefer `OfflineAudioContext` client-side
- Reuses Symphony stems / arrangement via `SoundEngine`
- Output: **WAV** (`audio/wav`) stored in IndexedDB
- Compressed encoding / server render is a later opt-in path

## Routes

| Route                   | Role                                                                        |
| ----------------------- | --------------------------------------------------------------------------- |
| `/journeys`             | Library + filters                                                           |
| `/journeys/$journeyId`  | Journey Replay/Remix + separate Drive Song player / create / share / delete |
| `/share/drive/$shareId` | Public listen (structure re-rendered locally)                               |

Flags: `DRIVE_SONG_ENABLED`, `DRIVE_REEL_ENABLED` (default on).

## Browser limits

- `OfflineAudioContext` required for offline render (most Chromium / Safari / Firefox desktop; Tesla browser: verify)
- Long offline renders are CPU-heavy — keep condensed duration
- Share links encode structure + DNA (not audio bytes); listener re-renders
- No MediaRecorder MP3 guarantee — WAV is the portable path
