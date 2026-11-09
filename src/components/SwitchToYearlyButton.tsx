"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAccount } from "@/lib/account/AccountProvider";
import { getDriveMusicYearlyDisplay, getDrivePlusYearlyDisplay } from "@/lib/billing/plan-display";
import { getSubscriptionSummaryFn, switchToYearlyFn } from "@/lib/billing/server-fns";
import { isFoundersPackQualifyingPurchaseTime } from "@/lib/founders/founders";

const buttonClass =
  "inline-flex h-11 items-center rounded-full border border-foreground/20 px-5 text-[11px] tracking-[0.2em] text-foreground uppercase transition hover:border-foreground/40 disabled:opacity-50";

/** Monthly Drive+ / Drive the Music → yearly of the same package. */
export function SwitchToYearlyButton({ className }: { className?: string }) {
  const { isAuthenticated } = useAccount();
  const qc = useQueryClient();
  const summaryQuery = useQuery({
    queryKey: ["subscription-summary"],
    queryFn: () => getSubscriptionSummaryFn({ data: {} }),
    enabled: isAuthenticated,
    staleTime: 15_000,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const canSwitch = Boolean(summaryQuery.data?.summary.canSwitchToYearly);
  if (!isAuthenticated || !canSwitch) return null;

  const yearly =
    summaryQuery.data?.summary.planLabel === "Drive+"
      ? getDrivePlusYearlyDisplay()
      : getDriveMusicYearlyDisplay();
  const founders = isFoundersPackQualifyingPurchaseTime(Date.now());

  async function onSwitch() {
    setBusy(true);
    setError(null);
    try {
      await switchToYearlyFn({ data: {} });
      setDone(
        founders
          ? "Switched to yearly. You are a Founder: Drive Unlimited for 4 months and 4 forever sounds."
          : "Switched to yearly.",
      );
      void qc.invalidateQueries({ queryKey: ["subscription-summary"] });
      void qc.invalidateQueries({ queryKey: ["entitlements"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not switch to yearly.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        data-testid="switch-to-yearly"
        className={className ?? buttonClass}
        disabled={busy}
        onClick={() => void onSwitch()}
      >
        {busy ? "Switching…" : `Switch to yearly · ${yearly.amount}/year`}
      </button>
      {founders ? (
        <p className="text-xs text-muted-foreground">
          Switching to yearly before 27 November 2026 23:59 Berlin is the Founders Pack (subject to
          remaining seats).
        </p>
      ) : null}
      {done ? <p className="text-sm text-muted-foreground">{done}</p> : null}
      {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}
    </div>
  );
}
