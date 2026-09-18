import { useEffect, useState } from "react";

import { DynamicDriveTrialOffer } from "@/components/dynamic-drive-trial/DynamicDriveTrialOffer";
import { useAccount } from "@/lib/account/AccountProvider";
import { useMonetizationEnabled } from "@/lib/billing/use-billing-public-config";
import { formatTrialRemainingMinutes } from "@/lib/dynamic-drive-trial/display";
import { getDynamicDriveTrialStatusFn } from "@/lib/dynamic-drive-trial/server-fns";
import type { DynamicDriveTrialSnapshot } from "@/lib/dynamic-drive-trial/types";
import type { ElcamosoSettings } from "@/lib/drive/settings";

interface DynamicDriveTrialSettingsProps {
  settings: ElcamosoSettings;
}

/** Trial status in Settings - offer, active preview, or exhausted note. */
export function DynamicDriveTrialSettings({ settings }: DynamicDriveTrialSettingsProps) {
  const monetizationEnabled = useMonetizationEnabled();
  const { isAuthenticated } = useAccount();
  const [snapshot, setSnapshot] = useState<DynamicDriveTrialSnapshot | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !settings.dynamicDriveTrialActivated) return;
    void getDynamicDriveTrialStatusFn({ data: { sessionToken: null } }).then(setSnapshot);
  }, [isAuthenticated, settings.dynamicDriveTrialActivated]);

  if (!monetizationEnabled || settings.dynamicDriveTrialConverted) return null;

  if (!settings.dynamicDriveTrialActivated) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
        <DynamicDriveTrialOffer returnTo="/settings?workspace=advanced" />
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-2xl border border-border/60 bg-card/40 p-4">
      <p className="text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
        Dynamic Drive preview
      </p>
      {snapshot ? (
        <p className="text-sm text-muted-foreground">
          {snapshot.canUseDynamicDrive
            ? `${formatTrialRemainingMinutes(snapshot.remainingSeconds)} · ${snapshot.remainingSessions} drive${snapshot.remainingSessions === 1 ? "" : "s"} left`
            : "Preview complete · essential Drive continues."}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Preview active while you drive.</p>
      )}
    </div>
  );
}
