# Tesla browser smoke test (ELCAMOSO)

Field checklist for opening ELCAMOSO in a Tesla (or similar) in-car browser while parked, then validating Drive with a **passenger** handling the phone/browser. Do not operate the touchscreen while the vehicle is moving if that violates local law or attention.

**Architecture:** `docs/DYNAMIC_DRIVE_ARCHITECTURE.md` — full Phone → Session → Fusion → Powertrain → Audio pipeline.

**Goal:** Decide whether the car browser can run a usable Drive session, or whether a mounted phone remains the primary path.

**App URL:** production deploy or local tunnel (HTTPS preferred; geolocation often requires secure context).

---

## 0. Prep (before you sit in the car)

- [ ] Note software / browser build if visible (Tesla software version).
- [ ] Cabin audio source: browser / Bluetooth / USB as you intend to hear ELCAMOSO.
- [ ] Volume at a safe level; confirm media ducking when nav speaks (if applicable).
- [ ] Have `/demo` as fallback if Location is denied.
- [ ] Passenger or parked-only for any interactive setup.

---

## 1. Load & shell

| Step                                                                                                      | Pass? | Notes                                                 |
| --------------------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------- |
| Open the site; landing renders (mark + tagline)                                                           | ☐     |                                                       |
| No blank white / “This page didn’t load”                                                                  | ☐     |                                                       |
| Nav opens; `/sounds` and `/demo` load                                                                     | ☐     |                                                       |
| Service worker does not break reload (hard refresh still works)                                           | ☐     |                                                       |
| Switch Sound Profile while Listen / Demo / Drive is already playing (no “This page didn’t load”)          | ☐     |                                                       |
| Preview another sound without restarting the whole audio engine                                           | ☐     |                                                       |
| Drive safety mode above ~5 km/h: instrument only (mark, speed, profile, Stop); nav hidden                 | ☐     |                                                       |
| With motion character on: gear arc, rev, profile name; connection hint only if needed | ☐     | Settings → Advanced → Motion-matched sound            |
| Split-screen (browser beside maps): gear pulses on shift; rev beside arc in landscape  | ☐     | `?cockpit=1` or safety mode                           |
| Phone link: **Connect phone** on `/drive` → scan QR `/pair/{token}` or enter code on `/pair` | ☐     | Free; no `?cockpit=1` required; same Wi‑Fi for local WS |
| Dev only: peer rows, Signal + Latency test when Drive debug on                          | ☐     | Settings → Advanced → Drive debug                     |
| Phone optional controls: Sound Profile, intensity, motion character, shift feel, master | ☐     | Collapsed panel; set while parked                     |
| Phone control change → Tesla reflects within one relay hop                              | ☐     | Change profile or volume on phone; hear/see on Tesla    |
| Tesla Fleet Telemetry (optional, server): flag off → Drive works on browser/phone only  | ☐     | `teslaFleetTelemetry` default off; see `docs/dynamic-drive/tesla-telemetry.md` |
| Drive debug: pipeline stages (sensor → server → Tesla → fusion → audio)               | ☐     | Settings → Advanced → Developer → Drive debug         |
| Tip-in: sound responds before GPS speed catches up (phone linked)                       | ☐     | Dynamic Drive + motion character on                   |
| Phone brief disconnect: audio coasts, no silence cliff (≤ ~2.5 s grace)                | ☐     | Lock phone or toggle Wi‑Fi briefly                    |
| Product status shows Sound Active / GPS Only / Simulation (not AudioContext jargon)                       | ☐     |                                                       |

---

## 2. `/demo` (no sensors)

| Step                                                                      | Pass? | Notes |
| ------------------------------------------------------------------------- | ----- | ----- |
| Start Demo; hear sound after gesture                                      | ☐     |       |
| Throttle / regen pedals change the sound                                  | ☐     |       |
| P R N D changes behavior (P stops drive force)                            | ☐     |       |
| Leaving the tab / opening another app: sound stops or resumes as expected | ☐     |       |
| Bluetooth to cabin speakers works without crackle                         | ☐     |       |

If Demo fails, stop: browser Web Audio path is not viable.

---

## 3. Permissions

| Step                                                         | Pass? | Notes                                  |
| ------------------------------------------------------------ | ----- | -------------------------------------- |
| Onboarding or Drive prompts for Location                     | ☐     |                                        |
| Allow Location: prompt succeeds                              | ☐     | Denied → use Demo only                 |
| Motion / DeviceMotion prompt (if shown)                      | ☐     | Optional; accel feel weaker without it |
| Wake Lock: screen stays on during Drive (or Cockpit) ≥ 2 min | ☐     | Many car browsers ignore this          |

---

## 4. `/drive` parked + crawl (safe)

Parked or passenger-only. Prefer a quiet lot.

| Step                                                         | Pass? | Notes                                                                         |
| ------------------------------------------------------------ | ----- | ----------------------------------------------------------------------------- |
| Start Drive; status becomes running                          | ☐     | “Location unavailable” = fail                                                 |
| Standstill: sound near idle / low motion                     | ☐     |                                                                               |
| Slow roll (~10–30 km/h): speed / intensity clearly rises     | ☐     | Critical: many browsers omit `coords.speed`; delta fallback should still move |
| Gentle accel / brake: audible change (if IMU allowed)        | ☐     |                                                                               |
| Cockpit toggle: larger UI; wake still ok                     | ☐     |                                                                               |
| Hide browser ~1 s (shade): audio should keep playing (grace) | ☐     |                                                                               |
| Hide ≥ ~4 s: audio suspends; return resumes                  | ☐     |                                                                               |
| Stop Drive: audio and sensors release cleanly                | ☐     |                                                                               |

---

## 5. Real drive (passenger operates browser)

| Step                                                                 | Pass? | Notes |
| -------------------------------------------------------------------- | ----- | ----- |
| City speeds: sound tracks speed without sticking at idle             | ☐     |       |
| Steady cruise: stable, not stuttering every GPS tick                 | ☐     |       |
| Harder throttle: louder / more intense without clipping harshness    | ☐     |       |
| Long tunnel / GPS drop: coasts then recovers (no hard silence crash) | ☐     |       |
| Phone call / nav voice: duck or interrupt recovers                   | ☐     |       |
| 10+ min continuous: no freeze, no runaway volume                     | ☐     |       |

---

## 6. Failures to record (copy into issue / MEMORY_BANK)

For each fail, note:

1. Tesla software version / browser if known
2. Step ID (table row)
3. Console errors if accessible (often not)
4. Whether `coords.speed` appeared to work (idle stuck while moving ⇒ likely null speed without working delta path, or geo denied)
5. Audio out path (cabin Bluetooth vs phone speaker)

---

## 7. Verdict rubric

| Result            | Meaning                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------- |
| **Demo only**     | Web Audio works; geo/motion unusable in this browser → ship guidance: use phone for Drive     |
| **Partial Drive** | Speed tracks with caveats (no wake lock, weak IMU, suspend on hide) → phone still recommended |
| **Usable Drive**  | Speed + audio stable for 10+ min with safe UX → car browser is an optional path               |
| **Broken**        | Cannot start audio or Drive reliably → do not recommend this browser                          |

ELCAMOSO in-car browser path uses **GPS + IMU inference** (and optional phone relay). **Tesla Fleet Telemetry** is a separate server-side integration (`docs/dynamic-drive/tesla-telemetry.md`) — not required for Dynamic Drive and not available directly from the Tesla browser today.

---

## 8. Drive+ purchase (Tesla QR → phone checkout)

Parked only. Requires Stripe test mode on the server and a signed-in account on both Tesla and phone.

| Step | Pass? | Notes |
| ---- | ----- | ----- |
| FREE user on `/drive?cockpit=1` with Dynamic Drive preview active | ☐ | Trial UI shows remaining preview time |
| Trial ≤10 min: milestone nudge or **Unlock on phone** CTA visible | ☐ | Cockpit uses QR path, not in-car card entry |
| Open upgrade overlay (`?upgrade=drive-plus` or CTA) — QR renders | ☐ | No Stripe iframe on Tesla |
| Phone scans QR → `/upgrade/{token}` loads price + **Unlock Drive+** | ☐ | Sign in if prompted |
| Stripe Checkout opens on phone (test card in test mode) | ☐ | Payment stays off Tesla browser |
| After payment: phone shows success; Tesla shows **Drive+ is ready** without reload | ☐ | ≤ few seconds via relay or 2.5 s poll |
| Dynamic Drive continues — same drive session, no full page refresh | ☐ | Audio should not hard-stop |
| Close overlay early — plan still updates via polling | ☐ | Reopen overlay shows unlocked |

**Full scenario + failure matrix:** `docs/billing/tesla-purchase-e2e.md`  
**Automated integration:** `src/lib/tesla-upgrade/purchase-flow.integration.test.ts`

---

## Related code

- GPS reported vs delta: `src/lib/drive/gps-speed.ts`
- Sensor fusion: `src/lib/motion/sensor-fusion.ts`
- Architecture guide: `docs/DYNAMIC_DRIVE_ARCHITECTURE.md`
- Session sensors / wake / visibility grace: `src/lib/drive/session.ts`
- Drive UI / Cockpit: `src/routes/drive.tsx`
- Performance audit (Tesla Chromium): `docs/TESLA_BROWSER_PERFORMANCE_AUDIT.md`
