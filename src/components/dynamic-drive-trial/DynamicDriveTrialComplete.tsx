import { DrivePlusCheckoutButton } from "@/components/DrivePlusCheckoutButton";
import { useMonetizationEnabled } from "@/lib/billing/use-billing-public-config";
import { getDrivePlusMonthlyDisplay, getDrivePlusYearlyDisplay } from "@/lib/billing/plan-display";
import { dismissDynamicDriveTrialComplete } from "@/lib/dynamic-drive-trial/trial-ui-store";
import { useDynamicDriveTrialUi } from "@/lib/dynamic-drive-trial/use-dynamic-drive-trial-ui";

const CONTINUE_FEATURES = [
  "Virtual shifts",
  "Live rev",
  "Rev matching",
  "Motion-matched load",
] as const;

interface DynamicDriveTrialCompleteProps {
  className?: string;
}

/** Shown after preview exhausts - drive continues with essential motion sound. */
export function DynamicDriveTrialComplete({ className = "" }: DynamicDriveTrialCompleteProps) {
  const { showComplete } = useDynamicDriveTrialUi();
  const monetizationEnabled = useMonetizationEnabled();
  const yearly = getDrivePlusYearlyDisplay();
  const monthly = getDrivePlusMonthlyDisplay();

  if (!showComplete || !monetizationEnabled) return null;

  return (
    <aside
      className={`w-full max-w-lg rounded-2xl border border-border/60 bg-card/40 p-6 text-left ${className}`}
      aria-live="polite"
    >
      <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">
        Preview complete
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        Your drive continues with essential motion sound.
      </p>
      <p className="mt-6 text-sm text-foreground">With Drive+, you keep:</p>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {CONTINUE_FEATURES.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <div className="mt-8 space-y-3">
        <DrivePlusCheckoutButton
          interval="yearly"
          label={`Drive+ · ${yearly.amount} / year`}
          source="trial_complete"
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-[10px] tracking-[0.18em] text-primary-foreground uppercase"
          returnTo="/drive"
        />
        <DrivePlusCheckoutButton
          interval="monthly"
          label={`${monthly.amount} / month`}
          source="trial_complete"
          className="inline-flex h-10 w-full items-center justify-center rounded-full border border-foreground/20 px-6 text-[10px] tracking-[0.16em] uppercase"
          returnTo="/drive"
        />
      </div>
      <button
        type="button"
        onClick={dismissDynamicDriveTrialComplete}
        className="mt-6 text-[10px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
      >
        Continue driving
      </button>
    </aside>
  );
}
