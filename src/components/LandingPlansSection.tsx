import { useState } from "react";
import { Link } from "@tanstack/react-router";

import { DynamicDriveTrialOffer } from "@/components/dynamic-drive-trial/DynamicDriveTrialOffer";
import { useMonetizationEnabled } from "@/lib/billing/use-billing-public-config";
import {
  DRIVE_MUSIC_FEATURES,
  DRIVE_PLUS_FEATURES,
  FREE_PLAN_FEATURES,
  getDriveMusicDisplay,
  getDrivePlusDisplay,
  getDrivePlusLifetimeDisplay,
  getFreePlanDisplay,
  type BillingDisplayInterval,
} from "@/lib/billing/plan-display";
import {
  BLACK_FRIDAY_LABEL,
  MUSIC_TRIAL_MONTHS,
  isMusicTrialOfferActive,
} from "@/lib/billing/black-friday";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/drive/useSettings";
import { t } from "@/lib/i18n";

interface PlansOverviewProps {
  /** When false, show prices and features only - no checkout or trial activation. */
  monetizationEnabled: boolean;
  compact?: boolean;
  returnTo?: string;
  interval?: BillingDisplayInterval;
  /** When "danger", billing-disabled notice uses red (pricing page). */
  billingNoticeTone?: "muted" | "danger";
}

function StrikethroughPrice({ amount, className }: { amount: string; className?: string }) {
  return (
    <span className={cn("relative w-fit text-muted-foreground", className)}>
      {amount}
      <span
        aria-hidden
        className="pointer-events-none absolute top-[52%] left-0 h-[2px] w-full -translate-y-1/2 bg-[#e53935]"
      />
    </span>
  );
}

function PlanPrice({
  listAmount,
  amount,
  suffix,
  size = "large",
  badge,
}: {
  listAmount: string;
  amount: string;
  suffix?: string;
  size?: "large" | "compact";
  /** e.g. "-14%" next to the struck-through full price. */
  badge?: string;
}) {
  const priceClass = size === "compact" ? "text-2xl" : "text-3xl";
  const listClass = size === "compact" ? "text-lg" : "text-xl";

  return (
    <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <StrikethroughPrice amount={listAmount} className={listClass} />
      <p className={`font-light ${priceClass}`}>
        {amount}
        {suffix ? (
          <span className={`text-muted-foreground ${size === "compact" ? "text-base" : "text-lg"}`}>
            {" "}
            {suffix}
          </span>
        ) : null}
      </p>
      {badge ? (
        <span
          className="self-center rounded-full bg-[#e53935] px-2 py-0.5 text-[11px] font-medium tracking-[0.08em] text-white"
          data-testid="discount-badge"
        >
          {badge}
        </span>
      ) : null}
    </div>
  );
}

export function PlansBillingIntervalToggle({
  value,
  onChange,
  className,
}: {
  value: BillingDisplayInterval;
  onChange: (value: BillingDisplayInterval) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-end gap-2", className)}>
      <div
        role="group"
        aria-label="Billing interval"
        className="inline-flex rounded-full border border-border p-0.5"
      >
        {(
          [
            { id: "monthly" as const, label: "Monthly" },
            { id: "yearly" as const, label: "Yearly" },
          ] as const
        ).map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.id)}
              className={cn(
                "h-8 rounded-full px-3.5 text-[10px] tracking-[0.16em] uppercase transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-[#e53935]">Limited offer for early adopters.</p>
    </div>
  );
}

/** Informational Free / Drive+ pricing - checkout gated separately. */
export function PlansOverview({
  monetizationEnabled,
  compact = false,
  returnTo = "/",
  interval = "yearly",
  billingNoticeTone = "muted",
}: PlansOverviewProps) {
  const free = getFreePlanDisplay();
  const drivePlus = getDrivePlusDisplay(interval);
  const drivePlusSuffix = interval === "monthly" ? "/ month" : "/ year";
  const lifetime = getDrivePlusLifetimeDisplay();
  const music = getDriveMusicDisplay(interval);
  const musicYearly = getDriveMusicDisplay("yearly");
  const musicTrial = isMusicTrialOfferActive();
  const { settings } = useSettings();
  const language = settings.language;

  return (
    <>
      <div className="divide-y divide-border border-y border-border">
        <div className={compact ? "py-8" : "border-b border-border py-12"}>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Free</p>
          <p className="mt-3 text-2xl font-light">Feel it.</p>
          <PlanPrice
            listAmount={free.listAmount}
            amount={free.amount}
            size={compact ? "compact" : "large"}
          />
          <p className="mt-2 text-xs tracking-[0.12em] text-muted-foreground uppercase">
            Discount for early adopters
          </p>
          <ul className={`space-y-3 text-sm text-muted-foreground ${compact ? "mt-4" : "mt-8"}`}>
            {(compact ? FREE_PLAN_FEATURES.slice(0, 2) : FREE_PLAN_FEATURES).map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          {!compact ? (
            <p className="mt-4 text-sm text-muted-foreground">
              A complete first journey from motion to music. No card required.
            </p>
          ) : null}
        </div>
        <div className={compact ? "py-8" : "py-12"} data-testid="plan-drive-plus">
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Drive+</p>
          <p className="mt-3 text-2xl font-light">Every engine sound.</p>
          <PlanPrice
            listAmount={drivePlus.listAmount}
            amount={drivePlus.amount}
            suffix={drivePlusSuffix}
            size={compact ? "compact" : "large"}
            badge="-14%"
          />
          <p className="mt-2 text-xs tracking-[0.12em] text-muted-foreground uppercase">
            14% off for early adopters
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {interval === "monthly"
              ? `Billed yearly at ${getDrivePlusDisplay("yearly").amount}`
              : `${drivePlus.equivalentMonthly} per month, billed yearly`}
          </p>
          <ul className={`space-y-3 text-sm text-muted-foreground ${compact ? "mt-4" : "mt-10"}`}>
            {(compact ? DRIVE_PLUS_FEATURES.slice(0, 3) : DRIVE_PLUS_FEATURES).map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          {!monetizationEnabled ? (
            <p
              className={cn(
                "mt-6 text-sm",
                billingNoticeTone === "danger" ? "text-[#e53935]" : "text-muted-foreground",
              )}
            >
              Drive+ and individual sound purchases open on 9.11.2026. Until then, ELCAMOSO is free of charge.
            </p>
          ) : null}
        </div>
        <div className={compact ? "py-8" : "py-12"} data-testid="plan-drive-music">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
              Drive the Music
            </p>
            {musicTrial ? (
              <span
                className="rounded-full border border-[#e53935] px-2.5 py-0.5 text-[10px] tracking-[0.16em] text-[#e53935] uppercase"
                data-testid="music-trial-badge"
              >
                Black Friday · {MUSIC_TRIAL_MONTHS} months free
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-2xl font-light">Every music profile.</p>
          <PlanPrice
            listAmount={music.listAmount}
            amount={music.amount}
            suffix={drivePlusSuffix}
            size={compact ? "compact" : "large"}
            badge="-14%"
          />
          <p className="mt-2 text-xs tracking-[0.12em] text-muted-foreground uppercase">
            14% off for early adopters
          </p>
          {musicTrial ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Start before {BLACK_FRIDAY_LABEL} and the first {MUSIC_TRIAL_MONTHS} months are free.
              Then {musicYearly.amount} per year, billed yearly. Cancel anytime during the trial.
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {interval === "monthly"
                ? `Billed yearly at ${musicYearly.amount}`
                : `${musicYearly.equivalentMonthly} per month, billed yearly`}
            </p>
          )}
          <ul className={`space-y-3 text-sm text-muted-foreground ${compact ? "mt-4" : "mt-10"}`}>
            {(compact ? DRIVE_MUSIC_FEATURES.slice(0, 3) : DRIVE_MUSIC_FEATURES).map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </div>
        <div className={compact ? "py-8" : "py-12"} data-testid="plan-lifetime">
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            {t(language, "pricing.lifetimeLabel")}
          </p>
          <p className="mt-3 text-2xl font-light">{t(language, "pricing.lifetimeTagline")}</p>
          <PlanPrice
            listAmount={lifetime.listAmount}
            amount={lifetime.amount}
            suffix={t(language, "pricing.lifetimeOnce")}
            size={compact ? "compact" : "large"}
            badge="-14%"
          />
          <p className="mt-2 text-xs tracking-[0.12em] text-muted-foreground uppercase">
            {t(language, "pricing.lifetimeDiscount")}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">{t(language, "pricing.lifetimeBody")}</p>
          <p className="mt-3 text-sm text-[#e53935]" data-testid="lifetime-payback">
            Pays for itself in under 2 years, then it&apos;s free forever.
          </p>
        </div>
      </div>
      {monetizationEnabled ? (
        <div className={`flex flex-col items-start gap-4 ${compact ? "mt-10" : "mt-10"}`}>
          <DynamicDriveTrialOffer returnTo={returnTo} />
        </div>
      ) : null}
    </>
  );
}

export function LandingPlansSection() {
  const monetizationEnabled = useMonetizationEnabled();
  const [interval, setInterval] = useState<BillingDisplayInterval>("yearly");

  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-3xl font-light">Plans</h2>
        <PlansBillingIntervalToggle value={interval} onChange={setInterval} />
      </div>
      <div className="mt-10">
        <PlansOverview
          monetizationEnabled={monetizationEnabled}
          compact
          returnTo="/"
          interval={interval}
          billingNoticeTone="danger"
        />
      </div>
      <Link
        to="/pricing"
        className="mt-8 inline-block text-[11px] tracking-[0.24em] text-muted-foreground uppercase hover:text-foreground"
      >
        See plans
      </Link>
    </section>
  );
}
