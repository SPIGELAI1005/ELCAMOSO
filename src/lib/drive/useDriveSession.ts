import { useCallback } from "react";
import { getSession } from "@/lib/drive/session";
import { useSessionStore } from "@/lib/store/session-store";
import type { ProfileTuning } from "@/lib/drive/settings";
import type { LayerMix } from "@/lib/sound/environments";
import type { SoundSnippet } from "@/lib/sound/snippets";

export type DriveStatus = "idle" | "starting" | "driving" | "error";

interface Options {
  profileId: string;
  volume: number;
  demoMotion: boolean;
  tuning?: ProfileTuning | undefined;
  profileGain?: number;
  motionSensitivity?: number;
  motionNoiseFloor?: number;
  environmentId?: string;
  mix?: LayerMix;
  snippets?: SoundSnippet[];
}

export function useDriveSession({ demoMotion }: Options) {
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

  return { status, error: snap.error, state: snap.state, start, stop };
}
