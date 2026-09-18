import { useEffect, useRef } from "react";

import { claimDynamicDriveSessionFn } from "@/lib/dynamic-drive-session/server-fns";
import { showDynamicDriveSessionConflict } from "@/lib/dynamic-drive-session/session-ui-store";
import { readClientRelaySessionId } from "@/lib/dynamic-drive-session/client-relay-id";
import {
  markDynamicDriveTrialExhaustedPending,
  setDynamicDriveTrialSnapshot,
  showDynamicDriveTrialComplete,
} from "@/lib/dynamic-drive-trial/trial-ui-store";
import { DYNAMIC_DRIVE_TRIAL_HEARTBEAT_INTERVAL_MS } from "@/lib/dynamic-drive-trial/config";
import { readClientDriveSessionId } from "@/lib/tesla-upgrade/drive-session-id";
import {
  endDynamicDriveTrialSessionFn,
  getDynamicDriveTrialStatusFn,
  heartbeatDynamicDriveTrialFn,
  startDynamicDriveTrialSessionFn,
} from "@/lib/dynamic-drive-trial/server-fns";
import { deferSettingsClampUntilDriveEnds } from "@/lib/entitlements/live-drive-access";
import { useAccount } from "@/lib/account/AccountProvider";
import { useSettings } from "@/lib/drive/useSettings";
import { useSessionSelector } from "@/lib/store/session-store";
import { isLiveSessionStatus } from "@/lib/ui/chrome";
import { trackMonetizationEvent } from "@/lib/telemetry/monetization-analytics";

function readDriveSessionId(): string {
  return readClientDriveSessionId();
}

function applyTrialExhaustion(
  update: ReturnType<typeof useSettings>["update"],
  dynamicDriveEnabled: boolean,
  liveDrive: boolean,
): void {
  const clamp = () => {
    if (dynamicDriveEnabled) update({ dynamicDrive: false });
    trackMonetizationEvent("dynamic_trial_exhausted", {
      source: "drive",
      plan: "free",
    });
    showDynamicDriveTrialComplete();
  };

  markDynamicDriveTrialExhaustedPending();
  if (liveDrive && dynamicDriveEnabled) {
    deferSettingsClampUntilDriveEnds(clamp);
    return;
  }
  clamp();
}

/** Server-authoritative Dynamic Drive trial usage while driving. */
export function DynamicDriveTrialBridge() {
  const { isAuthenticated } = useAccount();
  const { settings, update } = useSettings();
  const drive = useSessionSelector((snap) => ({
    kind: snap.kind,
    status: snap.status,
  }));
  const startedRef = useRef(false);
  const driveSessionIdRef = useRef<string>("");
  const wasLiveDriveRef = useRef(false);

  const trialActive =
    isAuthenticated && settings.dynamicDriveTrialActivated && !settings.dynamicDriveTrialConverted;
  const liveDrive = drive.kind === "drive" && isLiveSessionStatus(drive.status);
  const driving = drive.kind === "drive" && drive.status === "running";

  useEffect(() => {
    if (liveDrive && !wasLiveDriveRef.current) {
      wasLiveDriveRef.current = true;
    }
    if (!liveDrive && wasLiveDriveRef.current) {
      wasLiveDriveRef.current = false;
      if (settings.dynamicDrive && !settings.dynamicDriveTrialConverted) {
        /* defer callback may run here via endLiveDriveAccess */
      }
    }
  }, [liveDrive, settings.dynamicDrive, settings.dynamicDriveTrialConverted]);

  useEffect(() => {
    if (!trialActive) {
      setDynamicDriveTrialSnapshot(null);
      return;
    }
    void getDynamicDriveTrialStatusFn({ data: { sessionToken: null } }).then(
      setDynamicDriveTrialSnapshot,
    );
  }, [trialActive]);

  useEffect(() => {
    if (!trialActive) return;
    if (!driving || !settings.dynamicDrive) {
      if (startedRef.current && driveSessionIdRef.current) {
        const driveSessionId = driveSessionIdRef.current;
        startedRef.current = false;
        void endDynamicDriveTrialSessionFn({
          data: {
            sessionToken: null,
            driveSessionId,
            dynamicDriveEnabled: settings.dynamicDrive,
          },
        }).then((result) => {
          setDynamicDriveTrialSnapshot(result.snapshot);
          trackMonetizationEvent("dynamic_trial_session_completed", {
            source: "drive",
            plan: "free",
          });
          if (!result.snapshot.canUseDynamicDrive && settings.dynamicDrive) {
            applyTrialExhaustion(update, settings.dynamicDrive, liveDrive);
          }
        });
      }
      return;
    }

    const driveSessionId = readDriveSessionId();
    driveSessionIdRef.current = driveSessionId;

    if (!startedRef.current) {
      startedRef.current = true;
      void claimDynamicDriveSessionFn({
        data: {
          sessionToken: null,
          driveSessionId,
          relaySessionId: readClientRelaySessionId(),
        },
      })
        .then((claim) => {
          if (!claim.ok) {
            startedRef.current = false;
            showDynamicDriveSessionConflict(claim.message);
            update({ dynamicDrive: false });
            return null;
          }
          return startDynamicDriveTrialSessionFn({
            data: { sessionToken: null, driveSessionId },
          });
        })
        .then((result) => {
          if (result) {
            trackMonetizationEvent("dynamic_trial_session_started", {
              source: "drive",
              plan: "free",
            });
            setDynamicDriveTrialSnapshot(result.snapshot);
          }
        })
        .catch(() => {
          startedRef.current = false;
          update({ dynamicDrive: false });
        });
    }

    const timer = window.setInterval(() => {
      void heartbeatDynamicDriveTrialFn({
        data: {
          sessionToken: null,
          driveSessionId,
          dynamicDriveEnabled: settings.dynamicDrive,
        },
      }).then((result) => {
        setDynamicDriveTrialSnapshot(result.snapshot);
        if (!result.snapshot.canUseDynamicDrive && settings.dynamicDrive) {
          applyTrialExhaustion(update, settings.dynamicDrive, liveDrive);
        }
      });
    }, DYNAMIC_DRIVE_TRIAL_HEARTBEAT_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [driving, liveDrive, settings.dynamicDrive, trialActive, update]);

  return null;
}
