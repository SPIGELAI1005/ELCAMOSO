# Motion resilience and fallback

Graceful degradation when motion sources drop. Audio never snaps to silence on a brief gap.

## Input hierarchy

```
vehicle telemetry (future OEM)
        ↓
phone sensors (relay)
        ↓
Tesla / browser GPS + IMU
        ↓
hold (last good values, ~2.2 s)
        ↓
safe decay (coast-down)
```

Implemented in `motion-fallback.ts` + `sensor-fusion.ts`. Tier type: `MotionFallbackTier` in `motion/types.ts`.

## Scenarios handled

| Event                          | Behavior                                                                   |
| ------------------------------ | -------------------------------------------------------------------------- |
| Phone closes browser / WS drop | **2.5 s grace** before phone tier suspended; cached samples coast via hold |
| iPhone lock / background       | Motion stops; hold → browser GPS or decay; relay may reconnect             |
| Packet loss                    | `SIGNAL_HOLD_MS` bridges gaps; seq gaps tracked in pipeline metrics        |
| Stale data                     | Per-source stale limits; poor GPS accuracy rejected                        |
| Wi‑Fi / mobile switch          | Relay grace + hold; browser GPS fallback on Tesla                          |
| Tesla browser refresh          | New session; browser sensors reattach on Drive start                       |
| Backend reconnect              | WebSocket auto-reconnect; grace cancelled if phone returns                 |
| Temporary network loss         | Hold tier preserves speed/throttle; slow decay                             |

## Transitions

- **Tier blend** — speed crossfades over ~420 ms when switching sources (`TIER_BLEND_TAU_S`).
- **Reconnect blend** — RPM rate limited for 1.5 s after tier change or phone restore (`RECONNECT_BLEND_MS`).
- **Hold snapshot** — last speed, accel, throttle preserved on phone loss.

## API

| Call                                  | When                                             |
| ------------------------------------- | ------------------------------------------------ |
| `session.onPhoneRelayPeerLost()`      | Display sees phone peer disconnect (debounced)   |
| `session.onPhoneRelayPeerAvailable()` | Phone peer reconnects within grace               |
| `markPhoneRelayLost(fusion)`          | Grace expired — purge phone source, suspend tier |

## Tests

```bash
npm test -- src/lib/motion/motion-resilience.test.ts
npm test -- src/lib/motion/motion-fallback.test.ts
npm test -- src/lib/drive/driving-scenarios.test.ts
npm test -- src/lib/motion/fusion-scenarios.test.ts
```

See `docs/driving-scenarios.md` for scenario A–G definitions and plausibility rules.

## Related

- Sensor fusion: `docs/sensor-fusion.md`
- Motion pipeline: `docs/motion-pipeline.md`
