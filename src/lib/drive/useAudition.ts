import { useCallback, useEffect, useMemo } from "react";
import { getSession } from "@/lib/drive/session";
import { useSessionStore } from "@/lib/store/session-store";
import type { ProfileTuning } from "@/lib/drive/settings";
import type { LayerMix } from "@/lib/sound/environments";
import type { SoundSnippet } from "@/lib/sound/snippets";

interface Options {
  profileId: string;
  volume: number;
  tuning?: ProfileTuning | undefined;
  profileGain?: number;
  refreshKey?: unknown;
  environmentId?: string;
  mix?: LayerMix;
  snippets?: SoundSnippet[];
}

/** Stable key so fresh object identities from getTuning()/settings don't re-sync. */
function auditionConfigKey(opts: {
  profileId: string;
  volume: number;
  profileGain: number;
  refreshKey?: unknown;
  environmentId?: string;
  mix?: LayerMix;
  snippets?: SoundSnippet[];
  tuning?: ProfileTuning;
}): string {
  return JSON.stringify({
    profileId: opts.profileId,
    volume: opts.volume,
    profileGain: opts.profileGain,
    refreshKey: opts.refreshKey,
    environmentId: opts.environmentId,
    tuning: opts.tuning,
    mix: opts.mix,
    snippets: opts.snippets?.map((s) => ({
      id: s.id,
      trigger: s.trigger,
      level: s.level,
      dataLen: s.dataUrl?.length ?? 0,
    })),
  });
}

export function useAudition({
  profileId,
  volume,
  tuning,
  profileGain = 1,
  refreshKey,
  environmentId,
  mix,
  snippets,
}: Options) {
  const snap = useSessionStore();
  const session = getSession();
  const configKey = useMemo(
    () =>
      auditionConfigKey({
        profileId,
        volume,
        profileGain,
        ...(refreshKey !== undefined ? { refreshKey } : {}),
        ...(environmentId !== undefined ? { environmentId } : {}),
        ...(mix !== undefined ? { mix } : {}),
        ...(snippets !== undefined ? { snippets } : {}),
        ...(tuning !== undefined ? { tuning } : {}),
      }),
    [profileId, volume, profileGain, refreshKey, environmentId, mix, snippets, tuning],
  );

  useEffect(() => {
    session.syncConfig({
      profileId,
      volume,
      profileGain,
      ...(tuning ? { tuning } : {}),
      ...(environmentId ? { environmentId } : {}),
      ...(mix ? { mix } : {}),
      ...(snippets ? { snippets } : {}),
    });
    // Sync only when configKey changes. Object refs (tuning/mix/snippets) churn
    // every render via getTuning() spreads and must not be listed as deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- configKey is the content gate
  }, [session, configKey]);

  const setTarget = useCallback((kmh: number) => session.setAuditionKmh(kmh), [session]);
  const start = useCallback(() => session.startAudition(), [session]);
  const stop = useCallback(() => session.stop(), [session]);
  const active =
    (snap.kind === "audition" || snap.kind === "ab") &&
    (snap.status === "running" || snap.status === "starting");

  return {
    active,
    state: snap.state,
    start,
    stop,
    targetKmh: snap.auditionKmh,
    setTarget,
    meter: snap.meter,
    perf: snap.perf,
  };
}
