import { useEffect, useRef } from "react";
import { getSession } from "@/lib/drive/session";
import { useSessionStore } from "@/lib/store/session-store";
import { useSettings } from "@/lib/drive/useSettings";
import { getProfileGain, getTuning } from "@/lib/drive/settings";

const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

/** Keeps the drive session singleton in sync with saved settings. */
export function SessionBridge() {
  const { settings, update } = useSettings();
  const snap = useSessionStore();
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeCustom = settings.customSounds.find((s) => s.id === settings.profileId);

  useEffect(() => {
    getSession().syncConfig({
      profileId: settings.profileId,
      volume: settings.volume,
      profileGain: getProfileGain(settings, settings.profileId),
      tuning: getTuning(settings, settings.profileId),
      motionSensitivity: settings.motionSensitivity,
      motionNoiseFloor: settings.motionNoiseFloor,
      environmentId: activeCustom?.environmentId ?? settings.environmentId,
      mix: activeCustom?.mix ?? settings.layerMix,
      snippets: settings.snippets,
      cabinEq: activeCustom?.eq ?? settings.cabinEq,
      shiftFeel: settings.shiftFeel,
      autoRules: settings.autoRules,
      autoRulesMode: settings.autoRulesMode,
      playlists: settings.playlists,
      latencyCompMs: settings.latencyCompMs,
      profileRules: settings.profileRules,
      activeProfileRules: activeCustom?.rules ?? [],
    });
  }, [settings, activeCustom]);

  useEffect(() => {
    if (snap.kind !== "drive" || snap.status !== "running") return;
    if (snap.profileId === settings.profileId) return;
    update({ profileId: snap.profileId });
  }, [snap.kind, snap.status, snap.profileId, settings.profileId, update]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js");
  }, []);

  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (snap.status === "running") void el.play().catch(() => {});
    else el.pause();
  }, [snap.status]);

  return (
    <audio ref={audioRef} src={SILENT_WAV} loop hidden playsInline aria-hidden="true" />
  );
}
