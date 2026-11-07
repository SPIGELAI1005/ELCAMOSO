import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { DrivePlusCheckoutButton } from "@/components/DrivePlusCheckoutButton";
import { useBillingPublicConfig } from "@/lib/billing/use-billing-public-config";
import { MUSIC_TRIAL_MONTHS, isMusicTrialOfferActive } from "@/lib/billing/black-friday";
import type { BillingDisplayInterval } from "@/lib/billing/plan-display";
import { useEntitlements } from "@/lib/entitlements/useEntitlements";
import { useSettings } from "@/lib/drive/useSettings";
import { t } from "@/lib/i18n";

export interface PlanPurchaseActions {
  free?: ReactNode;
  drivePlus?: ReactNode;
  music?: ReactNode;
  unlimited?: ReactNode;
  lifetime?: ReactNode;
}

const purchaseButtonClass =
  "mt-8 inline-flex h-12 w-full items-center justify-center rounded-full bg-primary px-8 text-[11px] tracking-[0.2em] text-primary-foreground uppercase transition-opacity hover:opacity-90 sm:w-auto";

const openDriveClass =
  "mt-8 inline-flex h-12 min-w-[11.5rem] items-center justify-center rounded-full border border-foreground/20 px-8 text-[11px] tracking-[0.2em] text-foreground uppercase transition hover:border-foreground/40";

function OpenDriveInPlan() {
  return (
    <Link to="/drive" className={openDriveClass}>
      Open Drive
    </Link>
  );
}

function ManagePlanLink() {
  return (
    <Link to="/settings" search={{ workspace: "plan" }} className={purchaseButtonClass}>
      Manage plan
    </Link>
  );
}

function PackageNotReady() {
  return (
    <p className="mt-8 text-sm text-muted-foreground">Checkout for this package is not connected yet.</p>
  );
}

/** Purchase controls for each plan card. Absent while purchases are switched off. */
export function usePlanPurchaseActions(
  interval: BillingDisplayInterval,
  source: string,
): PlanPurchaseActions | undefined {
  const billingQuery = useBillingPublicConfig();
  const { plan } = useEntitlements();
  const { settings } = useSettings();
  const monetizationEnabled = billingQuery.data?.monetizationEnabled ?? false;
  const billingAvailable = billingQuery.data?.available ?? false;
  const lifetimeAvailable = billingQuery.data?.lifetimeAvailable ?? false;
  const hasPaidPlan = plan !== "FREE";
  const musicReady =
    interval === "monthly"
      ? (billingQuery.data?.musicMonthlyAvailable ?? billingQuery.data?.musicAvailable ?? false)
      : (billingQuery.data?.musicYearlyAvailable ?? billingQuery.data?.musicAvailable ?? false);
  const unlimitedReady =
    interval === "monthly"
      ? (billingQuery.data?.unlimitedMonthlyAvailable ??
        billingQuery.data?.unlimitedAvailable ??
        false)
      : (billingQuery.data?.unlimitedYearlyAvailable ??
        billingQuery.data?.unlimitedAvailable ??
        false);

  if (!monetizationEnabled) return undefined;

  return {
    free: <OpenDriveInPlan />,
    drivePlus: hasPaidPlan ? (
      <ManagePlanLink />
    ) : billingAvailable ? (
      <DrivePlusCheckoutButton
        interval={interval}
        label={interval === "monthly" ? "Drive+ · monthly" : "Drive+ · annual"}
        source={source}
        className={purchaseButtonClass}
      />
    ) : null,
    music: hasPaidPlan ? null : billingAvailable ? (
      musicReady ? (
        <DrivePlusCheckoutButton
          plan="drive_music"
          interval={interval}
          label={
            isMusicTrialOfferActive()
              ? `Drive the Music · ${MUSIC_TRIAL_MONTHS} months free`
              : interval === "monthly"
                ? "Drive the Music · monthly"
                : "Drive the Music · annual"
          }
          source={source}
          className={purchaseButtonClass}
        />
      ) : (
        <PackageNotReady />
      )
    ) : null,
    unlimited: hasPaidPlan ? null : billingAvailable ? (
      unlimitedReady ? (
        <DrivePlusCheckoutButton
          plan="drive_unlimited"
          interval={interval}
          label={
            interval === "monthly" ? "Drive Unlimited · monthly" : "Drive Unlimited · annual"
          }
          source={source}
          className={purchaseButtonClass}
        />
      ) : (
        <PackageNotReady />
      )
    ) : null,
    lifetime: hasPaidPlan ? null : billingAvailable ? (
      lifetimeAvailable ? (
        <div className="w-full">
          <DrivePlusCheckoutButton
            interval="lifetime"
            label={t(settings.language, "pricing.lifetimeCta")}
            source={source}
            className={purchaseButtonClass}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            {t(settings.language, "pricing.lifetimeSubscriptionNote")}
          </p>
        </div>
      ) : (
        <PackageNotReady />
      )
    ) : null,
  };
}
