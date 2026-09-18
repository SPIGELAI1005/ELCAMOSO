import { useEffect, useRef } from "react";

import { DYNAMIC_DRIVE_SESSION_HEARTBEAT_INTERVAL_MS } from "@/lib/dynamic-drive-session/config";
import { readClientRelaySessionId } from "@/lib/dynamic-drive-session/client-relay-id";
import {
  claimDynamicDriveSessionFn,
  heartbeatDynamicDriveSessionFn,
  releaseDynamicDriveSessionFn,
} from "@/lib/dynamic-drive-session/server-fns";
import {
  clearDynamicDriveSessionConflict,
  showDynamicDriveSessionConflict,
} from "@/lib/dynamic-drive-session/session-ui-store";
import { readClientDriveSessionId } from "@/lib/tesla-upgrade/drive-session-id";
import { useAccount } from "@/lib/account/AccountProvider";
import { useFeatureAccess } from "@/lib/entitlements/selectors";
import { useSettings } from "@/lib/drive/useSettings";
import { useSessionSelector } from "@/lib/store/session-store";
import { isLiveSessionStatus } from "@/lib/ui/chrome";

function readDriveSessionId(): string {
  return readClientDriveSessionId();
}

/**
 * One account / one active Dynamic Drive session.
 * Phone + Tesla paired in one tab share the same driveSessionId lease.
 * Basic Drive without Dynamic Drive never touches this bridge.
 */
export function DynamicDriveSessionBridge() {
  const { isAuthenticated } = useAccount();
  const { settings, update } = useSettings();
  const { dynamicDrive: entitledToDynamicDrive } = useFeatureAccess();
  const drive = useSessionSelector((snap) => ({
    kind: snap.kind,
    status: snap.status,
  }));

  const claimedRef = useRef(false);
  const driveSessionIdRef = useRef("");

  const liveDrive = drive.kind === "drive" && isLiveSessionStatus(drive.status);
  const driving = drive.kind === "drive" && drive.status === "running";
  const shouldLease = isAuthenticated && entitledToDynamicDrive && settings.dynamicDrive && driving;

  useEffect(() => {
    if (!isAuthenticated || !entitledToDynamicDrive) {
      clearDynamicDriveSessionConflict();
    }
  }, [isAuthenticated, entitledToDynamicDrive]);

  useEffect(() => {
    if (!shouldLease) {
      if (claimedRef.current && driveSessionIdRef.current && isAuthenticated) {
        const driveSessionId = driveSessionIdRef.current;
        claimedRef.current = false;
        void releaseDynamicDriveSessionFn({
          data: { sessionToken: null, driveSessionId },
        });
      }
      return;
    }

    const driveSessionId = readDriveSessionId();
    driveSessionIdRef.current = driveSessionId;
    const relaySessionId = readClientRelaySessionId();

    if (!claimedRef.current) {
      claimedRef.current = true;
      void claimDynamicDriveSessionFn({
        data: { sessionToken: null, driveSessionId, relaySessionId },
      })
        .then((result) => {
          if (!result.ok) {
            claimedRef.current = false;
            showDynamicDriveSessionConflict(result.message);
            if (settings.dynamicDrive) update({ dynamicDrive: false });
            return;
          }
          clearDynamicDriveSessionConflict();
        })
        .catch(() => {
          claimedRef.current = false;
          if (settings.dynamicDrive) update({ dynamicDrive: false });
        });
    }

    const timer = window.setInterval(() => {
      void heartbeatDynamicDriveSessionFn({
        data: {
          sessionToken: null,
          driveSessionId,
          relaySessionId: readClientRelaySessionId(),
        },
      }).catch(() => {
        claimedRef.current = false;
        if (settings.dynamicDrive) update({ dynamicDrive: false });
      });
    }, DYNAMIC_DRIVE_SESSION_HEARTBEAT_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [shouldLease, isAuthenticated, settings.dynamicDrive, update]);

  useEffect(() => {
    if (!liveDrive && claimedRef.current && isAuthenticated && driveSessionIdRef.current) {
      const driveSessionId = driveSessionIdRef.current;
      claimedRef.current = false;
      void releaseDynamicDriveSessionFn({
        data: { sessionToken: null, driveSessionId },
      });
    }
  }, [liveDrive, isAuthenticated]);

  return null;
}
