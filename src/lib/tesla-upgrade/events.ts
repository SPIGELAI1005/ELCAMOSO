import type { RelayEntitlementUpdatePayload } from "@/lib/tesla-upgrade/types";

export const TESLA_ENTITLEMENT_UPDATE_EVENT = "elcamoso:entitlement-update";

export interface TeslaEntitlementUpdateDetail extends RelayEntitlementUpdatePayload {
  at: number;
}

export function dispatchTeslaEntitlementUpdate(detail: TeslaEntitlementUpdateDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<TeslaEntitlementUpdateDetail>(TESLA_ENTITLEMENT_UPDATE_EVENT, { detail }),
  );
}

export function onTeslaEntitlementUpdate(
  listener: (detail: TeslaEntitlementUpdateDetail) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const custom = event as CustomEvent<TeslaEntitlementUpdateDetail>;
    if (custom.detail?.plan) listener(custom.detail);
  };
  window.addEventListener(TESLA_ENTITLEMENT_UPDATE_EVENT, handler);
  return () => window.removeEventListener(TESLA_ENTITLEMENT_UPDATE_EVENT, handler);
}
