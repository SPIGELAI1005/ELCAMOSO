import type { ReactNode } from "react";

import type { Entitlement } from "@/lib/entitlements/types";
import { useEntitlement } from "@/lib/entitlements/selectors";

interface EntitlementGateProps {
  entitlement: Entitlement;
  children: ReactNode;
  fallback?: ReactNode;
}

/** Declarative feature gate - never compares plans directly. */
export function EntitlementGate({ entitlement, children, fallback = null }: EntitlementGateProps) {
  const allowed = useEntitlement(entitlement);
  if (!allowed) return fallback;
  return children;
}
