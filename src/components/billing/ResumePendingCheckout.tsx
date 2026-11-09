"use client";

import { useEffect, useState } from "react";

import { useAccount } from "@/lib/account/AccountProvider";
import { openDrivePlusCheckout } from "@/lib/billing/checkout-client";
import { readCheckoutResume } from "@/lib/billing/checkout-resume";

let resumeStartedFor: string | null = null;

function checkoutFailureMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : error &&
          typeof error === "object" &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : "";
  const message = raw.replace(/sk_(live|test)_[A-Za-z0-9]+/g, "sk_…").trim();
  if (!message || message.length > 240) return "Payment is unavailable right now.";
  return message;
}

/** After sign-in, open Stripe for the package chosen before login. */
export function ResumePendingCheckout() {
  const { isAuthenticated, isLoading } = useAccount();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !isAuthenticated || typeof window === "undefined") return;
    const intent = readCheckoutResume(`${window.location.pathname}${window.location.search}`);
    if (!intent) return;
    const signature = `${intent.plan}:${intent.interval}:${intent.source}`;
    if (resumeStartedFor === signature) return;
    resumeStartedFor = signature;
    const next = intent.returnPath === "/" ? "/" : intent.returnPath;
    window.history.replaceState(window.history.state, "", next);
    setNotice("Opening checkout…");
    // Resume only runs after the visitor already ticked immediate-start consent on checkout.
    void openDrivePlusCheckout(
      intent.interval,
      intent.returnPath,
      intent.source,
      intent.plan,
      true,
    ).catch((error: unknown) => {
      resumeStartedFor = null;
      setNotice(checkoutFailureMessage(error));
    });
  }, [isAuthenticated, isLoading]);

  if (!notice) return null;
  return (
    <p
      role="status"
      className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-5 py-2 text-xs text-background shadow-lg"
    >
      {notice}
    </p>
  );
}
