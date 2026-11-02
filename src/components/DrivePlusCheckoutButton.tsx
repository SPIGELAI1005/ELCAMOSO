import { useState } from "react";

import { useAccount } from "@/lib/account/AccountProvider";
import { AccountSignInDialog } from "@/components/AccountSignInDialog";
import type { CheckoutIntervalSlug, CheckoutPlanSlug } from "@/lib/billing/checkout-request";
import { openDrivePlusCheckout } from "@/lib/billing/checkout-client";
import { trackMonetizationEvent } from "@/lib/telemetry/monetization-analytics";

interface DrivePlusCheckoutButtonProps {
  interval: CheckoutIntervalSlug;
  className?: string;
  label: string;
  returnTo?: string;
  source?: string;
  /** Package to buy (Lifetime always includes both). */
  plan?: CheckoutPlanSlug;
}

/** Starts Stripe Checkout for Drive+ or redirects existing subscribers to manage. */
export function DrivePlusCheckoutButton({
  interval,
  className,
  label,
  returnTo = "/pricing",
  source = "pricing",
  plan = "drive_plus",
}: DrivePlusCheckoutButtonProps) {
  const { session, isAuthenticated, isLoading } = useAccount();
  const [showSignIn, setShowSignIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    if (!session) return;
    setBusy(true);
    setError(null);
    trackMonetizationEvent("plan_interval_selected", {
      source,
      plan,
      interval,
    });
    trackMonetizationEvent("checkout_started", {
      source,
      plan,
      interval,
    });
    try {
      await openDrivePlusCheckout(interval, returnTo, source, plan);
    } catch {
      setError("Payment is unavailable right now.");
      setBusy(false);
    }
  }

  async function handleClick() {
    if (isLoading || busy) return;
    trackMonetizationEvent("upgrade_clicked", {
      source,
      plan,
      interval,
    });
    if (isAuthenticated && session) {
      await startCheckout();
      return;
    }
    setShowSignIn(true);
  }

  return (
    <>
      <button
        type="button"
        disabled={busy || isLoading}
        onClick={() => void handleClick()}
        className={className}
      >
        {busy ? "One moment…" : label}
      </button>
      {error ? <p className="mt-3 text-sm text-muted-foreground">{error}</p> : null}
      <AccountSignInDialog open={showSignIn} onOpenChange={setShowSignIn} returnTo={returnTo} />
    </>
  );
}
