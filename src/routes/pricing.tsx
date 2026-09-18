import { createFileRoute, Link } from "@tanstack/react-router";
import { createSeoHeadFromPath } from "@/lib/seo";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { DrivePlusCheckoutButton } from "@/components/DrivePlusCheckoutButton";
import { PlansBillingIntervalToggle, PlansOverview } from "@/components/LandingPlansSection";
import { getBillingPublicConfigFn } from "@/lib/billing/public-config-server-fn";
import type { BillingDisplayInterval } from "@/lib/billing/plan-display";
import { getDrivePlusMonthlyDisplay, getDrivePlusYearlyDisplay } from "@/lib/billing/plan-display";
import { useEntitlements } from "@/lib/entitlements/useEntitlements";
import { trackMonetizationEvent } from "@/lib/telemetry/monetization-analytics";

export const Route = createFileRoute("/pricing")({
  component: Pricing,
  head: () => createSeoHeadFromPath("/pricing"),
});

function OpenDriveLink() {
  return (
    <Link
      to="/drive"
      className="mt-10 inline-flex h-12 min-w-[11.5rem] items-center justify-center rounded-full border border-foreground/20 px-8 text-[11px] tracking-[0.2em] text-foreground uppercase transition hover:border-foreground/40"
    >
      Open Drive
    </Link>
  );
}

function PricingFooterNotes({ showCancel = true }: { showCancel?: boolean }) {
  return (
    <section className="mx-auto w-full max-w-2xl px-6 py-12 sm:px-10">
      {showCancel ? <p className="text-sm text-muted-foreground">Cancel anytime.</p> : null}
      <p
        className={
          showCancel ? "mt-2 text-sm text-muted-foreground" : "text-sm text-muted-foreground"
        }
      >
        Essential ELCAMOSO stays free.
      </p>
    </section>
  );
}

function Pricing() {
  const yearly = getDrivePlusYearlyDisplay();
  const monthly = getDrivePlusMonthlyDisplay();
  const { plan } = useEntitlements();
  const [interval, setInterval] = useState<BillingDisplayInterval>("yearly");
  const billingQuery = useQuery({
    queryKey: ["billing-public-config"],
    queryFn: () => getBillingPublicConfigFn(),
    staleTime: 60_000,
  });
  const monetizationEnabled = billingQuery.data?.monetizationEnabled ?? false;
  const billingAvailable = billingQuery.data?.available ?? false;
  const hasDrivePlus = plan === "DRIVE_PLUS";
  const viewedRef = useRef(false);

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    trackMonetizationEvent("pricing_viewed", {
      source: "pricing",
      plan: hasDrivePlus ? "drive_plus" : "free",
    });
  }, [hasDrivePlus]);

  if (!monetizationEnabled) {
    return (
      <main className="min-h-screen">
        <section className="mx-auto w-full max-w-2xl px-6 pt-16 pb-10 sm:px-10 sm:pt-20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">Plans</p>
            <PlansBillingIntervalToggle value={interval} onChange={setInterval} />
          </div>
          <h1 className="mt-8 text-4xl leading-[1.06] font-light tracking-tight sm:text-5xl">
            Feel it.
            <br />
            Make every drive yours.
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
            Start with essential motion sound. Drive+ adds the full feel when billing opens.
          </p>
        </section>
        <section className="mx-auto w-full max-w-2xl px-6 sm:px-10">
          <PlansOverview
            monetizationEnabled={false}
            returnTo="/pricing"
            interval={interval}
            billingNoticeTone="danger"
          />
          <OpenDriveLink />
        </section>
        <PricingFooterNotes showCancel={false} />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <section className="mx-auto w-full max-w-2xl px-6 pt-16 pb-10 sm:px-10 sm:pt-20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">Plans</p>
          <PlansBillingIntervalToggle value={interval} onChange={setInterval} />
        </div>
        <h1 className="mt-8 text-4xl leading-[1.06] font-light tracking-tight sm:text-5xl">
          Feel it.
          <br />
          Make every drive yours.
        </h1>
        <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
          Start with essential motion sound. Add Drive+ when you want the full feel.
        </p>
      </section>

      <section className="mx-auto w-full max-w-2xl px-6 sm:px-10">
        <PlansOverview monetizationEnabled returnTo="/pricing" interval={interval} />
        <div className="mt-12 space-y-4 border-t border-border pt-12">
          {hasDrivePlus ? (
            <Link
              to="/settings"
              search={{ workspace: "plan" }}
              className="inline-flex h-14 items-center justify-center rounded-full bg-primary px-10 text-sm tracking-[0.22em] text-primary-foreground uppercase transition-opacity hover:opacity-90"
            >
              Manage plan
            </Link>
          ) : billingAvailable ? (
            <>
              <DrivePlusCheckoutButton
                interval="yearly"
                label="Drive+ · annual"
                source="pricing"
                className="inline-flex h-14 w-full items-center justify-center rounded-full bg-primary px-10 text-sm tracking-[0.22em] text-primary-foreground uppercase transition-opacity hover:opacity-90 sm:w-auto"
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                <DrivePlusCheckoutButton
                  interval="monthly"
                  label={`${monthly.amount} / month`}
                  source="pricing"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-foreground/20 px-6 text-[11px] tracking-[0.18em] text-foreground uppercase transition hover:border-foreground/40"
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-[#e53935]">
              Checkout opens when billing is enabled. Essential ELCAMOSO stays free.
            </p>
          )}
        </div>
        <OpenDriveLink />
      </section>

      <PricingFooterNotes />
    </main>
  );
}
