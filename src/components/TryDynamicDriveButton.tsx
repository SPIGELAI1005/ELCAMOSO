import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { useAccount } from "@/lib/account/AccountProvider";
import { AccountSignInDialog } from "@/components/AccountSignInDialog";
import { startDynamicDriveTrialFn } from "@/lib/dynamic-drive-trial/server-fns";
import { useSettings } from "@/lib/drive/useSettings";
import { trackMonetizationEvent } from "@/lib/telemetry/monetization-analytics";

interface TryDynamicDriveButtonProps {
  className?: string;
  returnTo?: string;
  label?: string;
  source?: string;
}

/** Primary CTA: authenticated users start trial; anonymous users see minimal sign-in. */
export function TryDynamicDriveButton({
  className,
  returnTo = "/drive?activateTrial=1",
  label = "Try Dynamic Drive",
  source = "trial_offer",
}: TryDynamicDriveButtonProps) {
  const { session, isAuthenticated, isLoading } = useAccount();
  const { update } = useSettings();
  const navigate = useNavigate();
  const [showSignIn, setShowSignIn] = useState(false);
  const [busy, setBusy] = useState(false);

  async function activateTrialAndGo() {
    if (!session) return;
    setBusy(true);
    try {
      const snapshot = await startDynamicDriveTrialFn({
        data: { sessionToken: null },
      });
      update({
        accountUserId: snapshot.userId,
        accountSessionToken: null,
        accountEmail: session.email,
        dynamicDriveTrialActivated: true,
        dynamicDrive: true,
      });
      trackMonetizationEvent("dynamic_trial_started", {
        source,
        plan: "free",
      });
      await navigate({ to: "/drive", search: { activateTrial: true } });
    } finally {
      setBusy(false);
    }
  }

  async function handleClick() {
    if (isLoading) return;
    if (isAuthenticated && session) {
      await activateTrialAndGo();
      return;
    }
    setShowSignIn(true);
  }

  return (
    <>
      <button
        type="button"
        disabled={busy || isLoading}
        onClick={() => void handleClick()}
        className={
          className ??
          "inline-flex h-14 items-center justify-center rounded-full border border-foreground/20 px-10 text-sm tracking-[0.22em] uppercase transition hover:border-foreground/40 disabled:opacity-50"
        }
      >
        {busy ? "Starting…" : label}
      </button>
      <AccountSignInDialog
        open={showSignIn}
        onOpenChange={setShowSignIn}
        returnTo={returnTo}
        title="Save your Dynamic Drive Preview"
        description="Create a free account to keep your preview time and return to Drive right after sign-in. Basic Drive stays free without an account."
      />
    </>
  );
}

export async function activateDynamicDriveTrialForSession(
  update: (patch: {
    accountUserId?: string | null;
    accountSessionToken?: string | null;
    accountEmail?: string | null;
    dynamicDriveTrialActivated?: boolean;
    dynamicDrive?: boolean;
  }) => void,
  email?: string,
): Promise<boolean> {
  try {
    const snapshot = await startDynamicDriveTrialFn({ data: { sessionToken: null } });
    update({
      accountUserId: snapshot.userId,
      accountSessionToken: null,
      ...(email ? { accountEmail: email } : {}),
      dynamicDriveTrialActivated: true,
      dynamicDrive: true,
    });
    trackMonetizationEvent("dynamic_trial_started", {
      source: "account_callback",
      plan: "free",
    });
    return true;
  } catch {
    return false;
  }
}
