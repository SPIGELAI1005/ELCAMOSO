import { createFileRoute, Link } from "@tanstack/react-router";
import { createSeoHeadFromPath } from "@/lib/seo";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { PlansBillingIntervalToggle, PlansOverview } from "@/components/LandingPlansSection";
import { usePlanPurchaseActions } from "@/components/pricing/plan-purchase-actions";
import { getBillingPublicConfigFn } from "@/lib/billing/public-config-server-fn";
import type { BillingDisplayInterval } from "@/lib/billing/plan-display";
import { useEntitlements } from "@/lib/entitlements/useEntitlements";
import { trackMonetizationEvent } from "@/lib/telemetry/monetization-analytics";
import { useSettings } from "@/lib/drive/useSettings";
import { t } from "@/lib/i18n";
import { SoundPackageCallout } from "@/components/pricing/SoundPackageCallout";
import { parsePricingPlanParam, parseSharedSoundParam, type SoundPackage } from "@/lib/drive/sound-share";
import type { BillingPublicConfig } from "@/lib/billing/public-config";

function missingCheckoutSettings(
  requirements: BillingPublicConfig["checkoutRequirements"] | undefined,
): string[] {
  if (!requirements) return [];
  const missing: string[] = [];
  if (!requirements.secretKey) missing.push("Stripe secret key");
  if (!requirements.webhookSecret) missing.push("webhook signing secret");
  if (!requirements.drivePlusMonthly) missing.push("Drive+ monthly price");
  if (!requirements.drivePlusYearly) missing.push("Drive+ yearly price");
  return missing;
}

export const Route = createFileRoute("/pricing")({
  component: Pricing,
  validateSearch: (search: Record<string, unknown>): { plan?: SoundPackage | undefined; sound?: string | undefined } => ({
    plan: parsePricingPlanParam(search["plan"]),
    sound: parseSharedSoundParam(search["sound"]) ?? undefined,
  }),
  head: () => createSeoHeadFromPath("/pricing"),
});


function EarlyAccessBanner() {
  const { settings } = useSettings();
  const language = settings.language;
  return (
    <aside
      className="mx-auto w-full max-w-2xl px-6 pt-10 sm:px-10"
      role="status"
      data-testid="early-access-banner"
    >
      <div className="rounded-2xl border border-border bg-muted/40 px-5 py-5 sm:px-6 sm:py-6">
        <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">
          Early access
        </p>
        <h2 className="mt-3 text-xl font-light tracking-tight sm:text-2xl">
          {t(language, "pricing.earlyAccessTitle")}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t(language, "pricing.earlyAccessBody")}
        </p>
        <div className="mt-6 border-l-2 border-[#e53935] pl-4">
          <p className="text-[10px] tracking-[0.3em] text-[#e53935] uppercase">Founders Pack</p>
          <h3 className="mt-2 text-lg font-light tracking-tight">{t(language, "pricing.founders.title")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{t(language, "pricing.founders.body")}</p>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {(["perk1", "perk2", "perk3", "perk4"] as const).map((k) => (
              <li key={k}>
                <span className="text-[#e53935]">—</span> {t(language, `pricing.founders.${k}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}

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
        Racing V10, American Muscle V8, Dracula Carriage and Latino Fiesta are free. Every other
        engine sound is Drive+, every other music profile is Drive the Music. Drive Unlimited and
        Lifetime include both.
      </p>
    </section>
  );
}

function Pricing() {
  const { plan } = useEntitlements();
  const { plan: highlightPlan, sound: highlightSound } = Route.useSearch();
  const [interval, setInterval] = useState<BillingDisplayInterval>("monthly");
  const purchaseActions = usePlanPurchaseActions(interval, "pricing");
  const billingQuery = useQuery({
    queryKey: ["billing-public-config"],
    queryFn: () => getBillingPublicConfigFn(),
    staleTime: 60_000,
  });
  const monetizationEnabled = billingQuery.data?.monetizationEnabled ?? false;
  const billingAvailable = billingQuery.data?.available ?? false;
  const lifetimeAvailable = billingQuery.data?.lifetimeAvailable ?? false;
  const hasDrivePlus = plan !== "FREE";
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
        <EarlyAccessBanner />
        {highlightPlan ? (
          <SoundPackageCallout
            plan={highlightPlan}
            sound={highlightSound}
            billingAvailable={false}
            lifetimeAvailable={lifetimeAvailable}
          />
        ) : null}
        <section className="mx-auto w-full max-w-2xl px-6 pt-10 pb-10 sm:px-10 sm:pt-12">
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
            Start with essential motion sound — free during early access.{" "}
            <span className="font-medium text-red-500">All purchases (Drive+, Drive the Music, Drive Unlimited, Lifetime and individual sounds) open on 9.11.2026.</span>
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
      <EarlyAccessBanner />
      {highlightPlan ? (
        <SoundPackageCallout
          plan={highlightPlan}
          sound={highlightSound}
          billingAvailable={billingAvailable}
          lifetimeAvailable={lifetimeAvailable}
        />
      ) : null}
      <section className="mx-auto w-full max-w-2xl px-6 pt-10 pb-10 sm:px-10 sm:pt-12">
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
          Start with essential motion sound. VAT is added at checkout.
        </p>
      </section>

      <section className="mx-auto w-full max-w-2xl px-6 sm:px-10">
        <PlansOverview
          monetizationEnabled
          returnTo="/pricing"
          interval={interval}
          purchaseActions={purchaseActions}
        />
        {!hasDrivePlus && !billingAvailable ? (
          <p className="mt-8 text-sm text-muted-foreground">
            Purchase buttons need the live Stripe settings on the server.
            {missingCheckoutSettings(billingQuery.data?.checkoutRequirements).length
              ? ` Missing: ${missingCheckoutSettings(billingQuery.data?.checkoutRequirements).join(", ")}.`
              : null}
          </p>
        ) : null}
      </section>

      <PricingFooterNotes />
    </main>
  );
}
