import { useEffect, useRef } from "react";
import { getSession } from "@/lib/drive/session";
import { useSessionSelector, useSessionStore } from "@/lib/store/session-store";
import { useSettings } from "@/lib/drive/useSettings";
import { getProfileGain, getTuning } from "@/lib/drive/settings";
import { useFeatureAccess } from "@/lib/entitlements/selectors";
import {
  beginLiveDriveAccess,
  endLiveDriveAccess,
} from "@/lib/entitlements/live-drive-access";
import { useEntitlements } from "@/lib/entitlements/useEntitlements";
import { isLiveSessionStatus } from "@/lib/ui/chrome";

const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

/** Keeps the drive session singleton in sync with saved settings. */
export function SessionBridge() {
  const { settings, update } = useSettings();
  const access = useFeatureAccess();
  const { entitlements } = useEntitlements();
  const sessionSnap = useSessionStore();
  const sessionUi = useSessionSelector((snap) => ({
    kind: snap.kind,
    status: snap.status,
    profileId: snap.profileId,
  }));
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeCustom = settings.customSounds.find((s) => s.id === settings.profileId);
  const wasLiveDriveRef = useRef(false);
  /** Avoid clobbering a fresh settings pick with a stale session profileId. */
  const lastSessionProfileIdRef = useRef(sessionUi.profileId);

  useEffect(() => {
    const isLiveDrive =
      sessionSnap.kind === "drive" && isLiveSessionStatus(sessionSnap.status);
    if (isLiveDrive && !wasLiveDriveRef.current) {
      beginLiveDriveAccess(entitlements);
    }
    if (!isLiveDrive && wasLiveDriveRef.current) {
      endLiveDriveAccess();
    }
    wasLiveDriveRef.current = isLiveDrive;
  }, [sessionSnap.kind, sessionSnap.status, entitlements]);

  useEffect(() => {
    const dynamicDrive = settings.dynamicDrive && access.dynamicDrive;
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
      shiftFeel: access.advancedControls ? settings.shiftFeel : settings.shiftFeel,
      autoRules: settings.autoRules,
      autoRulesMode: settings.autoRulesMode,
      playlists: settings.playlists,
      latencyCompMs: access.advancedControls ? settings.latencyCompMs : 0,
      profileRules: settings.profileRules,
      activeProfileRules: activeCustom?.rules ?? [],
      dynamicDrive,
      teslaFleetTelemetry: settings.teslaFleetTelemetry,
    });
  }, [settings, activeCustom, access.advancedControls, access.dynamicDrive]);

  useEffect(() => {
    const prevSessionProfileId = lastSessionProfileIdRef.current;
    lastSessionProfileIdRef.current = sessionUi.profileId;

    if (sessionUi.kind !== "drive" || sessionUi.status !== "running") return;
    if (sessionUi.profileId === settings.profileId) return;
    // Settings lead the session in the effect above; only mirror session -> settings
    // when the live drive session changed profile on its own (rules, playlist, etc.).
    if (prevSessionProfileId === sessionUi.profileId) return;
    update({ profileId: sessionUi.profileId });
  }, [sessionUi.kind, sessionUi.status, sessionUi.profileId, settings.profileId, update]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    // Never register the shell SW in Vite/dev: cache-first module responses mix
    // React copies after dep re-optimize and cause Invalid hook call / useContext null.
    if (import.meta.env.DEV) {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) void reg.unregister();
      });
      if ("caches" in window) {
        void caches.keys().then((keys) => {
          for (const key of keys) {
            if (key.startsWith("elcamoso-")) void caches.delete(key);
          }
        });
      }
      return;
    }
    void navigator.serviceWorker.register("/sw.js");
  }, []);

  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (sessionUi.status === "running") void el.play().catch(() => {});
    else el.pause();
  }, [sessionUi.status]);

  return <audio ref={audioRef} src={SILENT_WAV} loop hidden playsInline aria-hidden="true" />;
}
