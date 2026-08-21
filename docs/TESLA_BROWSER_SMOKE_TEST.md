# Tesla browser smoke test (ELCAMOSO)

Field checklist for opening ELCAMOSO in a Tesla (or similar) in-car browser while parked, then validating Drive with a **passenger** handling the phone/browser. Do not operate the touchscreen while the vehicle is moving if that violates local law or attention.

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

| Step | Pass? | Notes |
|------|-------|-------|
| Open the site; landing renders (mark + tagline) | ☐ | |
| No blank white / “This page didn’t load” | ☐ | |
| Nav opens; `/sounds` and `/demo` load | ☐ | |
| Service worker does not break reload (hard refresh still works) | ☐ | |
| Switch Sound Profile while Listen / Demo / Drive is already playing (no “This page didn’t load”) | ☐ | |
| Preview another sound without restarting the whole audio engine | ☐ | |

---

## 2. `/demo` (no sensors)

| Step | Pass? | Notes |
|------|-------|-------|
| Start Demo; hear sound after gesture | ☐ | |
| Throttle / regen pedals change the sound | ☐ | |
| P R N D changes behavior (P stops drive force) | ☐ | |
| Leaving the tab / opening another app: sound stops or resumes as expected | ☐ | |
| Bluetooth to cabin speakers works without crackle | ☐ | |

If Demo fails, stop: browser Web Audio path is not viable.

---

## 3. Permissions

| Step | Pass? | Notes |
|------|-------|-------|
| Onboarding or Drive prompts for Location | ☐ | |
| Allow Location: prompt succeeds | ☐ | Denied → use Demo only |
| Motion / DeviceMotion prompt (if shown) | ☐ | Optional; accel feel weaker without it |
| Wake Lock: screen stays on during Drive (or Cockpit) ≥ 2 min | ☐ | Many car browsers ignore this |

---

## 4. `/drive` parked + crawl (safe)

Parked or passenger-only. Prefer a quiet lot.

| Step | Pass? | Notes |
|------|-------|-------|
| Start Drive; status becomes running | ☐ | “Location unavailable” = fail |
| Standstill: sound near idle / low motion | ☐ | |
| Slow roll (~10–30 km/h): speed / intensity clearly rises | ☐ | Critical: many browsers omit `coords.speed`; delta fallback should still move |
| Gentle accel / brake: audible change (if IMU allowed) | ☐ | |
| Cockpit toggle: larger UI; wake still ok | ☐ | |
| Hide browser ~1 s (shade): audio should keep playing (grace) | ☐ | |
| Hide ≥ ~4 s: audio suspends; return resumes | ☐ | |
| Stop Drive: audio and sensors release cleanly | ☐ | |

---

## 5. Real drive (passenger operates browser)

| Step | Pass? | Notes |
|------|-------|-------|
| City speeds: sound tracks speed without sticking at idle | ☐ | |
| Steady cruise: stable, not stuttering every GPS tick | ☐ | |
| Harder throttle: louder / more intense without clipping harshness | ☐ | |
| Long tunnel / GPS drop: coasts then recovers (no hard silence crash) | ☐ | |
| Phone call / nav voice: duck or interrupt recovers | ☐ | |
| 10+ min continuous: no freeze, no runaway volume | ☐ | |

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

| Result | Meaning |
|--------|---------|
| **Demo only** | Web Audio works; geo/motion unusable in this browser → ship guidance: use phone for Drive |
| **Partial Drive** | Speed tracks with caveats (no wake lock, weak IMU, suspend on hide) → phone still recommended |
| **Usable Drive** | Speed + audio stable for 10+ min with safe UX → car browser is an optional path |
| **Broken** | Cannot start audio or Drive reliably → do not recommend this browser |

ELCAMOSO still has **no Tesla / OBD telemetry**. Even a full pass here is GPS+IMU inference, not pedal-true OEM lock.

---

## Related code

- GPS reported vs delta: `src/lib/drive/gps-speed.ts`
- Fusion: `src/lib/drive/fusion.ts`
- Session sensors / wake / visibility grace: `src/lib/drive/session.ts`
- Drive UI / Cockpit: `src/routes/drive.tsx`
