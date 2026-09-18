# Motion pipeline (phone → Tesla audio)

End-to-end chain for Dynamic Drive with a paired phone:

```
Phone sensors (~15 Hz)
  → WebSocket relay
  → Sensor Fusion (immediate + rAF tick)
  → VehicleMotionState
  → PowertrainSimulator
  → DynamicDriveSynth / SoundEngine
  → Tesla speakers
```

## Latency optimizations

| Technique               | Where                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| Fuse on ingest          | `session.ingestPhoneRelayMotion()` ticks fusion immediately, not only on animation frame |
| IMU-led throttle        | Phone accel drives transient layer + faster attack in throttle model                     |
| IMU speed nudge         | Filtered speed integrates phone accel when GPS baseline lags                             |
| Phone tier on IMU alone | `resolveFallbackTier()` keeps `phone` tier when GPS stale but IMU fresh                  |
| Auto latency comp       | `applyMotionLatencyComp()` uses measured E2E delay (`suggestedLatencyCompMs`)            |

GPS supplies the **speed baseline**. Phone IMU supplies **fast transients** so sound responds before GPS catches up.

## Developer metrics

Enable **Settings → Advanced → Developer panel → Drive debug** on `/drive`.

`DrivePipelineMetrics` shows:

| Stage             | Timestamp pair            |
| ----------------- | ------------------------- |
| Sensor sampling   | sample → phone send       |
| Phone → server    | send → server relay       |
| Server → Tesla    | relay → display receive   |
| Display → fusion  | receive → fusion tick     |
| Powertrain update | fusion → powertrain       |
| Audio event       | powertrain → audio update |

Also: phone/fusion/audio Hz, network health, packet loss, reconnect count.

When a Drive Session is active in dev mode, metrics also appear on `DriveSessionPanel`.

## Tests

```bash
npm test -- src/lib/motion/motion-pipeline-chain.test.ts
npm test -- src/lib/motion/pipeline-metrics.test.ts
```

## Related

- Architecture guide: `docs/DYNAMIC_DRIVE_ARCHITECTURE.md`
- Relay sessions: `docs/drive-relay-sessions.md`
- Sensor fusion: `docs/sensor-fusion.md`
