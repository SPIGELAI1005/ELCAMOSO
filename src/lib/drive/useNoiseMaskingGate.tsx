"use client";

import { useState } from "react";
import { useLocation } from "@tanstack/react-router";

import { AccountSignInDialog } from "@/components/AccountSignInDialog";
import { useAccount } from "@/lib/account/AccountProvider";
import { useSettings } from "@/lib/drive/useSettings";
import {
  NOISE_MASKING_LABEL,
  NOISE_MASKING_SIGN_IN_REMARK,
  isNoiseMaskingAllowed,
} from "@/lib/sound/road-cabin";

export function useNoiseMaskingGate(returnTo?: string) {
  const { isAuthenticated } = useAccount();
  const { settings, update } = useSettings();
  const location = useLocation();
  const [signInOpen, setSignInOpen] = useState(false);
  const allowed = isNoiseMaskingAllowed(isAuthenticated);
  const here = `${location.pathname}${location.searchStr || ""}`;
  const resolvedReturnTo = returnTo ?? (here || "/drive");

  function requestChange(apply: () => void): boolean {
    if (!allowed) {
      setSignInOpen(true);
      return false;
    }
    apply();
    return true;
  }

  const dialog = (
    <AccountSignInDialog
      open={signInOpen}
      onOpenChange={setSignInOpen}
      returnTo={resolvedReturnTo}
      title="Sign in"
      description={NOISE_MASKING_SIGN_IN_REMARK}
    />
  );

  return {
    allowed,
    /** Visual + audio master: off whenever the visitor is signed out. */
    masterOn: allowed && settings.noiseMasking,
    settings,
    update,
    requestChange,
    dialog,
    signInRemark: NOISE_MASKING_SIGN_IN_REMARK,
    label: NOISE_MASKING_LABEL,
  };
}
