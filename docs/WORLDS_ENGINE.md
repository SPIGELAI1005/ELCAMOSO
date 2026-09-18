# Worlds Engine

**Status:** V1 live (Space Drive, Cyber City, Storm Run)
**Principle:** A World is reactive sonic fiction — not a looping backdrop.

## Pipeline

```
DriveState
  → Drive Energy
  → World State Engine (idle / motion / build / high_energy / coast / regen / stop)
  → layered procedural soundscape
  → StrategyBuses.body → cabin → master → limiter
```

Single `AudioContext`. Legacy profile aliases (`space-ship`, `cyber-pulse`, `storm-glider`) map to the same packs.

## Packs

### Space Drive (`world-space-drive`)

Reactor, energy field, cabin, thruster, wind-energy, warp, regen recovery.

| State       | Feel                     |
| ----------- | ------------------------ |
| idle / stop | Reactor settle           |
| motion      | Reactor wakes + thruster |
| build       | Energy + warp tension    |
| high_energy | Wide field + warp        |
| regen       | Recovery tone            |

No franchise / copyrighted sci-fi references.

### Cyber City (`world-cyber-city`)

Digital pulse, synth body, city ambience, accel shimmer, regen reverse, speed ambience. More rhythmic than Space Drive.

### Storm Run (`world-storm-run`)

Wind, distant thunder, air pressure, rain movement, cinematic tone.

Thunder is **soft**, **rate-limited** (`eventCooldownSec ≥ 8`), and peak-capped — never startling spikes.

## UI

`/worlds` — name, three-word character, minimal motion visual, Listen, Start Drive. Listen uses a short cinematic fade-in below safe loudness.

## Flags

`WORLDS_ENGINE_ENABLED` — default **on**.

## Modules

`src/lib/worlds/` — world-state, layer-player, packs, world-synth, world-profiles.

## Tesla checklist

1. Park → `/worlds` → Space Drive → Listen — soft entrance, reactor idle → motion build.
2. Cyber City — pulse follows energy; not a music player scrub.
3. Storm Run — wind builds; thunder rare and quiet.
4. Start Drive with phone sensors — switch World → Fusion → Engine cleanly.
