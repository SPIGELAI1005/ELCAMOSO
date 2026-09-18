# Drive Sharing Privacy

## Default

Journeys and Drive Songs stay **on-device** (IndexedDB). Nothing uploads when you Create Drive Song.

## Before cloud / link share

The UI discloses:

**Sharing**

- ✓ Drive Song structure (chapters, seed, pack)
- ✓ Drive DNA
- ✓ Experience name
- ✓ Duration only if opted in

**Not shared**

- ✕ Route
- ✕ GPS coordinates
- ✕ Sensor trace

## Payload

`JourneySharePayload` is intentionally narrow. Decode rejects strings that smuggle `latitude` / `longitude` / `gps` / `polyline`.

Studio personality shares (`/share?p=…`) remain separate from Drive Song shares (`/share/drive/$shareId`).

## Open Graph

Drive Song share pages use:

- Headline: **This drive made a song.**
- Sub: **Created with ELCAMOSO.**
