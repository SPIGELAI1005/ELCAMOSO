import { useCallback, useEffect, useMemo } from "react";
import { DEMO_DEFAULTS, getSession, type DemoControls } from "@/lib/drive/session";
import { useSessionStore } from "@/lib/store/session-store";
import type { ProfileTuning } from "@/lib/drive/settings";
import type { LayerMix } from "@/lib/sound/environments";
import type { SoundSnippet } from "@/lib/sound/snippets";

export type { DemoControls };
export { DEMO_DEFAULTS };

interface Options {
  profileId: string;
  volume: number;
  profileGain: number;
  tuning?: ProfileTuning | undefined;
  environmentId?: string;
  mix?: LayerMix;
  snippets?: SoundSnippet[];
}

/** Stable key so fresh object identities from getTuning() don't re-sync. */
function demoConfigKey(opts: {
  profileId: string;
  volume: number;
  profileGain: number;
  environmentId?: string;
  mix?: LayerMix;
  snippets?: SoundSnippet[];
  tuning?: ProfileTuning;
}): string {
  return JSON.stringify({
    profileId: opts.profileId,
    volume: opts.volume,
    profileGain: opts.profileGain,
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

export function useDemoDrive({
  profileId,
  volume,
  profileGain,
  tuning,
  environmentId,
  mix,
  snippets,
}: Options) {
  const snap = useSessionStore();
  const session = getSession();

  const configKey = useMemo(
    () =>
      demoConfigKey({
        profileId,
        volume,
        profileGain,
        ...(environmentId !== undefined ? { environmentId } : {}),
        ...(mix !== undefined ? { mix } : {}),
        ...(snippets !== undefined ? { snippets } : {}),
        ...(tuning !== undefined ? { tuning } : {}),
      }),
    [profileId, volume, profileGain, environmentId, mix, snippets, tuning],
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- configKey is the content gate
  }, [session, configKey]);

  const setControls = useCallback(
    (next: Partial<DemoControls>) => session.setDemo(next),
    [session],
  );
  const reset = useCallback(() => session.setDemo(DEMO_DEFAULTS), [session]);
  const start = useCallback(() => session.startDemo(), [session]);
  const stop = useCallback(() => session.stop(), [session]);
  const active = snap.kind === "demo" && (snap.status === "running" || snap.status === "starting");
  return { active, state: snap.state, controls: snap.demo, setControls, reset, start, stop };
}
