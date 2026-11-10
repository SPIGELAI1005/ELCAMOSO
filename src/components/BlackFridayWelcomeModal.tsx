"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  blackFridayWelcomeCopy,
  isDriveSpecialActive,
  landingStartDriveProfileId,
} from "@/lib/billing/drive-special";
import { FOUNDERS_PRICING_HASH, FOUNDERS_PRICING_SEARCH } from "@/lib/billing/pricing-search";
import { useAccount } from "@/lib/account/AccountProvider";
import { writeSettings } from "@/lib/drive/settings";
import { useSettings } from "@/lib/drive/useSettings";
import {
  hasSeenBlackFridayWelcome,
  markBlackFridayWelcomeSeen,
  shouldShowBlackFridayWelcome,
} from "@/lib/drive-special-cap/bf-welcome";
import {
  getBlackFridayWelcomeFn,
  markBlackFridayWelcomeSeenFn,
} from "@/lib/drive-special-cap/server-fns";

/**
 * After sign-in during the Black Friday window: congratulations, once per account
 * (server-side). localStorage is a cache so the same browser does not flash the modal.
 */
export function BlackFridayWelcomeModal() {
  const { session, isAuthenticated, isLoading } = useAccount();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const accountId = session?.userId ?? "";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !accountId || !isDriveSpecialActive()) {
      setOpen(false);
      return;
    }
    if (hasSeenBlackFridayWelcome(accountId)) {
      setOpen(false);
      return;
    }
    let cancelled = false;
    void getBlackFridayWelcomeFn()
      .then((result) => {
        if (cancelled) return;
        if (result.seen) {
          markBlackFridayWelcomeSeen(accountId);
          setOpen(false);
          return;
        }
        setOpen(shouldShowBlackFridayWelcome(accountId));
      })
      .catch(() => {
        if (!cancelled) setOpen(shouldShowBlackFridayWelcome(accountId));
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, isAuthenticated, isLoading]);

  function dismiss() {
    markBlackFridayWelcomeSeen(accountId);
    setOpen(false);
    void markBlackFridayWelcomeSeenFn({ data: {} }).catch(() => undefined);
  }

  function startDrive() {
    writeSettings({ profileId: landingStartDriveProfileId() });
    dismiss();
    void navigate({ to: "/drive", search: { start: true } });
  }

  if (!open) return null;
  const copy = blackFridayWelcomeCopy(settings.language);

  return (
    <div
      data-testid="black-friday-welcome"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bf-welcome-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-950 p-6 text-center text-white shadow-2xl">
        <h2 id="bf-welcome-title" className="text-lg font-semibold">
          {copy.title}
        </h2>
        <p className="mt-2 text-sm text-white/70">{copy.body}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black"
            onClick={startDrive}
          >
            {copy.startDrive}
          </button>
          <Link
            to="/pricing"
            search={FOUNDERS_PRICING_SEARCH}
            hash={FOUNDERS_PRICING_HASH}
            className="rounded-full border border-white/30 px-4 py-2.5 text-sm font-semibold text-white"
            onClick={dismiss}
          >
            {copy.foundersPack}
          </Link>
          <Link
            to="/legal/terms"
            hash="black-friday-special"
            className="rounded-full px-4 py-2 text-sm text-white/70"
            onClick={dismiss}
          >
            {copy.terms}
          </Link>
        </div>
      </div>
    </div>
  );
}
