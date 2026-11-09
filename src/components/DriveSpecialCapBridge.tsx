"use client";

import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  DRIVE_SPECIAL_HEARTBEAT_SECONDS,
  driveSpecialCapCopy,
} from "@/lib/billing/drive-special";
import { getSession } from "@/lib/drive/session";
import { useSettings } from "@/lib/drive/useSettings";
import { useEntitlements } from "@/lib/entitlements/useEntitlements";
import { isTrialActive } from "@/lib/entitlements/trial";
import {
  applyDriveSpecialServerUsage,
  driveSpecialCapGoverns,
  driveSpecialRemainingSeconds,
  getDriveSpecialCapState,
  subscribeDriveSpecialCap,
  takeDriveSpecialPendingSeconds,
  tickDriveSpecialCap,
} from "@/lib/drive-special-cap/client-store";
import { isLiveSessionStatus } from "@/lib/ui/chrome";
import { useSessionSelector } from "@/lib/store/session-store";

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
    const res = await fetch("/api/drive-special", init);
    if (!res.ok) throw new Error(String(res.status));
    applyDriveSpecialServerUsage(
      (await res.json()) as { mode: string; usedSeconds?: number; day?: string },
      seconds,
    );
  } catch {
    // Offline / error: the localStorage counter keeps the limit.
  }
}

/**
 * Black Friday Special runtime: counts 30 free minutes/day while a signed-in
 * driver plays Drive the Music through the special, sends heartbeats, shows
 * remaining time, and the time-up notice pointing at /pricing#drive-music.
 */
export function DriveSpecialCapBridge() {
  const { settings } = useSettings();
  const { user, snapshot } = useEntitlements();
  const session = useSessionSelector((s) => ({ kind: s.kind, status: s.status }));
  useSyncExternalStore(
    subscribeDriveSpecialCap,
    () => getDriveSpecialCapState(user?.accountId ?? "").version,
    () => 0,
  );
  const [timeUp, setTimeUp] = useState(false);
  const wasUsing = useRef(false);

  const now = Date.now();
  const capUser = {
    accountId: user?.accountId ?? null,
    plan: snapshot.plan,
    founderDrivePlusActive: Boolean(snapshot.founder?.drivePlusActive),
    grantedEntitlements: user?.grantedEntitlements,
    trialActive: user ? isTrialActive(user, now) : snapshot.trialActive,
    trialEntitlements: user?.trialEntitlements,
    grantedProfileIds: snapshot.grantedProfileIds,
  };
  const playing =
    Boolean(snapshot.driveSpecialCapApplies) &&
    isLiveSessionStatus(session.status) &&
    driveSpecialCapGoverns(settings.profileId, capUser, now);
  const remaining = capUser.accountId
    ? driveSpecialRemainingSeconds(capUser.accountId, now)
    : 0;

  useEffect(() => {
    if (!playing || remaining > 0) return;
    wasUsing.current = true;
    setTimeUp(true);
    void getSession().stop();
  }, [playing, remaining]);

  useEffect(() => {
    if (!playing || !capUser.accountId) return;
    wasUsing.current = true;
    void sendHeartbeat(0);
    let sinceBeat = 0;
    const accountId = capUser.accountId;
    const id = window.setInterval(() => {
      tickDriveSpecialCap(accountId, 1);
      sinceBeat += 1;
      if (sinceBeat >= DRIVE_SPECIAL_HEARTBEAT_SECONDS || driveSpecialRemainingSeconds(accountId) <= 0) {
        sinceBeat = 0;
        void sendHeartbeat(takeDriveSpecialPendingSeconds());
      }
    }, 1000);
    return () => {
      window.clearInterval(id);
      const p = takeDriveSpecialPendingSeconds();
      if (p > 0) void sendHeartbeat(p);
    };
  }, [playing, settings.profileId, capUser.accountId]);

  useEffect(() => {
    if (wasUsing.current && remaining <= 0 && playing) setTimeUp(true);
  }, [remaining, playing]);

  useEffect(() => {
    if (!snapshot.driveSpecialCapApplies) setTimeUp(false);
  }, [snapshot.driveSpecialCapApplies]);

  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (import.meta.env.PROD) return;
    setPreview(new URLSearchParams(window.location.search).get("driveSpecialPreview"));
  }, []);

  const copy = driveSpecialCapCopy(settings.language);
  const showPill = (playing && remaining > 0) || preview === "countdown";
  const showNotice = timeUp || preview === "timeup";
  const shown = preview === "countdown" && !playing ? 12 * 60 + 34 : remaining;

  return (
    <>
      {showPill ? (
        <div
          data-testid="drive-special-countdown"
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center px-4"
        >
          <span className="rounded-full border border-white/15 bg-black/80 px-4 py-1.5 text-xs font-medium tabular-nums text-white shadow-lg backdrop-blur">
            {copy.remaining(Math.floor(shown / 60), shown % 60)}
          </span>
        </div>
      ) : null}
      {showNotice ? (
        <div
          data-testid="drive-special-timeup"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5"
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-950 p-6 text-center text-white shadow-2xl">
            <h2 className="text-lg font-semibold">{copy.title}</h2>
            <p className="mt-2 text-sm text-white/70">{copy.body}</p>
            <div className="mt-5 flex flex-col gap-2">
              <Link
                to="/pricing"
                hash="drive-music"
                className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black"
                onClick={() => {
                  setTimeUp(false);
                  setPreview(null);
                }}
              >
                {copy.cta}
              </Link>
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
    </>
  );
}
