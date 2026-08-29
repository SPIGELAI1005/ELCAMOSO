import { useCallback } from "react";
import { getSession } from "@/lib/drive/session";
import { useSessionStore } from "@/lib/store/session-store";

export type DriveStatus = "idle" | "starting" | "driving" | "error";

interface UseDriveSessionOptions {
  demoMotion: boolean;
}

/** Drive lifecycle hook. Audio/profile sync is handled by `SessionBridge`. */
export function useDriveSession({ demoMotion }: UseDriveSessionOptions) {
  const snap = useSessionStore();
  const session = getSession();
  const start = useCallback(() => session.startDrive({ demoMotion }), [session, demoMotion]);
  const stop = useCallback(() => session.stop(), [session]);

  const status: DriveStatus =
    snap.kind === "drive" && snap.status === "running"
      ? "driving"
      : snap.kind === "drive" && snap.status === "starting"
        ? "starting"
        : snap.status === "error"
          ? "error"
          : "idle";

  return {
    status,
    error: snap.error,
    state: snap.state,
    sessionSnap: snap,
    start,
    stop,
  };
}
