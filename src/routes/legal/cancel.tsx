"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { createSeoHeadFromPath } from "@/lib/seo";
import { LegalNote, LegalPage, LegalSection } from "@/components/LegalPage";
import { useAccount } from "@/lib/account/AccountProvider";
import { AccountSignInDialog } from "@/components/AccountSignInDialog";
import { openBillingPortal } from "@/lib/billing/portal-client";
import { LEGAL_OPERATOR } from "@/lib/legal/operator";

export const Route = createFileRoute("/legal/cancel")({
  component: CancelContract,
  head: () => createSeoHeadFromPath("/legal/cancel"),
});

function CancelContract() {
  const o = LEGAL_OPERATOR;
  const { isAuthenticated, isLoading } = useAccount();
  const [signInOpen, setSignInOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openCancelPortal() {
    setBusy(true);
    setError(null);
    try {
      await openBillingPortal("/legal/cancel", "cancel");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open billing. Email us to cancel.");
      setBusy(false);
    }
  }

  return (
    <LegalPage
      title="Cancel contract"
      subtitle="Verträge hier kündigen — ordinary termination of a paid ELCAMOSO subscription (§ 312k BGB)."
    >
      <LegalNote>
        This button is the cancellation facility required for consumer distance contracts under
        German law. Statutory 14-day withdrawal is on the{" "}
        <Link to="/legal/withdrawal" className="text-foreground underline-offset-2 hover:underline">
          withdrawal page
        </Link>
        . This is not legal advice.
      </LegalNote>

      <LegalSection title="How cancellation works">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Monthly subscriptions can be cancelled at any time and then end at the close of the
            current billing period.
          </li>
          <li>
            Yearly subscriptions run for 12 months. After the initial term they are cancellable at
            any time with one month’s notice, as permitted after 1 March 2022 (§ 309 Nr. 9 BGB).
            There is no refund of the remaining yearly term except where the law requires it
            (including a valid 14-day withdrawal).
          </li>
          <li>
            Forever sounds from a Founders Pack stay yours after a regular cancellation. A statutory
            withdrawal within 14 days refunds the purchase and revokes those Founder perks.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Cancel here">
        {isLoading ? (
          <p>Loading…</p>
        ) : isAuthenticated ? (
          <div className="space-y-3">
            <p>
              You are signed in. Continue to the payment provider to cancel your subscription at the
              end of the current period (or as shown there).
            </p>
            <button
              type="button"
              data-testid="cancel-contract-portal"
              disabled={busy}
              onClick={() => void openCancelPortal()}
              className="inline-flex h-12 items-center rounded-full border border-foreground bg-foreground px-6 text-[11px] tracking-[0.2em] text-background uppercase disabled:opacity-50"
            >
              {busy ? "Opening…" : "Cancel contract · Verträge hier kündigen"}
            </button>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        ) : (
          <div className="space-y-3">
            <p>
              Sign in to cancel in the billing portal, or send an unequivocal cancellation by email.
            </p>
            <button
              type="button"
              onClick={() => setSignInOpen(true)}
              className="inline-flex h-12 items-center rounded-full border border-foreground bg-foreground px-6 text-[11px] tracking-[0.2em] text-background uppercase"
            >
              Sign in to cancel
            </button>
            <p>
              Email{" "}
              <a
                className="text-foreground underline-offset-2 hover:underline"
                href={`mailto:${o.email}?subject=${encodeURIComponent("Kündigung / cancel contract")}`}
              >
                {o.email}
              </a>{" "}
              with: your name, the email on the account, “I hereby cancel my ELCAMOSO subscription”,
              and the date. We will confirm.
            </p>
          </div>
        )}
      </LegalSection>

      <LegalSection title="Withdrawal (14 days)">
        <p>
          If you are still inside the 14-day cooling-off period and want a refund rather than a
          period-end cancellation, use the{" "}
          <Link
            to="/legal/withdrawal"
            className="text-foreground underline-offset-2 hover:underline"
          >
            model withdrawal form
          </Link>
          .
        </p>
      </LegalSection>

      <AccountSignInDialog
        open={signInOpen}
        onOpenChange={setSignInOpen}
        returnTo="/legal/cancel"
        title="Sign in"
        description="Sign in to cancel your subscription in the billing portal."
      />
    </LegalPage>
  );
}
