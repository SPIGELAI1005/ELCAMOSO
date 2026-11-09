import { useQuery } from "@tanstack/react-query";

import { getBillingPublicConfigFn } from "@/lib/billing/public-config-server-fn";

export const BILLING_PUBLIC_CONFIG_QUERY_KEY = ["billing-public-config"] as const;

/** Shared "purchases are closed" sentence (home + pricing). */
export const PURCHASES_CLOSED_COPY =
  "Purchases (Drive+, Drive the Music, Drive Unlimited, Lifetime and individual sounds) are not open yet.";

export function useBillingPublicConfig() {
  return useQuery({
    queryKey: BILLING_PUBLIC_CONFIG_QUERY_KEY,
    queryFn: () => getBillingPublicConfigFn(),
    staleTime: 60_000,
  });
}

/**
 * True only after public config has loaded and monetization is off.
 * Loading / SSR must not treat a missing query as "closed" — that flashes the
 * red "not open yet" note while purchases are actually open.
 */
export function isPurchasesClosedNoticeVisible(query: {
  isSuccess: boolean;
  data?: { monetizationEnabled?: boolean } | null;
}): boolean {
  return query.isSuccess && query.data?.monetizationEnabled === false;
}

export function usePurchasesClosedNotice(): boolean {
  return isPurchasesClosedNoticeVisible(useBillingPublicConfig());
}

export function useMonetizationEnabled(): boolean {
  const query = useBillingPublicConfig();
  return query.data?.monetizationEnabled ?? false;
}

export function useBillingAvailable(): boolean {
  const query = useBillingPublicConfig();
  return query.data?.available ?? false;
}
