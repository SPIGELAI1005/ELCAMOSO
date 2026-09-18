import { formatTrialRemainingMinutes } from "@/lib/dynamic-drive-trial/display";
import { useDynamicDriveTrialUi } from "@/lib/dynamic-drive-trial/use-dynamic-drive-trial-ui";
import { useEntitlements } from "@/lib/entitlements/useEntitlements";

interface DynamicDriveTrialDuringDriveProps {
  dynamicDriveActive: boolean;
  safetyMode?: boolean;
}

/** Subtle in-drive preview status - no pricing nudges while driving. */
export function DynamicDriveTrialDuringDrive({
  dynamicDriveActive,
  safetyMode = false,
}: DynamicDriveTrialDuringDriveProps) {
  const { isTrialActive } = useEntitlements();
  const { snapshot } = useDynamicDriveTrialUi();

  if (!isTrialActive || !dynamicDriveActive || !snapshot) return null;
  if (!snapshot.canUseDynamicDrive && snapshot.remainingSeconds <= 0) return null;

  return (
    <div
      className={`w-full max-w-lg text-center ${safetyMode ? "mt-2" : "mt-4"}`}
      aria-live="polite"
    >
      <p className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
        Dynamic Drive preview · {formatTrialRemainingMinutes(snapshot.remainingSeconds)}
      </p>
    </div>
  );
}
