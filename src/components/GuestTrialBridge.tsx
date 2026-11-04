"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { AccountSignInDialog } from "@/components/AccountSignInDialog";
import { getSession } from "@/lib/drive/session";
import { useSettings } from "@/lib/drive/useSettings";
import { useFeatureAccess } from "@/lib/entitlements/selectors";
import {
  GUEST_TRIAL_HEARTBEAT_SECONDS,
  guestTrialCopy,
  guestTrialNow,
  isGuestTrialProfile,
  isGuestTrialWindow,
} from "@/lib/guest-trial/config";
import {
  applyServerUsage,
  currentTrialGenre,
  getGuestTrialState,
  guestRemainingSeconds,
  subscribeGuestTrial,
  takePendingSeconds,
  tickGuestTrial,
} from "@/lib/guest-trial/client-store";

async function sendHeartbeat(seconds: number) {
  try {
    const init: RequestInit =
      seconds > 0
        ? {
            method: "POST",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ seconds }),
          }
        : { method: "GET", credentials: "same-origin" };
    const res = await fetch("/api/guest-trial", init);
    if (!res.ok) throw new Error(String(res.status));
    applyServerUsage((await res.json()) as { mode: string; usedSeconds?: number; day?: string }, seconds);
  } catch {
    // Offline / error: the localStorage counter keeps the limit.
  }
}

/**
 * Guest trial runtime: counts free seconds while a signed-out visitor drives a
 * trial sound, sends heartbeats, shows the remaining-time pill and the time-up
 * notice. When time runs out the drive fades out and ends (no fallback sound).
 */
export function GuestTrialBridge() {
  const { settings } = useSettings();
  const access = useFeatureAccess();
  useSyncExternalStore(subscribeGuestTrial, () => getGuestTrialState().version, () => 0);
  const [timeUp, setTimeUp] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const wasUsing = useRef(false);

  const now = guestTrialNow();
  const usingTrial =
    access.isLiveDrive &&
    !access.isSignedIn &&
    isGuestTrialWindow(now) &&
    isGuestTrialProfile(settings.profileId, currentTrialGenre());
  const remaining = guestRemainingSeconds(now);

  // Time up (or a switch to another trial sound with nothing left): fade the
  // sound out by ending the drive and show the log-in / sign-up notice.
  useEffect(() => {
    if (!usingTrial || remaining > 0) return;
    wasUsing.current = true;
    setTimeUp(true);
    void getSession().stop();
  }, [usingTrial, remaining]);

  useEffect(() => {
    if (!usingTrial) return;
    wasUsing.current = true;
    void sendHeartbeat(0);
    let sinceBeat = 0;
    const id = window.setInterval(() => {
      tickGuestTrial(1);
      sinceBeat += 1;
      if (sinceBeat >= GUEST_TRIAL_HEARTBEAT_SECONDS || guestRemainingSeconds() <= 0) {
        sinceBeat = 0;
        void sendHeartbeat(takePendingSeconds());
      }
    }, 1000);
    return () => {
      window.clearInterval(id);
      const p = takePendingSeconds();
      if (p > 0) void sendHeartbeat(p);
    };
  }, [usingTrial, settings.profileId]);

  useEffect(() => {
    if (wasUsing.current && remaining <= 0 && !access.isSignedIn) setTimeUp(true);
  }, [remaining, access.isSignedIn]);

  useEffect(() => {
    if (access.isSignedIn) setTimeUp(false);
  }, [access.isSignedIn]);

  // Non-production preview hook for screenshots: ?guestTrialPreview=countdown|timeup
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (import.meta.env.PROD) return;
    setPreview(new URLSearchParams(window.location.search).get("guestTrialPreview"));
  }, []);

  const copy = guestTrialCopy(settings.language);
  const showPill = (usingTrial && remaining > 0) || preview === "countdown";
  const showNotice = timeUp || preview === "timeup";
  const shown = preview === "countdown" && !usingTrial ? 4 * 60 + 12 : remaining;

  return (
    <>
      {showPill ? (
        <div
          data-testid="guest-trial-countdown"
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center px-4"
        >
          <span className="rounded-full border border-white/15 bg-black/80 px-4 py-1.5 text-xs font-medium tabular-nums text-white shadow-lg backdrop-blur">
            {copy.remaining(Math.floor(shown / 60), shown % 60)}
          </span>
        </div>
      ) : null}
      {showNotice && !signInOpen ? (
        <div
          data-testid="guest-trial-timeup"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5"
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-950 p-6 text-center text-white shadow-2xl">
            <h2 className="text-lg font-semibold">{copy.title}</h2>
            <p className="mt-2 text-sm text-white/70">{copy.body}</p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black"
                onClick={() => setSignInOpen(true)}
              >
                {copy.signIn}
              </button>
              <button
                type="button"
                className="rounded-full px-4 py-2 text-sm text-white/70"
                onClick={() => {
                  setTimeUp(false);
                  setPreview(null);
                }}
              >
                {copy.close}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <AccountSignInDialog
        open={signInOpen}
        onOpenChange={(open) => {
          setSignInOpen(open);
          if (!open) setTimeUp(false);
        }}
        returnTo="/drive"
      />
    </>
  );
}
