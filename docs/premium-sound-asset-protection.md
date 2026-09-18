# Premium sound asset protection

**Status:** Audit complete · delivery foundation ready · no WAV library shipped (2026-08-29)

**Related:** `docs/audio-asset-requirements.md`, `src/lib/sound-assets/`

---

## Executive summary

| Question                                                    | Answer                                                                                                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Are premium audio files in a public static directory today? | **No.** `public/` contains PWA assets only (manifest, service worker, icons).                                                                                      |
| Are there `.wav` / `.mp3` / `.ogg` files in the repo?       | **No.**                                                                                                                                                            |
| How does Drive+ sound gating work today?                    | **Client entitlement** on profile IDs (`profile-access-config.ts`, `EntitlementEnforcer`). All 47 built-in profiles are **procedural Web Audio** in the JS bundle. |
| Is server-side asset delivery implemented?                  | **Foundation only:** signed manifest + delivery routes. Catalog is empty until recorded samples ship.                                                              |

**Conclusion:** There is nothing to move out of `public/` today. When WAV/hybrid assets are added, they must **not** be placed in `public/`. Use the entitlement-gated manifest flow below.

---

## Current delivery model

```
Built-in Sound Profiles (47)
  └── procedural synthesis in JS bundle (profiles.ts, profiles-expansion.ts, engine.ts)
  └── access gate: profile id + entitlement (not URL secrecy)

User-created audio
  └── Snippets: localStorage data URLs (device-local)
  └── Garage recipes: JSON in localStorage / optional cloud sync
  └── Sound packs: JSON export (no binary assets)

Dynamic Drive transients (future WAVs)
  └── Specified in docs/audio-asset-requirements.md
  └── Procedural fallbacks remain when samples missing
```

Procedural code in the bundle can be inspected in DevTools. That is acceptable for v1: Drive+ value is the **full library + Dynamic Drive**, not hiding oscillator graphs. **Recorded samples** are the primary piracy surface and are what this document protects.

---

## Target model (when samples exist)

Reasonable subscription enforcement — **not DRM**.

```
Client (authenticated)
    │
    ▼
POST /api/sound-assets/manifest
    │  resolve session (optional for FREE-only assets)
    │  filter catalog by entitlement (all_sound_profiles)
    │  issue short-lived signed URLs (30 min default)
    ▼
Manifest JSON { assets: [{ id, url, expiresAt }] }
    │
    ▼
Client prefetch → fetch(url) → decodeAudioData → IndexedDB cache
    │
    ▼
Engine plays AudioBuffer (procedural mix-under unchanged)
```

**Delivery route:** `GET /api/sound-assets/delivery?path=&exp=&sig=`

- Verifies HMAC signature and expiry.
- Serves the **whole file** once (or redirects to CDN/R2). Does **not** stream per-frame through the app server.
- Signature is only minted after entitlement check in the manifest builder, so premium paths never receive valid URLs without Drive+.

### FREE tier

FREE sample assets (if any) may use the same signing flow or remain on a public CDN path. The catalog marks each asset `tier: "free" | "drive_plus"`. Unauthenticated manifest requests receive FREE assets only.

### Production storage

| Env                          | Purpose                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `SOUND_ASSET_SIGNING_SECRET` | HMAC secret for signed URLs (required when catalog non-empty)                           |
| `SOUND_ASSETS_STORAGE_ROOT`  | Local directory for dev/single-node file serve                                          |
| `SOUND_ASSETS_CDN_BASE_URL`  | Optional. When set, delivery redirects to `{CDN}/{path}?…` instead of reading from disk |

For object storage (R2, S3), prefer **CDN-signed URLs** at the edge. The manifest service can be extended to call provider APIs; the entitlement gate stays the same.

---

## Tesla browser constraints

- Prefetch manifests **before** drive or on Wi‑Fi when possible.
- Cache decoded buffers in **IndexedDB**; reuse across sessions until `expiresAt`.
- Keep procedural fallback so Drive audio never depends on network mid-session.
- Signed URL TTL (30 min) balances re-auth overhead vs. link sharing window.
- Avoid large manifest payloads; filter by `personality` in the request body when needed.

---

## Limitations (non-negotiable)

Browser-delivered audio **cannot be made impossible to copy**.

| Threat                                 | Mitigation                                            | Residual risk                             |
| -------------------------------------- | ----------------------------------------------------- | ----------------------------------------- |
| DevTools → save URL                    | Short TTL + per-session manifest                      | Determined user can capture during window |
| Screen/audio capture                   | None (out of scope)                                   | Always possible                           |
| Shared signed URL                      | Expiry + optional IP binding later                    | Link works until expiry                   |
| Offline cache after cancel             | Periodic manifest refresh; stale cache OK for session | User keeps buffers until cleared          |
| Procedural profile reverse-engineering | Not targeted                                          | Code visible in bundle                    |

**Goal:** Raise the effort bar for casual redistribution and tie bulk downloads to an active subscription — not forensic DRM.

---

## Implementation map

| File                                       | Role                                                   |
| ------------------------------------------ | ------------------------------------------------------ |
| `src/lib/sound-assets/types.ts`            | Manifest and catalog types                             |
| `src/lib/sound-assets/catalog.ts`          | Asset registry (`tier`, paths) — empty until WAVs land |
| `src/lib/sound-assets/signing.ts`          | HMAC sign/verify                                       |
| `src/lib/sound-assets/manifest-service.ts` | Entitlement filter + URL minting                       |
| `src/routes/api/sound-assets/manifest.ts`  | Authenticated manifest endpoint                        |
| `src/routes/api/sound-assets/delivery.ts`  | Signed file delivery (whole file)                      |
| `src/lib/sound-assets/client-loader.ts`    | Browser prefetch + decode helper                       |

When adding assets: register in `catalog.ts`, place files under `SOUND_ASSETS_STORAGE_ROOT` (never `public/`), wire `sampleMap` in the engine per `audio-asset-requirements.md`.

---

## Checklist before shipping WAVs

- [ ] Register each file in `SOUND_ASSET_CATALOG` with correct `tier`
- [ ] Set `SOUND_ASSET_SIGNING_SECRET` in production
- [ ] Confirm no premium paths under `public/`
- [ ] Load test manifest + prefetch on Tesla browser
- [ ] Verify procedural fallback when manifest unavailable
- [ ] Document new personalities in `audio-asset-requirements.md`
