# Production readiness — live billing

Checklist before setting `MONETIZATION_ENABLED=1` in production.

## Feature flag

| Variable | Default | Effect |
|----------|---------|--------|
| `MONETIZATION_ENABLED` | off | When `0` / unset: no checkout, upgrades, trials, or purchase UX. FREE ELCAMOSO works normally. |
| Stripe env vars | — | Required for billing when flag is on. Webhooks still process if Stripe is configured (existing subscribers). |

```env
# Keep false until every item below is verified
MONETIZATION_ENABLED=0

# Production Stripe (live keys — separate from test)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_DRIVE_PLUS_MONTHLY=
STRIPE_PRICE_DRIVE_PLUS_YEARLY=

# Required in production for checkout return URLs
ELCAMOSO_ALLOWED_ORIGINS=https://your-production-domain.com
ELCAMOSO_ENV=production
```

Optional scoped overrides: `STRIPE_*_PRODUCTION`, `STRIPE_*_STAGING` (see `.env.example`).

---

## Pre-flight commands

Run from repo root:

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

### Local dev server

If the UI looks stale (empty `/drive`, hold-to-accelerate dead, missing sections):

1. Stop any old `npm run dev` process (may be running for days without picking up changes).
2. Start fresh: `npm run dev`
3. Hard refresh the browser: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
4. Confirm Vite shows `[vite] page reload` or HMR after saves

Dev URL: `http://localhost:5173`

`MONETIZATION_ENABLED=0` hides checkout and trials only — **Free / Drive+ prices still show** on `/` and `/pricing`.

Optional (requires Stripe test keys):

```bash
npm test -- --run src/lib/billing/stripe/lifecycle.integration.test.ts
# when STRIPE_LIFECYCLE_TEST_CLOCK=1
```

Playwright smoke:

```bash
npm run test:e2e -- e2e/tesla-purchase.spec.ts e2e/routes-smoke.spec.ts
```

---

## Stripe live / test separation

| Check | How to verify |
|-------|----------------|
| Test keys never in production deploy | Production env uses `sk_live_…` / live Price ids only |
| Live webhook secret separate | Dashboard → Developers → Webhooks → signing secret for **live** endpoint |
| Price ids match Dashboard | `STRIPE_PRICE_DRIVE_PLUS_*` match live recurring Prices (EUR amounts align with `plan-display.ts`) |
| Test mode smoke first | Full flow on test keys with `MONETIZATION_ENABLED=1` on staging |

Display amounts in UI (`€25` / year, `€3` / month) must match Stripe Price configuration.

---

## Webhook endpoint

| Item | Value |
|------|--------|
| Route | `POST /api/stripe/webhook` |
| Body | Raw UTF-8 (no JSON middleware) |
| Header | `Stripe-Signature` verified server-side |
| Events | `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed` |

Stripe Dashboard (live): point webhook to `https://your-production-domain.com/api/stripe/webhook`.

Use Postgres (`DATABASE_URL`) for webhook idempotency ledger in production.

---

## Success / cancel URLs

Checkout builds:

- Success: `{origin}{returnPath}?billing=success&session_id={CHECKOUT_SESSION_ID}`
- Cancel: `{origin}{returnPath}?billing=cancel`

`origin` must pass `ELCAMOSO_ALLOWED_ORIGINS` or match request `Host` in production.

Verify return paths:

| Flow | returnPath |
|------|------------|
| Pricing | `/pricing` |
| Settings plan | `/settings?workspace=plan` |
| Tesla upgrade | `/upgrade/{token}` |
| Trial complete | `/drive` |

---

## Production domain

- [ ] `ELCAMOSO_ALLOWED_ORIGINS` includes production HTTPS origin
- [x] Google OAuth redirect URI registered: `https://www.elcamoso.com/auth/account/google/callback` (also support local `http://localhost:5173/...` for dev) — see `docs/account-google-oauth.md`
- [ ] Magic-link origin/redirects registered for production domain
- [ ] HTTPS enforced (Stripe requires secure contexts for live checkout return)
- [x] Account session cookie: HttpOnly + Secure in production + SameSite=Lax
- [ ] Cookie / PWA scope matches production host

---

## Customer portal

- [ ] Stripe Customer Portal configured (subscription cancel, payment method update)
- [ ] Portal return URL uses allowed origin → `/settings?workspace=plan`
- [ ] Existing Drive+ users can **Manage plan** when Stripe configured (even during staged rollout)

---

## Legal and disclosures

| Page | Path | Verify |
|------|------|--------|
| Terms | `/legal/terms` | Drive+ section: subscription, trial, cancellation, refunds |
| Privacy | `/legal/privacy` | Payment processor data processing |
| Impressum | `/legal/impressum` | Operator contact current |
| Cookies | `/legal/cookies` | Consent flow linked from banner |
| Legal index | `/legal` | All links resolve |

Trial disclosure (in-app): **30 minutes · up to 3 drives · no card required · 14-day window** — shown in trial offer before activation.

Pricing consistency: UI uses `plan-display.ts` constants; Stripe Prices must match.

---

## When `MONETIZATION_ENABLED=0`

Expected behavior (verified by tests):

- `/`, `/drive`, `/demo`, `/sounds` work as FREE tier
- **Pricing information remains visible** on `/` (Plans) and `/pricing` (no checkout buttons)
- No upgrade prompts, trial offers, or checkout buttons
- `/pricing` shows “billing opens later” message
- Settings plan panel: no upgrade CTA
- Premium gates hidden (no purchase path)
- Webhooks still sync existing subscriptions if Stripe configured

---

## Enable live billing

1. Complete checklist above on staging with test keys + `MONETIZATION_ENABLED=1`
2. Run Tesla purchase smoke test (`docs/TESLA_BROWSER_SMOKE_TEST.md` §8)
3. Configure live Stripe + webhook on production
4. Set `MONETIZATION_ENABLED=1` on production deploy
5. Monitor webhook failures via admin diagnostics (dev) and Stripe Dashboard

---

## Related docs

- `docs/billing/security.md` — threat model and limits
- `docs/billing/stripe-test-suite.md` — lifecycle tests
- `docs/billing/tesla-purchase-e2e.md` — in-car purchase flow
- `docs/billing/failure-resilience.md` — outage behavior
