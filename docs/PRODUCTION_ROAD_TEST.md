# Production readiness — QR / audio / road-test (manual)

## A. Phone QR end-to-end (production)

Prerequisites: dedicated relay live; `VITE_DRIVE_RELAY_PUBLIC_ORIGIN` on the build.

| Step | Action                                      | Record               |
| ---- | ------------------------------------------- | -------------------- |
| 1    | Tesla `/drive` → Connect phone              | Pair start time      |
| 2    | Scan QR → phone `/pair/{token}` → Confirm   | Claim success Y/N    |
| 3    | Both show Connected                         | Pair time (ms)       |
| 4    | Drive → source = phone                      | Packet rate (~15 Hz) |
| 5    | Latency test                                | RTT ms               |
| 6    | Airplane mode phone 5s                      | Disconnect detection |
| 7    | Restore network                             | Reconnect time       |
| 8    | Confirm Tesla sensors take over during loss | Fallback Y/N         |

Pass criteria: pair &lt; 8s typical; RTT &lt; 200ms Wi‑Fi; reconnect &lt; 3s; sound never silent spike.

## B. Audio performance (Tesla, worst case)

Fusion + Realism V2.1 + Symphony procedural + phone relay + Drive UI; diagnostics **off**.

| Metric             | How                                   | Target                      |
| ------------------ | ------------------------------------- | --------------------------- |
| AudioContext state | interrupted?                          | running / resume on gesture |
| Long tasks         | Performance panel                     | &lt; 50ms common            |
| Scheduler lateness | engine diagnostics if briefly enabled | stable                      |
| Memory             | Performance memory                    | no unbounded growth 10 min  |
| Active nodes       | brief diagnostics                     | stable after build          |
| Limiter            | peak/RMS                              | under limit; no jump        |
| Dropped relay msgs | rate limit / seq gaps                 | rare                        |

**Rule:** no React `setState` at audio frequency.

## C. Asset load

| Step                                  | Expect                                             |
| ------------------------------------- | -------------------------------------------------- |
| Listen Symphony first time            | progress or immediate procedural                   |
| Kill network mid-WAV (when WAVs ship) | “Music couldn't load.” + Retry / Switch Experience |
| Drive continues                       | Engine / procedural still audible                  |

## D. Safety / privacy spot-checks

- Moving &gt; 5 km/h with live Drive → Studio/Explore gated
- Share Drive Song URL → no lat/lon in payload
- QR URL → no join secret
- Network tab → no Stripe/Google secrets
