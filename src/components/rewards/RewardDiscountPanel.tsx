import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  applyRenewalRewardDiscountFn,
  getRewardDiscountTermsFn,
  previewRewardDiscountFn,
} from "@/lib/rewards/discount/server-fns";

export interface RewardDiscountPanelProps {
  reservationId: string;
  discountPercent: number;
}

/**
 * Shows discount terms before redemption. Apply path is for active monthly
 * subscribers; new purchases use Checkout with the reservation id.
 */
export function RewardDiscountPanel({ reservationId, discountPercent }: RewardDiscountPanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const termsQuery = useQuery({
    queryKey: ["reward-discount-terms"],
    queryFn: () => getRewardDiscountTermsFn(),
    staleTime: 60_000,
  });

  const previewQuery = useQuery({
    queryKey: ["reward-discount-preview", reservationId],
    queryFn: () =>
      previewRewardDiscountFn({ data: { sessionToken: null, reservationId } }),
    enabled: Boolean(reservationId),
  });

  const enabled = termsQuery.data?.enabled === true && termsQuery.data.terms.available;
  const terms = termsQuery.data?.terms;
  const preview = previewQuery.data;

  async function onApplyRenewal() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await applyRenewalRewardDiscountFn({
        data: { sessionToken: null, reservationId },
      });
      if (!result.ok) {
        setMessage(result.message);
        await previewQuery.refetch();
        return;
      }
      setMessage(
        `${result.message} Expected total: ${
          result.expected.totalCents != null
            ? `${(result.expected.totalCents / 100).toFixed(2)} ${result.expected.currency ?? ""}`
            : "see next invoice"
        }.`,
      );
      await previewQuery.refetch();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) {
    return (
      <section className="mx-auto mt-10 max-w-lg px-2 text-sm text-muted-foreground">
        <h2 className="text-xs tracking-[0.2em] text-foreground uppercase">Discount reward</h2>
        <p className="mt-2">
          Stripe discount fulfilment is off until coupons are configured (
          <code className="text-foreground/80">ELCAMOSO_REWARD_DISCOUNTS_ENABLED</code>).
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto mt-10 max-w-lg space-y-4 px-2 text-sm text-muted-foreground">
      <h2 className="text-xs tracking-[0.2em] text-foreground uppercase">
        Redeem {discountPercent}% off one payment
      </h2>
      {terms ? (
        <ul className="list-disc space-y-2 pl-5">
          <li>Eligible plan: {terms.eligiblePlan} only ({terms.eligibleInterval}).</li>
          <li>{terms.currenciesNote}</li>
          <li>Non-stacking: existing Stripe discounts take precedence.</li>
          <li>Annual, canceled, and past-due accounts: ineligible.</li>
          <li>
            Checkout return URL does not prove consumption — a paid invoice webhook does.
          </li>
          {terms.minimumAmountCents != null ? (
            <li>Minimum invoice subtotal: {terms.minimumAmountCents} cents.</li>
          ) : null}
        </ul>
      ) : null}

      {preview?.ok ? (
        <div className="space-y-2 border-t border-foreground/10 pt-4 text-foreground">
          <p className="text-xs text-muted-foreground">
            Status: {preview.reservation.status}. Expires{" "}
            <time dateTime={preview.reservation.expiresAtUtc}>
              {preview.reservation.expiresAtUtc}
            </time>
          </p>
          <p className="text-xs text-muted-foreground">{preview.checkout.message}</p>
          <p className="text-xs text-muted-foreground">{preview.renewal.message}</p>
          {preview.renewal.ok ? (
            <button
              type="button"
              disabled={busy}
              onClick={onApplyRenewal}
              className="mt-2 inline-flex h-11 items-center justify-center rounded-full border border-foreground/30 px-6 text-[11px] tracking-[0.18em] uppercase disabled:opacity-40"
            >
              {busy ? "Applying…" : "Apply to next monthly invoice"}
            </button>
          ) : null}
          {preview.checkout.ok ? (
            <p className="text-xs text-muted-foreground">
              New monthly purchase: start Drive+ Checkout with this reservation (server attaches
              the coupon). No public promo codes.
            </p>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p className="text-sm text-foreground" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
