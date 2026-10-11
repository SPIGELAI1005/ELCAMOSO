# ELCAMOSO — Drive Cockpit and Raw Mechanical Audio

Comprehensive Cursor prompt pack · 10 October 2026

## How to use this pack

Save this file in your repository as `cursor-prompts/ELCAMOSO_DRIVE_AUDIO_UPGRADE.md`. Run Prompt 00 first, then one numbered prompt at a time in Cursor Agent mode. Attach this file when starting a new chat. The common instructions below apply to every prompt; each numbered prompt explicitly incorporates them.

These prompts instruct Cursor to implement the work, not merely explain it. Prompt 00 is deliberately an audit before implementation. Follow the numbered order. Prompts 00–07 address the immediate sound-quality problem before the cockpit, authentication and rewards work.

The repository has not been inspected while preparing this pack. Previously discussed paths, the count of 47 core profiles, Supabase availability and current billing behaviour are context to verify, not confirmed repository facts. Cursor must discover the actual catalog, implementation and dependencies. Do not invent profile IDs or treat an old design document as proof of shipped code.

### Product intent

- Combustion sounds currently feel too electronic, thin and high-pitched. Prioritise bass body, mechanical texture and believable load response without muffling every sound or making every engine a V8.
- Create an ELCAMOSO-branded Drive Cockpit with speed, simulated RPM and gear, quick favourite selection, and directly accessible volume.
- Deliver perceptible early virtual gear changes during ordinary city driving.
- Offer passwordless email-code login, three useful free sounds, and optional monthly rewards.
- Reuse the app's actual branding and design system. Competitor observations are inspiration; no competitor assets, proprietary audio, code or unverified implementation claims.

## Common instructions — mandatory for each prompt

```text
Work in the existing ELCAMOSO repository. Apply the common instructions in cursor-prompts/ELCAMOSO_DRIVE_AUDIO_UPGRADE.md and implement only the numbered prompt requested.

Inspect AGENTS.md and relevant nested instructions, package scripts, installed versions, git status, existing architecture and current tests before changes. Preserve unrelated uncommitted work. Do not invent commands, paths, APIs, profile IDs, test results or deployed configuration. Use installed dependencies where practical; verify version-specific APIs against official documentation.

Read these documents if present, locate renamed equivalents, and record missing ones:
- elcamoso-comprehensive-spec.md
- docs/MEMORY_BANK_AND_CHANGELOG.md
- docs/AUDIO_REALISM_V2.md
- docs/SOUND_CHARACTER_SPEC.md
- docs/sound-profiles/INDEX.md
- docs/SOUND_PROFILE_IMPLEMENTATION_AUDIT.md
- docs/audio/profile-upgrade-matrix.md
- cursor-prompts/CURSOR_PROMPTS.md
- docs/DRIVE_COCKPIT_V2_PLAN.md and docs/DRIVE_COCKPIT_V2_PROGRESS.md after Prompt 00.

Keep SoundProfile as the stable catalog entity. Extend existing AcousticProfileSpec and getAcousticProfileSpec if present; do not create a competing catalog or parse Markdown at runtime. Verify the previously discussed 47 IDs against the actual repository. Resolve or explicitly document existing neon-drive, dragon and thunder-beast family mismatches without silently renaming IDs.

Preserve existing purchases, subscription ownership, user identities, route contracts, telemetry modes and unrelated Experiences/music functionality. Never expose private keys, OTPs, raw location history or signed download credentials in browser code or logs. Do not silently replace an existing auth provider or billing model.

Use compatible, reversible changes and a documented feature flag strategy. New DSP should be opt-in until validated; existing playback must remain available as a fallback. Prepare migrations and operational instructions but do not apply production migrations, alter live billing, buy assets, rotate credentials or deploy as part of these prompts.

Implement code and meaningful behavioural tests for the requested scope. Do not stop after a plan unless the prompt is audit-only. Missing external credentials/assets should block only the dependent production activation: complete local code, fixtures, tests and clear configuration instructions. Do not claim a mock proves real email delivery, real billing, perceived realism or Tesla compatibility.

At completion update the progress document and appropriate existing changelog. Report: files changed; resulting behaviour; tests actually run and results; unresolved dependencies; feature flags; manual verification steps; rollback. Distinguish implemented, automatically verified, listening-verified, device-verified and production-configured. Stop at the end of the requested prompt.
```

## Prompt 00 — Repository audit and implementation map

```text
Apply the common instructions. Perform Prompt 00 only: inspect and document; make no runtime or audible changes.

1. Map current Drive UI, design tokens/logo assets, sound catalog and factories, Web Audio graph, AcousticProfileSpec status, telemetry providers, virtual RPM/gears, preferences, authentication, entitlement checks, Stripe integration and tests.
2. Trace one representative combustion profile from speed input through RPM/load calculation, sources, filters, gain stages and output. Trace a non-combustion profile too. Identify duplicate RPM calculations or hardcoded speed-to-pitch mappings.
3. Enumerate EVERY current sound ID, display name, family, renderer/source type, relevant files, access tier and sample assets. Reconcile expected vs actual catalog count and the three previously mentioned family mismatches. Do not generate missing invented profiles to reach 47.
4. Inspect potential causes of thin/high-pitched audio: dominant pure oscillators, excessive harmonic weighting, missing low engine orders, excessive pitch stretching, RPM scaling, narrow resonances/high Q, aggressive high-pass filters, distortion aliasing, load-independent timbre, low gain, phase cancellation or compression pumping. Mark findings as code-confirmed or hypotheses requiring audio measurement.
5. Identify how the existing work named CURSOR_PROMPTS Prompt 2 (typed AcousticProfileSpec without audible changes) overlaps this work. Reuse it if complete; if not, supply its minimum compatible foundation in Prompt 02, never another parallel abstraction.
6. Record current auth/account/Stripe linking and what must be preserved before adding Supabase email OTP. Record whether any production migration is needed.

Create docs/DRIVE_COCKPIT_V2_PLAN.md with concrete paths, architecture, implementation order, flag ownership, configuration dependencies and rollback. Create docs/DRIVE_COCKPIT_V2_PROGRESS.md with a status row for each prompt. Create or extend docs/audio/profile-upgrade-matrix.md with one row per real ID.

Run the repository's existing relevant baseline checks and report pre-existing failures separately. Do not claim listening diagnosis without recordings. Finish with the first three evidence-backed priorities for reducing the electronic/high-pitched character.
```

## Prompt 01 — Reproducible audio diagnosis and comparison lab

```text
Apply the common instructions. Implement Prompt 01 only using the audit's actual architecture.

Create a development-only, locally usable audio comparison lab and render harness. It must exercise the production sound engine rather than a replacement demo synthesizer. Keep it out of production navigation; any deployed access must use real server authorization, not just a hidden link.

Requirements:
- Select every real profile ID and replay deterministic telemetry fixtures: idle, gentle 0–80 km/h acceleration, assertive acceleration, steady 30/50/80 km/h, lift-off, 80–0 deceleration, repeated threshold hovering, GPS loss/recovery, and abrupt profile switching. Use synthetic telemetry, no real driving needed.
- Include direct RPM/load sweeps for diagnosis only, clearly separated from speed-driven acceptance tests.
- Capture baseline WAVs or equivalent uncompressed output plus profile ID, revision, sample rate, seed, settings, fixture and renderer version. Where OfflineAudioContext cannot run the actual engine/worklet, provide a real-time capture path using the same DSP and disclose limitations.
- Add before/after A/B playback, independent mute/solo of layers and level matching. Never play both A and B simultaneously as a comparison. Preserve consistent measurement gain across runs and account for volume when comparing spectra.
- Measure sample peak, RMS, clipping/NaN/Infinity, DC offset, crest factor, spectral centroid and energy across useful bands (20–60, 60–150, 150–400, 400–1500, 1500–4000, 4000–12000 Hz within Nyquist). Use a validated implementation if reporting LUFS or true peak; otherwise label metrics honestly.
- Provide spectra and time-frequency views where existing tooling allows. Do not equate lower centroid or more bass with proven realism.
- Ensure recording and debug instrumentation are off in normal production playback. Avoid persisting location or email data.

Create a baseline report for each ID: measured issues, code evidence, hypotheses and missing human assessment. If capture cannot run in this environment, supply a runnable command/UI and mark results pending, not fabricated. Add tests for fixture determinism and capture metadata.
```

## Prompt 02 — Typed acoustic contracts and per-profile recipes

```text
Apply the common instructions. Implement Prompt 02 only. Reuse existing SoundProfile, AcousticProfileSpec and lookup/validation code.

Extend the acoustic contract compatibly to describe:
- Family/renderer kind and supported capabilities; combustion vs electric/futuristic vs creature/cinematic/ambient as justified by the actual catalog.
- Cylinder/cycle geometry where appropriate, firing events over a 720-degree four-stroke cycle, optional bank routing, idle/max RPM, harmonic/order weights and bounded cycle variation.
- Exhaust/body, intake, mechanical, induction and event layers; per-regime gains, filters and saturation; profile-specific timbre response to RPM and estimated load.
- Virtual transmission ratios, final-drive/equivalent mapping, shift mode, thresholds, hysteresis, torque-cut/recovery timing, downshift blip and event cooldowns.
- Sample-bank metadata, source RPM, load regime, loop boundaries, permissible stretch, asset provenance, and procedural fallback.
- Profile gain trim, headroom, user-control ranges, anti-harshness filters and acceptance metadata. Keep listening verdicts separate from runtime configuration.

All fields need units, bounded values, defaults and validation. Do not duplicate normalized RPM and real RPM conventions inconsistently. Reject invalid values safely. Keep schemas serializable where required by the current architecture and stable across SSR/client boundaries.

Populate a distinct recipe for every discovered ID, using family defaults only as a foundation. Record explicit inherited values and meaningful identity-specific overrides. Gearless profiles must not inherit combustion pops or RPM clacks accidentally.

Validate all catalog IDs, unique mappings, unknown-ID fallback, old persisted settings, malformed specs, missing samples and family compatibility. This step is schema/data preparation: keep audible output unchanged until later flags enable the new renderer. Update the matrix with exact code locations and evidence, not just prose promises.
```

## Prompt 03 — Shared virtual drivetrain and earlier gear changes

```text
Apply the common instructions. Implement Prompt 03 only.

Build or refactor a deterministic virtual drivetrain used by both audio and UI. One authoritative state exposes speed, speed source/freshness, filtered acceleration, estimated load, gear, RPM, operating regime and timestamped shift events. Keep high-rate DSP state independent of React rerender frequency.

City preset initial upshift thresholds in km/h: [15, 28, 43, 58, 75] for gears 1→2 through 5→6. Corresponding downshift thresholds: [10, 21, 35, 49, 65]. These are artistic tuning defaults, not measured vehicle or competitor specifications. Apply only to suitable six-speed profiles; validate/adapt others. Provide coherent Touring and Sport presets, with Sport holding gears longer under estimated demand.

Make gear ratios, virtual wheel circumference/final drive or equivalent RPM calibration internally consistent with threshold values, idle and redline. For a wheel-based model use speed_mps / circumference_m * 60 * finalDrive * gearRatio; apply virtual clutch slip near standstill. For a shift use newRPM ≈ oldRPM * newRatio / oldRatio at stable speed. Never merely lower pitch at the same time as leaving a contradictory tachometer state.

Use a clear state machine: steady, unloading, shifting, recovering. Calibrate initial 150–300 ms upshift envelopes per family; emit exactly one event with a unique sequence ID per transition. Use hysteresis and a configurable minimum gear dwell (initially about 0.8–1.2 s) to avoid hunting. Define lawful RPM bounds, downshift rejection/blip and restart at nonzero speed without an artificial barrage of shifts.

Filter noisy speed and derive acceleration using actual timestamps. Treat estimated load as a proxy, not real throttle or torque; steady uphill load cannot be inferred reliably from speed alone. Handle null speed, low-speed jitter, stale/out-of-order samples, large time gaps, reconnects and mixed telemetry sources. Do not count missing data as speed zero. On prolonged data loss use a documented smooth decay/fade and indicate uncertainty; don't keep accelerating synthetically.

Respect gearless families. Preserve existing phone-to-car telemetry if present and make source changes explicit. Keep tuning selectable in Settings, with City the proposed new default only when the feature flag is enabled.

Test 0–80–0 runs, threshold hovering, dwell timing, ratio-correct RPM drops, redline protection, duplicate event prevention, reverse/negative input policy, startup at speed and GPS loss/recovery. Record actual fixture outputs.
```

## Prompt 04 — Raw mechanical combustion renderer

```text
Apply the common instructions. Implement Prompt 04 only behind the new-audio feature flag. Start with a representative real muscle/V8 profile and one contrasting real combustion profile, then expose reusable primitives for other profiles. Do not rename catalog items or add guessed brands.

Goal: replace thin oscillator-led combustion character with a pulse-driven, textured engine sound. Do not solve this by applying the same bass boost or octave-down operation to every profile.

Implement or improve:
1. A phase-continuous crank/firing source using the spec's actual event geometry. For a four-stroke engine the average firing frequency is RPM*cylinderCount/120; crank frequency is RPM/60. These are average order relationships, not proof that every engine sounds the same. Preserve firing spacing, bank routing, pulse shape and exhaust resonance differences.
2. Finite-width, band-limited combustion pulses or suitable multiband wavetables. Avoid naive discontinuous impulses and unrestricted high harmonics. Use sample-rate-aware filtering and limit frequencies below Nyquist. Assess oversampling where nonlinear processing warrants it.
3. Bounded, seeded cycle-to-cycle amplitude/timing variation for natural texture. Keep phase coherent; no random pitch flutter, broad musical detuning/chorus or unstable oscillator beating as a substitute for mechanics.
4. Separate exhaust/body, intake and mechanical layers. Include low engine-order energy and audible low-mid harmonics, not a disconnected fixed sub-bass sine. Mechanical texture should follow rotation/load and stay quieter than the engine body.
5. Distinct idle, on-load, cruise and overrun timbres; at the same RPM, higher estimated load changes pulse energy, intake/exhaust balance and spectral shape, not only volume.
6. Mild bounded saturation with anti-aliasing and post-shaping as needed. Preserve transient detail. Avoid global fuzz, clipping, hiss and excessive high-Q resonances.

Use an AudioWorklet only where sample-accurate custom DSP is needed; retain existing good architecture. No React/main-thread setInterval scheduling of individual firing pulses. Reuse contexts/nodes, smoothly automate controls, and clean up voices on stop/profile change. Provide a measured low-cost quality tier/fallback for constrained browsers.

Diagnostic starting regions: body often needs attention around 60–180 Hz, mechanical weight around 150–600 Hz, and harshness inspection around 2–5 kHz. These are tuning hypotheses, not universal boosts/cuts. Remove inaudible rumble/DC that consumes headroom. Preserve legitimate high-RPM character.

Render loudness-matched before/after fixtures for both pilot profiles. Test finite/stable output, phase continuity, bounded levels, repeatable seeded variations, sample-rate handling and lifecycle cleanup. Report perceived realism as pending until listened to. Do not claim code tests prove authentic engine sound.
```

## Prompt 05 — Recorded sample layers and hybrid playback

```text
Apply the common instructions. Implement Prompt 05 only.

Add a lightweight hybrid sample layer to the existing Web Audio renderer, not an automatic Wwise/FMOD migration. Use actual licensed assets if present. If none are available, implement the loader, manifest, fallback and tests; mark the profile as awaiting assets rather than pretending synthetic placeholders are real recordings.

For each selected combustion family define a recording request covering idle plus low/mid/high RPM in on-load and off-load states, with optional intake, mechanical engagement and lift-off assets. Prefer multiple steady RPM recordings; a single free-rev clip pitch-shifted across the full range is insufficient. Specify source RPM, load, mic perspective, clean loop region, channel format and rights needed for commercial interactive web distribution.

Implement:
- Typed manifest with stable asset ID, profile/family, source RPM, regime, loop start/end, gain trim, sample rate, channel metadata, provenance/license record and optional checksum.
- Pitch tracking via playbackRate = targetRPM/sourceRPM within bounded per-asset ranges. Blend neighbouring RPM bands and load layers smoothly. Tune phase/coherence: equal-power fades are a starting option, not a guarantee against comb filtering or level peaks for correlated loops.
- Preload only required active/favourite assets, keep a bounded decoded-buffer cache, and measure memory. Cancel/ignore stale loads on rapid changes; never let an old request replace the latest selection.
- Correct CORS, decode failures, unavailable codecs/network, mono compatibility, loop seams, stopped/restarted sessions and graceful procedural fallback without a loudness jump.
- No invented files, downloaded competitor audio or unlicensed YouTube extraction. Document asset licensing constraints, including whether browser-delivered samples can be redistributed. Client-delivered audio cannot be made impossible to extract.

Write docs/audio/SAMPLE_ACQUISITION_BRIEF.md listing exact missing assets by actual profile ID and priority. Add tests for manifest validation, bounded stretch, cache cleanup, unavailable assets and source-switch continuity. Add a measured decision note on whether granular synthesis would improve available recordings enough to justify its CPU/complexity. Do not add a granular engine merely because the term sounds more realistic.
```

## Prompt 06 — Mechanical shift audio and load transitions

```text
Apply the common instructions. Implement Prompt 06 only, consuming the shared drivetrain events from Prompt 03.

Make a virtual gearshift one synchronized event: engine unloading/torque-cut envelope, mechanical engagement transient, ratio-correct RPM transition, then controlled engine recovery. Schedule on the audio clock and map telemetry timestamps explicitly. UI frame timing must not drive the audible sequence.

Requirements:
- Distinct per-profile engagement types: muted heavy engagement for suitable muscle profiles; short precise engagement for sports profiles; no forced clacks on gearless/futuristic profiles.
- Mechanical effects built from licensed samples or documented original procedural transients, not generic musical clicks. Keep their tonal body and broadband detail balanced; more raw must not mean piercing.
- Shift intensity separate from master volume. A zero setting mutes the extra mechanical transient but preserves drivetrain/RPM continuity.
- Downshift rev-blip, lift-off and optional overrun events only for compatible profiles and valid state transitions. Cooldowns and load gating prevent repeated pops during GPS noise or every update.
- Never play a burst of overdue events after tab suspension, resume or reconnection. Deduplicate event sequence IDs and discard stale events.
- Do not add unexplained speed jumps, fake acceleration or vibration claims; this is simulated audio, not vehicle actuation.

Test exactly-once event consumption, gearless silence, zero-intensity behaviour, max transient level, timestamp gaps and simultaneous profile switches. Render isolated shift examples and full city fixtures for listening, at matched playback loudness. Update the profile matrix with event-specific tuning.
```

## Prompt 07 — Tune every sound profile and prove coverage

```text
Apply the common instructions. Implement Prompt 07 only. This is the mandatory full-catalog pass, not just the two pilot profiles.

Enumerate the live catalog again. Update each actual profile individually using its stated sound identity, existing description/spec, baseline measurements and available source material. Preserve all IDs, access mappings and user favourites. If 47 is no longer the real count, report and use the real count.

For EVERY ID fill a matrix row with: family; intended identity; previous source; diagnosed problem/evidence; chosen renderer; layer and order balance; RPM/load shaping; bass/body adjustment; harshness treatment; transmission/events; sample status; exact changed code; baseline/after capture paths; automated checks; human listening status; device status. Every row must have a concrete outcome or an explicit blocker.

Family guidance (only apply to real matching profiles):
- Cross-plane muscle V8: weight and textured exhaust pulse groups, restrained intake/whine; don't model all sound as random uneven global firing. Bank/exhaust routing and pulse shape matter.
- Flat-six/sports six: mechanical texture and balanced midrange, strong body without converting it into muscle V8 rumble.
- Turbo inline-six: smooth body plus load-responsive intake/spool; avoid a constant high whistle at idle or cruise.
- High-revving V10/V12/race: retain characteristic upper harmonics as RPM rises, add justified body at low/mid RPM, tame narrow harshness rather than erase the identity. No blanket low-pass that makes every race engine dull.
- Diesel/heavy mechanical if present: controlled clatter, low-RPM mass, no clipping-based crackle.
- Electric/futuristic: intentional electronic identity may remain, but harshness and weak body can improve; no forced combustion overlay.
- Creature/cinematic/ambient: preserve the described identity with its own appropriate texture/regime mapping, not generic engine ratios.

Use family defaults plus explicit individual deviations with audible rationale. Do not satisfy coverage with 47 identical presets or documentation-only rows. Where a profile needs recordings not supplied, ship the honestly labelled procedural improvement and retain an asset-pending status.

Run all-profile finite-output/level/lifecycle tests and targeted regime renders. Add a listening rubric scored only by actual listeners: bass/body, raw mechanical character, identity, load responsiveness, shift believability, harshness/fatigue and loop artefacts. Match A/B loudness before judgement. Document unlistened items as unverified.

Produce docs/audio/RAW_MECHANICAL_AUDIO_ACCEPTANCE.md and an updated complete matrix. Summarize remaining asset and device-test gaps without claiming every sound is now authentic.
```

## Prompt 08 — Gain staging, output boost and shared controls

```text
Apply the common instructions. Implement Prompt 08 only.

Audit and correct the entire gain path before increasing default levels. Identify double attenuation, excessive profile trims, gain cancellations and compressors suppressing engine transients. Keep the richer timbre work independent from user volume.

Implement a coherent path: profile/layer trims → engine/event mix → profile EQ/body shaping → user volume and optional boost → dynamic/peak protection → output. Adapt ordering based on measured existing graph; document it. Avoid duplicate processing or makeup gain that silently defeats the ceiling.

Controls shared by Settings and Drive:
- Master volume 0–100%, with a documented perceptual curve and initial new-device default around 35%. Zero means silence. Remember locally per device; do not unexpectedly import another device's loud setting.
- Separate mechanical shift intensity and mute/start-stop semantics.
- Optional output boost up to +6 dB initially, only if measured headroom/peak protection supports it. Remember explicit choices without autoplay. Do not promise the app can override the car's hardware volume.
- Optional bounded Body and Mechanical Character controls in advanced Settings if the spec supports them. They must preserve profile identity and output bounds. Do not clutter the primary cockpit.

Smooth all gain changes with audio parameter automation. Normalize perceived profile loudness with documented offline trims, not aggressive real-time AGC that removes load dynamics. Use proper peak protection; DynamicsCompressorNode alone is not a guaranteed brickwall/true-peak limiter. Start with a documented ceiling such as -1 dBFS sample peak and measure true peak separately if supported. Be explicit about transient latency introduced by lookahead.

Ensure max volume + max boost + worst-case simultaneous layers + shift transient stays finite and within the declared output bound. Avoid solving peak failures by clipping waveforms. Account for crossfade overlap. Provide overload telemetry in the dev lab without exposing it in normal customer UI.

Test slider/mute mappings, smooth automation, persisted-setting migration, malformed preferences, peak stress cases, changing sounds at high volume and multiple contexts cleanup. Provide a listening/device checklist at a fixed moderate car volume and neutral car EQ; do not rely on phone speakers to assess sub-bass.
```

## Prompt 09 — Branded Drive Cockpit and fast sound switching

```text
Apply the common instructions. Implement Prompt 09 only using actual design-system tokens and logo assets.

Build a premium, uncluttered ELCAMOSO Drive Cockpit. Reuse the existing route and navigation where possible. Do not redesign the entire app. No competitor branding, mock logos or invented fonts.

Layout:
- Header: ELCAMOSO logo, active sound and a restrained telemetry status.
- Centre: large speed with unit. Surround or accompany with a smooth RPM arc and readable gear. Small clear indication that RPM/gear are simulated and GPS speed is an estimate.
- Bottom: three accessible favourite sound buttons, active sound picker, immediate master volume with +/- and mute, start/stop.
- Secondary: shift preset and settings entry. Detailed library, login, upgrades and rewards stay outside active driving mode.

Use the drivetrain state as the single source. Animate visual interpolation without inventing extra RPM values or shifts. When gearless, display an appropriate regime indicator instead of fictitious six-speed gearing. Show unavailable/stale speed explicitly, not a misleading zero. Readable typography, generous touch targets (at least roughly 48 CSS px), strong contrast and reduced-motion support. Do not make rapidly changing values noisy screen-reader live regions.

Adapt at representative 390×844 mobile and 1280×800 wide browser sizes, plus actual supported app breakpoints. Inspect screenshots for crowding, clipping, landscape safe areas, text scaling and long/localised sound names. Browser capability matters more than user-agent guesses. Fullscreen is optional enhancement with a fallback.

Fast sound switching:
- One shared preference/selection state for Settings and Drive.
- Preload, then crossfade about 300–600 ms; adapt fades to avoid correlated-source gain spikes.
- Preserve current speed and map to the new profile's legal RPM/gear. Don't force idle or replay start/shift events just because the profile changes.
- Latest selection wins during rapid taps; cancel stale work and dispose old voices after the fade. Failed loading leaves the current sound usable with a clear status.
- Respect entitlement checks; locked choices cannot start full premium playback. Keep favourites valid if access expires.

During active driving offer only minimal controls; defer text entry, purchases and reward interactions until the session is stopped. Do not treat GPS zero alone as reliable proof the car is parked. Browser/device restrictions may limit Tesla operation; don't claim to bypass them.

Add meaningful integration tests for state sharing, profile races, stale telemetry and access gating. Reuse existing visual test tooling for key layouts, then report what was actually inspected.
```

## Prompt 10 — Supabase passwordless email-code login

```text
Apply the common instructions. Implement Prompt 10 only. Re-read the audit's auth and billing ownership map before changing account code.

User flow: email → emailed one-time code → verified session → return to the intended internal app screen. No password is needed for this flow. Reuse the existing Supabase project if already configured; do not guess credentials. If another provider exists, preserve it while creating a deliberate migration/integration path. Never merge accounts solely from an unverified matching email supplied by the client.

Using the installed supported Supabase SDK, implement signInWithOtp for sending and verifyOtp with type 'email' for verification; verify current API behaviour against official docs. Document the required email template containing {{ .Token }} rather than only a magic link. Define whether first-time users may sign up; use shouldCreateUser intentionally.

Requirements:
- Clear email and six-digit-code screens with paste/autofill support, accessible labels, edit-email, loading, expired/invalid code handling and resend cooldown.
- Enforce server/provider rate limits and abuse controls; a disabled resend button alone is insufficient. Avoid unnecessary account-existence disclosure. Never log tokens.
- Configure a suitably short OTP lifetime, documenting provider-wide effects; do not claim a local countdown changes backend expiry.
- Use existing SSR/cookie/session patterns with server-side token verification appropriate to the SDK. Protected endpoints cannot trust client user IDs or a client-only session flag.
- Preserve user IDs, existing purchases and Stripe customer mappings. If migration is necessary, prepare an idempotent, reviewed mapping plan and tests; don't auto-merge production identities.
- Protect redirect destinations with an internal allowlist/path validation. Restore preferences/access after login without starting audio automatically.
- Implement logout and session-expiry handling across open tabs. Public profiles can continue under the explicit free policy; premium authorization follows the documented entitlement lease/offline policy.

Write a setup guide for SMTP sender/domain, templates, provider settings, local/staging/production URLs and environment-variable names only. Do not put secrets in the guide. Email-code entry should work in the car while the email is read on the phone; no phone-link-only session dependency.

Test new/existing account flow, wrong/expired/reused code, throttling, resend, redirects, cross-user access, existing paid account mapping and session refresh/logout. Mock provider tests do not prove real email delivery; list one staging end-to-end delivery check separately.
```

## Prompt 11 — Free sounds, premium access and temporary unlocks

```text
Apply the common instructions. Implement Prompt 11 only.

Choose three EXISTING, high-quality profiles to form a useful permanent free set: one muscle/body-led, one contrasting sport/mechanical, and one futuristic where available. Record the actual IDs and rationale in central configuration. Preserve existing grandfathered ownership; do not revoke a previously purchased profile because the new free set differs.

Keep cockpit, volume, fundamental gear realism and sound quality in the free tier. Premium access unlocks additional catalog content and any existing premium capabilities. Do not invent prices or activate new payment plans.

Create one authoritative entitlement resolver reused by catalog, favourites, playback authorization, rewards and account UI. Cover permanent free access, existing purchased grants, active subscriptions, temporary reward grants, expiry, cancellation and the current past-due/grace policy. Explicitly document precedence and UTC timestamp handling. Client booleans must not grant server access.

For protected sample assets, use the existing authenticated delivery mechanism or short-lived authorized downloads; note that assets already delivered to a browser are extractable. Procedural code shipped publicly cannot be made secret by hiding buttons. Define pragmatic product access enforcement honestly.

Define a bounded offline/session lease for already-authorized playback and revalidation on reconnect. On expiry during a drive, avoid a modal or abrupt sound blast: fade to an available free profile or stop according to a documented policy, without extending rights indefinitely. Account switching must invalidate previous-user grants and cached authorization.

Implement user-owned settings/grants with proper RLS or equivalent server authorization. Clients may read their access but cannot write premium entitlements. Add idempotent test fixtures and additive migration files as needed.

Test the complete access matrix, expired grants, cancellation/grace boundaries, direct protected-route requests, tampered requests, account switching, offline expiry and grandfathered access. Document all tier rules and configuration points.
```

## Prompt 12 — Monthly reward service and reward wheel

```text
Apply the common instructions. Implement Prompt 12 only behind a disabled-by-default rewards flag until campaign configuration is complete.

Create an ELCAMOSO-themed monthly Sound Spin outside active Drive mode. One free claim per verified eligible account per campaign month, using explicitly documented UTC calendar boundaries. No paid spins, speed/distance/acceleration requirements or automatic subscription enrolment.

First implement an authoritative server reward service; then build the visual wheel. The server records the outcome before animation. The client never chooses the prize, eligibility, probability, expiry or access level.

Data model should cover versioned campaigns, weighted eligible rewards, claims with uniqueness on account/campaign/period, durable fulfilment status, resulting entitlement grants and discount reservations. Use database constraints and transactions to enforce exactly one recorded claim under concurrent requests. Derive user identity from verified auth. An idempotency key supplements, not replaces, the period uniqueness constraint.

Use server-side cryptographic random selection with validated finite nonnegative weights and a normalized total. Separate free-user and paid-user reward pools. Snapshot reward terms/config version in the claim. If a configured pool is invalid or an inventory-limited outcome is unavailable, do not silently substitute a worse prize; implement a declared fallback or disable claiming.

Reward types: one sound for 48 hours, a sound pack for seven days, a cockpit theme, an eligible one-payment discount, and optional full-library weekend access with a precise activation/expiry rule. Rewards must have real value to the eligible account; avoid granting a subscriber content they already own as the only reward. Use staging-only illustrative probabilities; production probabilities and campaign terms are explicit configuration, not invented business facts.

Specify when temporary access starts (prefer claim time for the initial version), timezone and expiry in the UI before claiming. Persist outcome even if the animation is interrupted. Reload/retry returns the original reward; no reroll. Use a durable retryable fulfilment state and idempotent grant IDs so failures cannot lose the reward or grant it twice. User reads are scoped; privileged writes are server-only.

Wheel UI uses the app's branding, accessible result text, keyboard interaction, reduced-motion instant reveal and a clear next-eligibility date. Show actual odds/terms; if visual segment sizes are decorative rather than proportional, do not imply equal odds. No deceptive near misses. No reward pop-ups while a Drive session is active.

Test concurrent claims, different idempotency keys, period boundaries, retries after interruption, fulfillment failures, tampered reward IDs, cross-user reads, invalid weights and entitlement expiry. Include deterministic RNG injection for tests only; production selection remains server-authoritative.
```

## Prompt 13 — Stripe discount fulfilment without billing surprises

```text
Apply the common instructions. Implement Prompt 13 only. Reuse existing Stripe integration, pinned API version, verified customer ownership and webhook infrastructure. Do not create live coupons or modify live subscriptions.

Support two distinct configured cases:
1. An eligible non-subscriber uses a reward on a new monthly subscription purchase through the existing checkout.
2. An eligible active monthly subscriber applies a reward to one clearly identified future eligible payment.

Do not assume a once-duration coupon attached at an arbitrary time necessarily discounts the intended next regular invoice. Determine supported timing and invoice handling for the installed Stripe version, existing billing model and invoice state. If the target invoice is finalized or another discount conflicts, return a truthful pending/ineligible state or apply the explicit configured alternative. Never alter a paid invoice or silently change price, renewal date or plan.

Define product/price scope, currencies, eligible plan intervals, expiry, minimum amount if applicable, non-stacking policy, existing-discount precedence and handling for annual/cancelled/past-due accounts. Do not invent prices or promise monthly discounts to annual subscribers. All terms must be shown before redemption.

Use restricted server-side coupons/promotion codes or the appropriate direct subscription/invoice discount flow. Bind the reward to the verified user and Stripe customer; do not trust posted customer IDs. Avoid globally reusable public reward codes. Keep claims and provider operations idempotent with durable state for crash recovery. Retry with stable keys and reconcile existing Stripe objects before creating duplicates.

Verify webhook signatures from the raw body and handle duplicate/out-of-order delivery. Mark a discount reserved, applied and consumed accurately; a successful API request or checkout-return URL alone is not proof of an invoice discount. Reconcile refunds, cancellation and failed payment according to existing policy.

Add test-mode integration scenarios for first purchase, existing monthly subscriber, duplicate redemption, other customer's code, expired reward, conflicting discount, invoice boundary/race, timeout retry and webhook replay. Show expected invoice line/total assertions in test mode. Write operator setup and rollback instructions without secret values. Keep the feature off until configured.
```

## Prompt 14 — Integration, device validation and staged release

```text
Apply the common instructions. Implement Prompt 14 only: integrate, fix concrete defects and prepare a reviewable release; do not deploy automatically.

Review all implemented prompts together and resolve duplicate state, conflicting audio graphs, unused flags, drifted types and incomplete access rules. Preserve earlier unrelated work. The actual catalog must have complete spec coverage and a corresponding matrix row for every ID.

Run focused checks for:
- Production build/typecheck and relevant existing regression tests.
- All-profile finite output, bounds, source lifecycle and safe unknown-ID fallback.
- City shift sequence, no hunting, one event per shift, shared gauge/audio state, gearless behaviour and GPS loss.
- Loudness-matched baseline/new captures and human listening checklist status. Do not promote perceptual acceptance from numerical tests alone.
- Master/boost worst-case peaks, sound-switch overlap, mute, new-device defaults and persisted settings.
- Long-running playback, 20+ profile switches, memory growth, network loss, tab suspension, AudioContext resume, worklet fallback and device sample-rate differences.
- Login/session/ownership, entitlement expiry, monthly claim concurrency, reward fulfilment retry and Stripe test-mode invoice behaviour.
- Responsive cockpit, actual logo/design consistency, accessibility, reduced motion and localization.

Measure processing deadlines/dropouts on available devices rather than claiming a universal CPU percentage. Write an actual-device test script for desktop, iPhone and the user's Tesla browser. Start with parked/synthetic-telemetry tests. Record browser/vehicle software and observed restrictions. If Tesla audio/browser behaviour while moving cannot be verified, mark it pending; never bypass restrictions. The user should not need to manipulate the app while driving to test it.

Create docs/DRIVE_COCKPIT_V2_RELEASE_CHECKLIST.md, covering environment/config steps, additive migration order, flagged rollout, data compatibility, dependency ordering, monitoring with minimal non-sensitive events, explicit rollback and remaining manual listening/device checks. Auth and billing flags cannot leave a half-migrated identity system; describe their coordinated activation.

Finish with a compact readiness table for each feature: implemented, automated checks, listening checks, actual-device checks, external configuration and release flag state. Make no claim of all-realistic sounds, live email delivery, live discount application or Tesla support unless specifically demonstrated. Stop with the concrete reviewable result.
```

## Optional follow-up prompt — Refine one profile after listening

Use this after the first all-profile pass when you can name a particular sound. Replace the bracketed fields with an actual ID and observations.

```text
Apply the common instructions. Refine only profile [EXACT PROFILE ID].

My feedback: [e.g. idle is too thin; load sounds like a synthesizer; steady 50 km/h whistles; shifts click too sharply]. Playback device: [Tesla browser / headphones / other]. App volume/boost and car EQ/volume: [known settings or unknown]. Comparison reference: [licensed/accessible recording or none].

Read this profile's current spec, matrix row and baseline/new renders. Reproduce the reported regime with the production-engine fixture. Distinguish source/timbre issues from output-level and playback-system issues. Keep this profile's identity and changes scoped; don't globally darken every profile.

Make at most three clearly reasoned tuning variants, with loudness-matched captures using the same fixture and seed. Include an unchanged reference. Report what changed in pulse/source, body, mechanical texture, load mapping, filters and headroom. Run targeted output/event checks and provide a simple blind A/B/C listening option if the dev lab supports it. Don't fabricate a listening preference on my behalf.

Keep the existing profile default until a variant is selected, unless the change fixes an objective defect such as clipping or incorrect RPM mapping. Update the matrix and summarize remaining uncertainty.
```

## Research basis and implementation boundaries

The following sources informed the engineering direction. They do not establish ELCAMOSO's current implementation or the competitor's proprietary sound pipeline. Re-check SDK-specific details against installed versions during implementation.

| Source | Relevant contribution | Boundary |
| --- | --- | --- |
| [EngineV1](https://evenginev1.com/) | Public description: location-derived speed and simulated engine RPM, gears and load; sound/volume controls | Does not disclose exact synthesis or shift maps. No claim that it uses samples or granular synthesis. |
| [Audiokinetic: Loop-Based Car Engine Design, Part 1](https://www.audiokinetic.com/en/community/blog/loop-based-car-engine-design-with-wwise-part-1/) and [Part 2](https://www.audiokinetic.com/en/community/blog/loop-based-car-engine-design-with-wwise-part-2/) | Published loop-based engine-design workflow | Search indexing confirmed these resources; direct full-page retrieval was blocked during preparation. |
| [Audiokinetic: REV](https://www.audiokinetic.com/en/wwise/plugins/crankcase-rev-plugin/) | Granular engine-sound approach as an established alternative | A design reference, not a recommendation to add commercial middleware to a web app. Direct page retrieval was blocked; indexed description was available. |
| [Engine Simulator source](https://github.com/ange-yaghi/engine-sim) | Example of combustion simulation intended to generate engine audio | Native project, not a drop-in browser dependency; its own README distinguishes it from engineering-accurate simulation. |
| [MDN: Biquad filter types](https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode/type) | Browser filtering primitives for tonal shaping | EQ cannot recreate missing source detail. |
| [MDN: waveshaper oversampling](https://developer.mozilla.org/en-US/docs/Web/API/WaveShaperNode/oversample) | Oversampling controls for nonlinear processing | Assess aliasing/CPU; setting oversampling alone does not prove clean sound. |
| [MDN: GainNode](https://developer.mozilla.org/en-US/docs/Web/API/GainNode) | Gain automation and output-level control | Hardware volume and available headroom remain constraints. |
| [Supabase email passwordless authentication](https://supabase.com/docs/guides/auth/auth-email-passwordless) | Email OTP send/verify and template configuration | Existing identity and billing links need repository-specific handling. |
| [Stripe coupons and promotion codes](https://docs.stripe.com/billing/subscriptions/coupons) | Billing discount mechanisms and restrictions | Actual invoice timing and existing discounts must be tested for the integration. |

### What is proposed, not measured

Shift thresholds, envelope durations, volume defaults, frequency regions, boost limits and reward durations in this pack are starting design values. They are not certified acoustic targets, competitor reverse engineering or measurements of the current app. The audit, captures, per-profile tuning and actual-device checks establish the final values.

### Recommended first milestone

Complete Prompts 00–08, then listen to the raw-mechanical pilot profiles on the intended playback system before enabling the new engine broadly. The complete matrix still covers every sound; individual profiles can remain behind a flag or marked asset-pending where quality has not been demonstrated. Then finish the cockpit and account/reward prompts in order.
