import { Link, useNavigate } from "@tanstack/react-router";

import { TryDynamicDriveButton } from "@/components/TryDynamicDriveButton";
import { useBillingAvailable, useMonetizationEnabled } from "@/lib/billing/use-billing-public-config";
import { getPremiumContext, type PremiumContext } from "@/lib/premium/contexts";
import { usePremiumPromptDismiss } from "@/lib/premium/use-premium-prompt-dismiss";
import { useSessionSelector } from "@/lib/store/session-store";
import { trackMonetizationEvent } from "@/lib/telemetry/monetization-analytics";

export type UpgradePromptVariant = "inline" | "compact" | "banner";

interface UpgradePromptProps {
  context: PremiumContext;
  /** Override default copy title — e.g. include a Sound Profile name. */
  title?: string;
  variant?: UpgradePromptVariant;
  /** When true, user cannot dismiss — use only when access is genuinely required. */
  required?: boolean;
  className?: string;
}

const VARIANT_CLASS: Record<UpgradePromptVariant, string> = {
  inline: "rounded-2xl border border-border/60 bg-card/40 p-4",
  compact: "rounded-xl border border-border/50 bg-card/30 px-4 py-3",
  banner: "border-y border-border/60 bg-card/20 px-4 py-4",
};

/** Benefit-first upgrade prompt — inline only, never full-screen. */
export function UpgradePrompt({
  context,
  title,
  variant = "inline",
  required = false,
  className = "",
}: UpgradePromptProps) {
  const copy = getPremiumContext(context);
  const cockpit = useSessionSelector((snap) => snap.cockpit);
  const navigate = useNavigate();
  const monetizationEnabled = useMonetizationEnabled();
  const billingAvailable = useBillingAvailable();
  const canDismiss = copy.dismissible && !required;
  const { dismissed, dismiss } = usePremiumPromptDismiss(context, canDismiss);

  function trackUpgrade(source: string) {
    trackMonetizationEvent("upgrade_clicked", {
      source,
      plan: "drive_plus",
      context,
    });
  }

  if (!monetizationEnabled) return null;

  if (canDismiss && dismissed) return null;

  return (
    <aside
      className={`${VARIANT_CLASS[variant]} ${className}`}
      aria-label={title ?? copy.title}
      role="note"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
            {copy.badge}
          </p>
          <p className="mt-2 text-sm font-light text-foreground">{title ?? copy.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.body}</p>
        </div>
        {canDismiss ? (
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 text-[10px] tracking-[0.18em] text-muted-foreground uppercase hover:text-foreground"
            aria-label="Dismiss"
          >
            Not now
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {context === "dynamic_drive" && billingAvailable ? (
          <TryDynamicDriveButton
            className="inline-flex h-10 items-center justify-center rounded-full border border-foreground/20 px-5 text-[10px] tracking-[0.18em] uppercase transition hover:border-foreground/40 disabled:opacity-50"
            label="Try preview"
            returnTo="/settings?workspace=advanced"
            source={`upgrade_prompt_${context}`}
          />
        ) : null}
        {billingAvailable && cockpit ? (
          <button
            type="button"
            onClick={() => {
              trackUpgrade("cockpit_upgrade_prompt");
              void navigate({
                to: "/drive",
                search: { cockpit: true, upgrade: "drive-plus" },
              });
            }}
            className="inline-flex h-10 items-center justify-center rounded-full border border-foreground/20 px-5 text-[10px] tracking-[0.18em] text-foreground uppercase transition hover:border-foreground/40"
          >
            Continue on phone
          </button>
        ) : billingAvailable ? (
          <Link
            to={copy.pricingHref}
            onClick={() => trackUpgrade(`upgrade_prompt_${context}`)}
            className="inline-flex h-10 items-center justify-center rounded-full border border-foreground/20 px-5 text-[10px] tracking-[0.18em] text-foreground uppercase transition hover:border-foreground/40"
          >
            {copy.ctaLabel}
          </Link>
        ) : null}
      </div>

      {copy.footnote ? (
        <p className="mt-3 text-xs text-muted-foreground">{copy.footnote}</p>
      ) : null}
    </aside>
  );
}
