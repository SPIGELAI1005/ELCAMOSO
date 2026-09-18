import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { AccountSignInDialog } from "@/components/AccountSignInDialog";
import { useAccount } from "@/lib/account/AccountProvider";
import { getDrivePlusYearlyDisplay } from "@/lib/billing/plan-display";
import {
  beginTeslaUpgradeCheckoutFn,
  resolveTeslaUpgradeTokenFn,
} from "@/lib/tesla-upgrade/server-fns";
import { createSeoHeadFromPath } from "@/lib/seo";

export const Route = createFileRoute("/upgrade/$token")({
  validateSearch: (search: Record<string, unknown>): { billing?: string } => {
    const billing = typeof search["billing"] === "string" ? search["billing"] : undefined;
    return billing ? { billing } : {};
  },
  component: UpgradeTokenScreen,
  head: () => createSeoHeadFromPath("/upgrade"),
});

function UpgradeTokenScreen() {
  const { token } = Route.useParams();
  const { billing } = Route.useSearch();
  const { session, isAuthenticated, isLoading } = useAccount();
  const yearly = getDrivePlusYearlyDisplay();
  const [resolved, setResolved] = useState<Awaited<
    ReturnType<typeof resolveTeslaUpgradeTokenFn>
  > | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void resolveTeslaUpgradeTokenFn({ data: { token } }).then(setResolved);
  }, [token]);

  async function startCheckout() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const result = await beginTeslaUpgradeCheckoutFn({
        data: {
          token,
          sessionToken: null,
          origin: window.location.origin,
          returnPath: `/upgrade/${encodeURIComponent(token)}`,
        },
      });
      window.location.assign(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment is unavailable right now.");
      setBusy(false);
    }
  }

  function handleContinueClick() {
    if (isLoading || busy) return;
    if (isAuthenticated && session) {
      void startCheckout();
      return;
    }
    setShowSignIn(true);
  }

  if (!resolved) {
    return (
      <main className="min-h-screen px-6 py-16">
        <p className="text-sm text-muted-foreground">Loading secure link…</p>
      </main>
    );
  }

  if (!resolved.valid && resolved.status === "completed") {
    return (
      <main className="min-h-screen px-6 py-16">
        <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">Drive+</p>
        <h1 className="mt-4 text-3xl font-light">Already on Drive+</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Return to your car - the full motion feel should update automatically.
        </p>
      </main>
    );
  }

  if (!resolved.valid) {
    return (
      <main className="min-h-screen px-6 py-16">
        <h1 className="text-3xl font-light">Link expired</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Scan a fresh code from your car to continue with Drive+.
        </p>
      </main>
    );
  }

  if (billing === "success") {
    return (
      <main className="min-h-screen px-6 py-16">
        <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">Drive+</p>
        <h1 className="mt-4 text-3xl font-light">Payment received</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Your car should show Drive+ is ready within a few seconds. You can close this page.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-16 sm:px-10">
      <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">Drive+</p>
      <h1 className="mt-4 text-3xl font-light leading-snug">
        Virtual shifts.
        <br />
        Live rev.
        <br />
        Rev matching.
      </h1>
      <p className="mt-6 text-sm text-muted-foreground">More emotion in every drive.</p>
      <p className="mt-8 text-2xl font-light">
        {yearly.amount}
        <span className="text-base text-muted-foreground"> / year</span>
      </p>
      {!resolved.billingAvailable ? (
        <p className="mt-6 text-sm text-muted-foreground">Drive+ is not available yet.</p>
      ) : (
        <button
          type="button"
          disabled={busy || isLoading}
          onClick={handleContinueClick}
          className="mt-10 inline-flex h-14 items-center justify-center rounded-full bg-primary px-10 text-sm tracking-[0.22em] text-primary-foreground uppercase disabled:opacity-50"
        >
          {busy ? "Opening secure payment…" : "Continue with Drive+"}
        </button>
      )}
      {error ? <p className="mt-4 text-sm text-muted-foreground">{error}</p> : null}
      <p className="mt-8 max-w-sm text-xs text-muted-foreground">
        Secure payment on this phone. Your car updates automatically when payment completes.
      </p>
      <AccountSignInDialog
        open={showSignIn}
        onOpenChange={setShowSignIn}
        returnTo={`/upgrade/${encodeURIComponent(token)}`}
      />
    </main>
  );
}
