# Production release checklist

Gate for public promotion of ELCAMOSO (Tesla + phone + audio + Symphony).
Baseline: Vercel TanStack Start + Motion Experiences; commit `18606f3` and subsequent work.

## Blockers (must be green)

- [ ] Dedicated drive relay deployed and healthy (`docs/DRIVE_RELAY_DEPLOYMENT.md`)
- [ ] `VITE_DRIVE_RELAY_PUBLIC_ORIGIN` set on production build
- [ ] `DRIVE_RELAY_INTERNAL_URL` + `DRIVE_RELAY_INTERNAL_SECRET` on Vercel
- [ ] End-to-end QR pair → WS → phone source → sound responds (measure pair / latency / reconnect)
- [ ] No Google / Stripe / DB secrets on relay or in client bundles

## Vercel

- [ ] Production domain `www.elcamoso.com` (and apex redirect)
- [ ] `ELCAMOSO_ENV=production`
- [ ] `ELCAMOSO_ALLOWED_ORIGINS` includes production origins
- [ ] Node runtime / Nitro vercel preset build succeeds
- [ ] Preview vs production env separation verified

## Relay

- [ ] `GET https://relay…/health` → 200
- [ ] `wss://relay…/api/drive-relay/ws` upgrades
- [ ] Create/claim/join share the same store as WS peers
- [ ] CORS / allowed origins for Tesla + phone
- [ ] Rate limits + message size cap active

## Environment variables

- [ ] Tesla OAuth production client + redirect URI
- [ ] Google account OAuth production client + redirect (server-only)
- [ ] Stripe keys + webhook + price IDs (server-only; `MONETIZATION_ENABLED` intentional)
- [ ] `DATABASE_URL` / Cloud as required (never expose as `VITE_`)
- [ ] `SOUND_ASSET_SIGNING_SECRET` if premium WAVs
- [ ] Symphony / Fusion / Worlds feature flags documented

## OAuth / Stripe / Cloud

- [ ] Account Google callback works; no client secret in network tab
- [ ] Tesla Fleet callback works; tokens encrypted at rest
- [ ] Stripe Checkout + webhook idempotency
- [ ] Billing public config contains no `sk_`

## Audio assets

- [ ] Pack manifests licensed (`docs/MUSIC_ASSET_GOVERNANCE.md`)
- [ ] Every production stem passes the per-asset provenance, alignment, 48 kHz, peak, and RMS gate
- [ ] Lazy load + preload path (`pack-loader`) exercised
- [ ] Failure copy “Music couldn't load.” + Retry / Switch Experience
- [ ] PWA SW does **not** precache every Symphony pack
- [ ] Limiter / max gain 0.85; no sudden volume jumps

## CORS / CSP / headers

- [ ] HSTS present
- [ ] CSP reviewed for Web Audio / WS / Stripe / Google
- [ ] Relay CORS allowlist tight

## PWA

- [ ] Shell cache only (`elcamoso-shell-v*`)
- [ ] No unbounded audio Cache Storage growth

## Tesla

- [ ] Smoke test (`docs/TESLA_BROWSER_SMOKE_TEST.md`)
- [ ] Safety mode: no Studio/Explore interaction while moving
- [ ] Pairing copy: parked / passenger; no vehicle-control implication

## Phone QR

- [ ] QR = `/pair/{claimToken}` only (no join secret)
- [ ] Claim one-time + TTL
- [ ] Join secret in `sessionStorage` only (tab lifetime)
- [ ] Fallback to browser sensors on relay loss

## Symphony / Fusion / Worlds

- [ ] Development synthesis is unavailable in production
- [ ] Approved Symphony assets load without falling back to development synthesis
- [ ] Fusion worst-case audition on Tesla (diagnostics off)
- [ ] World layer failure does not mute Drive

## Sharing / privacy

- [ ] Journey / Drive Song share: no GPS / route (`docs/DRIVE_SHARING_PRIVACY.md`)
- [ ] Usage Insights opt-in; no DriveState / GPS
- [ ] Share tokens not enumerable as short IDs (payload-in-URL or unguessable)

## Quality gates

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

- [ ] No blind audio snapshot update (`test:update-audio` only when intentional)

## Sign-off

| Role    | Name | Date |
| ------- | ---- | ---- |
| Eng     |      |      |
| Product |      |      |
| Ops     |      |      |
