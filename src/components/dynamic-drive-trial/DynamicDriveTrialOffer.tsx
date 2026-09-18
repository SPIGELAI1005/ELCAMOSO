import { useEffect, useRef } from "react";

import { TryDynamicDriveButton } from "@/components/TryDynamicDriveButton";
import { useMonetizationEnabled } from "@/lib/billing/use-billing-public-config";
import { TRIAL_OFFER_POINTS } from "@/lib/dynamic-drive-trial/display";
import { trackMonetizationEvent } from "@/lib/telemetry/monetization-analytics";

interface DynamicDriveTrialOfferProps {
  className?: string;
  returnTo?: string;
  compact?: boolean;
  source?: string;
}

/** Pre-trial CTA - brief terms, no card required. */
export function DynamicDriveTrialOffer({
  className = "",
  returnTo,
  compact = false,
  source = "trial_offer",
}: DynamicDriveTrialOfferProps) {
  const monetizationEnabled = useMonetizationEnabled();
  const offeredRef = useRef(false);

  useEffect(() => {
    if (!monetizationEnabled || offeredRef.current) return;
    offeredRef.current = true;
    trackMonetizationEvent("dynamic_trial_offered", {
      source,
      plan: "free",
    });
  }, [monetizationEnabled, source]);

  if (!monetizationEnabled) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      {!compact ? (
        <div>
          <p className="text-sm font-light text-foreground">Dynamic Drive preview</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Motion-matched gears and response - free with a saved account.
          </p>
        </div>
      ) : null}
      <TryDynamicDriveButton
        {...(returnTo ? { returnTo } : {})}
        label="Try Dynamic Drive"
        source={source}
      />
      <ul className="space-y-1 text-sm text-muted-foreground">
        {TRIAL_OFFER_POINTS.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </div>
  );
}
