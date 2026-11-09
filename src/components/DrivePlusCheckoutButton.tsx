import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { useAccount } from "@/lib/account/AccountProvider";
import { AccountSignInDialog } from "@/components/AccountSignInDialog";
import type { CheckoutIntervalSlug, CheckoutPlanSlug } from "@/lib/billing/checkout-request";
import { openDrivePlusCheckout } from "@/lib/billing/checkout-client";
import { checkoutResumeReturnTo } from "@/lib/billing/checkout-resume";
import { useSettings } from "@/lib/drive/useSettings";
import { trackMonetizationEvent } from "@/lib/telemetry/monetization-analytics";

function checkoutFailureMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : error &&
          typeof error === "object" &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : "";
  const message = raw.replace(/sk_(live|test)_[A-Za-z0-9]+/g, "sk_…").trim();
  if (!message || message.length > 240) return "Payment is unavailable right now.";
  return message;
}

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
  const { settings } = useSettings();
  const [showSignIn, setShowSignIn] = useState(false);
  const signInReturnTo = checkoutResumeReturnTo(returnTo, { plan, interval, source });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const lang = settings.language.slice(0, 2).toLowerCase();
  const consentCopy =
    lang === "de"
      ? "Ich verlange den sofortigen Beginn der digitalen Leistung und nehme zur Kenntnis, dass mein 14-tägiges Widerrufsrecht dann erlischt, wie in der Widerrufsbelehrung erläutert."
      : lang === "ro"
        ? "Solicit începerea imediată a serviciului digital și recunosc că dreptul de retragere de 14 zile expiră, conform informațiilor de retragere."
        : "I request immediate start of the digital service and acknowledge that my 14-day withdrawal right then expires, as explained in the withdrawal information.";
  const withdrawalLabel =
    lang === "de"
      ? "Widerrufsbelehrung"
      : lang === "ro"
        ? "Informații de retragere"
        : "Withdrawal information";

  useEffect(() => {
    const restoreLabel = () => setBusy(false);
    window.addEventListener("pageshow", restoreLabel);
    return () => window.removeEventListener("pageshow", restoreLabel);
  }, []);

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
      await openDrivePlusCheckout(interval, returnTo, source, plan, true);
    } catch (error) {
      setError(checkoutFailureMessage(error));
      setBusy(false);
    }
  }

  async function handleClick() {
    if (isLoading || busy) return;
    if (!consent) {
      setError(
        lang === "de"
          ? "Bitte bestätige den sofortigen Beginn der Leistung."
          : lang === "ro"
            ? "Confirmă începerea imediată a serviciului."
            : "Please confirm immediate start of the service.",
      );
      return;
    }
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
    <div className="w-full">
      <label className="mt-6 flex cursor-pointer items-start gap-2 text-left text-xs leading-relaxed text-muted-foreground">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-foreground"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked);
            setError(null);
          }}
          data-testid="checkout-immediate-start-consent"
        />
        <span>
          {consentCopy}{" "}
          <Link to="/legal/withdrawal" className="underline underline-offset-2">
            {withdrawalLabel}
          </Link>
          .
        </span>
      </label>
      <button
        type="button"
        disabled={busy || isLoading || !consent}
        onClick={() => void handleClick()}
        className={className}
      >
        {busy ? "One moment…" : label}
      </button>
      {error ? <p className="mt-3 text-sm text-muted-foreground">{error}</p> : null}
      <AccountSignInDialog
        open={showSignIn}
        onOpenChange={setShowSignIn}
        returnTo={signInReturnTo}
      />
    </div>
  );
}
