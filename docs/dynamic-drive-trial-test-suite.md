# Dynamic Drive trial test suite

ELCAMOSO-native preview trial (not Stripe). Server-authoritative time and session accounting.

## Unit lifecycle suite

`src/lib/dynamic-drive-trial/lifecycle.test.ts`

| Scenario              | Test                                                              |
| --------------------- | ----------------------------------------------------------------- |
| New user              | `available` status, no premium entitlements until activation      |
| Trial starts          | Explicit `startPreview` → `active`, 14-day window                 |
| 30 min allocation     | `allocatedSeconds = 1800`                                         |
| 3-session allocation  | `allocatedSessions = 3`                                           |
| Time expires          | Heartbeats consume allocation → `exhausted`, entitlements revoked |
| Session count expires | 3 start/end cycles → cannot start 4th                             |
| 14-day expiry         | Wall-clock expiry → `expired`                                     |
| Page reload           | Same `driveSessionId` resumes without extra session               |
| Browser disconnect    | `endDriveSession` with Dynamic Drive off                          |
| Heartbeat lost        | Credit capped to 45s gap                                          |
| Double browser        | Fresh conflict on second `driveSessionId`                         |
| Tesla + phone         | Same `driveSessionId` shares one session lease                    |
| Upgrade during trial  | Stripe webhook → `converted`, balance preserved                   |
| Upgrade after trial   | Expired trial + subscription → Drive+ from plan                   |
| Paid user             | Never consumes trial balance (auto-convert)                       |
| Cancel subscription   | Period end → FREE, trial stays `converted`                        |

Shared fixtures: `src/lib/dynamic-drive-trial/test-fixtures.ts`

```bash
npm test -- --run src/lib/dynamic-drive-trial/lifecycle.test.ts
```

## Related tests

| File                           | Coverage                                      |
| ------------------------------ | --------------------------------------------- |
| `service.test.ts`              | Core service flows, conflict, stale heartbeat |
| `credit.test.ts`               | Credit caps, never negative remaining         |
| `trial-auth.test.ts`           | Auth gate for preview start                   |
| `entitlements/service.test.ts` | Trial overlay + subscription interaction      |

## Invariants

| Rule                                 | Enforcement                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| Trial never negative                 | `remainingTrialSeconds/Sessions` use `Math.max(0, …)`; credit capped to remaining |
| Upgrade converts trial               | `completeTrial()` → `status: converted`; webhook calls on subscription            |
| Paid user skips trial burn           | `maybeConvertPaidSubscriber()` on heartbeat/session start                         |
| Time exhaustion revokes entitlements | `trialGrantsDrivePlusEntitlements` requires seconds or active drive               |

## Configuration

From `src/lib/dynamic-drive-trial/config.ts`:

- `DYNAMIC_DRIVE_TRIAL_ALLOCATED_SECONDS = 1800` (30 min)
- `DYNAMIC_DRIVE_TRIAL_MAX_SESSIONS = 3`
- `DYNAMIC_DRIVE_TRIAL_EXPIRY_DAYS = 14`
- `DYNAMIC_DRIVE_TRIAL_MAX_CREDIT_GAP_MS = 45000`

See also: `docs/billing/stripe-test-suite.md`.
