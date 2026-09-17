import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useAccount } from "@/lib/account/AccountProvider";
import { AccountSignInDialog } from "@/components/AccountSignInDialog";
import { openBillingPortal } from "@/lib/billing/portal-client";
import { getDrivePlusYearlyDisplay } from "@/lib/billing/plan-display";
import { getSubscriptionSummaryFn } from "@/lib/billing/server-fns";
import type { SubscriptionSummary } from "@/lib/billing/subscription-summary";
import { trackMonetizationEvent } from "@/lib/telemetry/monetization-analytics";

const FREE_SUMMARY: SubscriptionSummary = {
  planLabel: "Free",
  intervalLabel: null,
  statusHeadline: null,
  statusDetail: null,
  actionHint: null,
  canManageSubscription: false,
  canUpgrade: true,
  trial: null,
};

interface BillingSettingsPanelProps {
  billingFlash?: "success" | "cancel" | null;
}

/** Concise account and billing summary for Settings. */
export function BillingSettingsPanel({ billingFlash = null }: BillingSettingsPanelProps) {
  const { session, isAuthenticated, signOut } = useAccount();
  const [summary, setSummary] = useState<SubscriptionSummary>(FREE_SUMMARY);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yearlyPrice = getDrivePlusYearlyDisplay();

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void getSubscriptionSummaryFn({
      data: { sessionToken: null },
    })
      .then((result) => {
        if (cancelled) return;
        setSummary(result.summary);
        setAccountEmail(result.authenticated ? result.email : null);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load your plan.");
        setSummary(FREE_SUMMARY);
        setAccountEmail(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.userId, isAuthenticated]);

  useEffect(() => {
    if (billingFlash === "success") {
      trackMonetizationEvent("checkout_completed", {
        source: "settings_plan",
        plan: "drive_plus",
      });
    }
    if (billingFlash === "cancel") {
      trackMonetizationEvent("checkout_canceled", {
        source: "settings_plan",
        plan: "drive_plus",
      });
    }
  }, [billingFlash]);

  async function handleManageSubscription() {
    if (!isAuthenticated || !summary.canManageSubscription) return;
    setIsOpeningPortal(true);
    setError(null);
    try {
      await openBillingPortal("/settings?workspace=plan");
    } catch {
      setError("Could not open plan settings.");
      setIsOpeningPortal(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
        <p className="text-[11px] tracking-[0.24em] text-muted-foreground uppercase">Account</p>
        {isAuthenticated && accountEmail ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-foreground">{accountEmail}</p>
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              Sign in to sync your plan across devices.
            </p>
            <button
              type="button"
              onClick={() => setShowSignIn(true)}
              className="h-11 rounded-full border border-foreground/20 px-5 text-[11px] tracking-[0.2em] text-foreground uppercase transition hover:border-foreground/40"
            >
              Sign in
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
        <p className="text-[11px] tracking-[0.24em] text-muted-foreground uppercase">Plan</p>
        <p className="mt-3 text-lg font-light tracking-[0.08em] text-foreground">
          {summary.planLabel}
        </p>
        {summary.intervalLabel ? (
          <p className="mt-1 text-sm text-muted-foreground">{summary.intervalLabel}</p>
        ) : null}

        {summary.statusHeadline ? (
          <div className="mt-4 space-y-1">
            <p className="text-sm text-foreground">{summary.statusHeadline}</p>
            {summary.statusDetail ? (
              <p className="text-sm text-foreground">{summary.statusDetail}</p>
            ) : null}
            {summary.actionHint ? (
              <p className="text-sm text-muted-foreground">{summary.actionHint}</p>
            ) : null}
          </div>
        ) : null}

        {summary.trial ? (
          <div className="mt-4 space-y-1">
            <p className="text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
              {summary.trial.label}
            </p>
            {summary.trial.detail ? (
              <p className="text-sm text-muted-foreground">{summary.trial.detail}</p>
            ) : null}
          </div>
        ) : null}

        {isLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading…</p> : null}
      </section>

      {billingFlash === "success" ? (
        <p className="text-sm text-muted-foreground">Plan updated.</p>
      ) : null}
      {billingFlash === "cancel" ? (
        <p className="text-sm text-muted-foreground">Payment not completed.</p>
      ) : null}
      {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        {summary.canUpgrade ? (
          <Link
            to="/pricing"
            onClick={() =>
              trackMonetizationEvent("upgrade_clicked", {
                source: "settings_plan",
                plan: "drive_plus",
              })
            }
            className="inline-flex h-11 items-center rounded-full border border-foreground bg-foreground px-5 text-[11px] tracking-[0.2em] text-background uppercase transition hover:opacity-90"
          >
            Drive+ · {yearlyPrice.amount}/year
          </Link>
        ) : null}
        {summary.canManageSubscription ? (
          <button
            type="button"
            onClick={() => void handleManageSubscription()}
            disabled={isOpeningPortal}
            className="h-11 rounded-full border border-foreground/20 px-5 text-[11px] tracking-[0.2em] text-foreground uppercase transition hover:border-foreground/40 disabled:opacity-50"
          >
            {isOpeningPortal ? "Opening…" : "Manage plan"}
          </button>
        ) : null}
      </div>

      <AccountSignInDialog
        open={showSignIn}
        onOpenChange={setShowSignIn}
        returnTo="/settings?workspace=plan"
      />
    </div>
  );
}
