"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { AccountSignInDialog } from "@/components/AccountSignInDialog";
import { midnightDarkRaveGuestCopy } from "@/lib/billing/drive-special";
import { getSession } from "@/lib/drive/session";
import { useSettings } from "@/lib/drive/useSettings";
import { useFeatureAccess } from "@/lib/entitlements/selectors";
import {
  getMidnightRaveGuestState,
  midnightRaveGuestGoverns,
  midnightRaveGuestRemainingSeconds,
  subscribeMidnightRaveGuest,
  tickMidnightRaveGuest,
} from "@/lib/drive-special-cap/midnight-rave-guest";

/**
 * Signed-out Midnight Dark Rave runtime: counts 15 free minutes/day in
 * localStorage, shows remaining time, and a sign-in prompt when time runs out.
 */
export function MidnightRaveGuestBridge() {
  const { settings } = useSettings();
  const access = useFeatureAccess();
  useSyncExternalStore(
    subscribeMidnightRaveGuest,
    () => getMidnightRaveGuestState().version,
    () => 0,
  );
  const [timeUp, setTimeUp] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const wasUsing = useRef(false);

  const now = Date.now();
  const using =
    access.isLiveDrive && midnightRaveGuestGoverns(settings.profileId, access.isSignedIn, now);
  const remaining = midnightRaveGuestRemainingSeconds(now);

  useEffect(() => {
    if (!using || remaining > 0) return;
    wasUsing.current = true;
    setTimeUp(true);
    void getSession().stop();
  }, [using, remaining]);

  useEffect(() => {
    if (!using) return;
    wasUsing.current = true;
    const id = window.setInterval(() => {
      tickMidnightRaveGuest(1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [using, settings.profileId]);

  useEffect(() => {
    if (wasUsing.current && remaining <= 0 && !access.isSignedIn) setTimeUp(true);
  }, [remaining, access.isSignedIn]);

  useEffect(() => {
    if (access.isSignedIn) setTimeUp(false);
  }, [access.isSignedIn]);

  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (import.meta.env.PROD) return;
    setPreview(new URLSearchParams(window.location.search).get("midnightRavePreview"));
  }, []);

  const copy = midnightDarkRaveGuestCopy(settings.language);
  const showPill = (using && remaining > 0) || preview === "countdown";
  const showNotice = timeUp || preview === "timeup";
  const shown = preview === "countdown" && !using ? 12 * 60 + 34 : remaining;

  return (
    <>
      {showPill ? (
        <div
          data-testid="midnight-rave-guest-countdown"
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
          data-testid="midnight-rave-guest-timeup"
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
