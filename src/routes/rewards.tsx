import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { RewardDiscountPanel } from "@/components/rewards/RewardDiscountPanel";
import { SoundSpinWheel } from "@/components/rewards/SoundSpinWheel";
import { createSeoHeadFromPath } from "@/lib/seo";
import {
  claimSoundSpinFn,
  getSoundSpinStatusFn,
} from "@/lib/rewards/server-fns";
import type { PublicClaimView } from "@/lib/rewards/types";

export const Route = createFileRoute("/rewards")({
  component: RewardsPage,
  head: () => createSeoHeadFromPath("/rewards"),
});

function RewardsPage() {
  const [revealedClaim, setRevealedClaim] = useState<PublicClaimView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ["sound-spin-status"],
    queryFn: () => getSoundSpinStatusFn({ data: { sessionToken: null } }),
    staleTime: 15_000,
  });

  const status = statusQuery.data?.status;
  const discountReservations = statusQuery.data?.extras?.discountReservations ?? [];
  const idempotencyKey = useMemo(() => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `spin-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }, []);

  async function onClaim() {
    if (!status?.claimingEnabled || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await claimSoundSpinFn({
        data: { sessionToken: null, idempotencyKey },
      });
      if (!result.ok) {
        setError(result.message);
        await statusQuery.refetch();
        return;
      }
      // Outcome is already persisted server-side before this animation.
      setRevealedClaim(result.claim);
      await statusQuery.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed");
    } finally {
      setBusy(false);
    }
  }

  if (statusQuery.isLoading || !status) {
    return (
      <main className="min-h-[70vh] bg-background px-6 py-16 text-foreground">
        <p className="text-center text-sm text-muted-foreground">Loading Sound Spin…</p>
      </main>
    );
  }

  if (!status.rewardsEnabled) {
    return (
      <main className="min-h-[70vh] bg-background px-6 py-16 text-foreground">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-2xl tracking-[0.28em] uppercase">Sound Spin</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Monthly rewards are not available yet. Campaign configuration is still in progress.
          </p>
          <Link to="/garage" className="mt-8 inline-block text-sm text-foreground underline">
            Back to Garage
          </Link>
        </div>
      </main>
    );
  }

  const campaign = status.campaign;

  return (
    <main className="min-h-[70vh] bg-[radial-gradient(ellipse_at_50%_0%,#141414_0%,#000_55%)] px-4 py-12 text-foreground sm:px-8">
      <div className="mx-auto mb-8 flex max-w-lg items-center justify-between text-xs tracking-[0.18em] text-muted-foreground uppercase">
        <Link to="/garage" className="hover:text-foreground">
          Garage
        </Link>
        <span>UTC month</span>
      </div>

      <SoundSpinWheel
        status={status}
        busy={busy}
        onClaim={onClaim}
        revealedClaim={revealedClaim ?? status.claim}
      />

      {error ? (
        <p className="mx-auto mt-6 max-w-lg text-center text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      {status.disableReason && !status.claimingEnabled && !status.alreadyClaimed ? (
        <p className="mx-auto mt-6 max-w-lg text-center text-sm text-muted-foreground">
          {status.disableReason}
        </p>
      ) : null}

      {campaign ? (
        <section className="mx-auto mt-12 max-w-lg space-y-4 px-2 text-sm text-muted-foreground">
          <h2 className="text-xs tracking-[0.2em] text-foreground uppercase">Terms</h2>
          <p>{campaign.timezoneNote}</p>
          <p>
            Temporary access starts at claim time ({campaign.accessStartsAt.replace("_", " ")}).
            Campaign period <span className="text-foreground">{campaign.periodKey}</span> runs from{" "}
            <time dateTime={campaign.periodStartsAtUtc}>{campaign.periodStartsAtUtc}</time> until{" "}
            <time dateTime={campaign.periodEndsAtUtcExclusive}>
              {campaign.periodEndsAtUtcExclusive}
            </time>{" "}
            (exclusive end, UTC).
          </p>
          <p>
            Next eligibility:{" "}
            <time dateTime={campaign.nextEligibilityAtUtc} className="text-foreground">
              {campaign.nextEligibilityAtUtc}
            </time>
          </p>
          {campaign.stagingIllustrativeOnly ? (
            <p className="text-amber-200/80">
              Staging illustrative odds only. Production probabilities are explicit configuration,
              not invented business facts.
            </p>
          ) : null}
        </section>
      ) : null}

      {status.displayedOdds.length > 0 ? (
        <section className="mx-auto mt-10 max-w-lg px-2">
          <h2 className="text-xs tracking-[0.2em] text-foreground uppercase">
            Actual odds for your pool
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Wheel segments are decorative and not proportional to these probabilities.
            {status.audience ? ` Audience: ${status.audience}.` : ""}
          </p>
          <ul className="mt-4 space-y-3">
            {status.displayedOdds.map((row) => (
              <li key={row.rewardId} className="border-t border-foreground/10 pt-3 text-sm">
                <div className="flex items-baseline justify-between gap-3 text-foreground">
                  <span>{row.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {row.probabilityPercent}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{row.termsSummary}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(revealedClaim ?? status.claim)?.outcome.accessEndsAtUtc ? (
        <p className="mx-auto mt-8 max-w-lg text-center text-xs text-muted-foreground">
          Access ends{" "}
          <time dateTime={(revealedClaim ?? status.claim)!.outcome.accessEndsAtUtc!}>
            {(revealedClaim ?? status.claim)!.outcome.accessEndsAtUtc}
          </time>{" "}
          (UTC).
        </p>
      ) : null}

      {discountReservations.map((r) => (
        <RewardDiscountPanel
          key={r.reservationId}
          reservationId={r.reservationId}
          discountPercent={r.discountPercent}
        />
      ))}
    </main>
  );
}
