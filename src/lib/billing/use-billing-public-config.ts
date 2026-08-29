import { useQuery } from "@tanstack/react-query";

import { getBillingPublicConfigFn } from "@/lib/billing/public-config-server-fn";

export function useBillingPublicConfig() {
  return useQuery({
    queryKey: ["billing-public-config"],
    queryFn: () => getBillingPublicConfigFn(),
    staleTime: 60_000,
  });
}

export function useMonetizationEnabled(): boolean {
  const query = useBillingPublicConfig();
  return query.data?.monetizationEnabled ?? false;
}

export function useBillingAvailable(): boolean {
  const query = useBillingPublicConfig();
  return query.data?.available ?? false;
}
