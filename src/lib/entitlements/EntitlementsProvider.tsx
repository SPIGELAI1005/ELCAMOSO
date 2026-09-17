import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useAccount } from "@/lib/account/AccountProvider";
import { DEFAULT_ENTITLEMENT_USER } from "@/lib/entitlements/defaults";
import { getEntitlementsFn } from "@/lib/entitlements/server-fns";
import { buildEntitlementSnapshot, hasEntitlement } from "@/lib/entitlements/resolve";
import type { Entitlement, EntitlementSnapshot, EntitlementUser } from "@/lib/entitlements/types";
import { isTrialActive } from "@/lib/entitlements/trial";

export interface EntitlementsContextValue {
  user: EntitlementUser;
  snapshot: EntitlementSnapshot;
  hasEntitlement: (entitlement: Entitlement) => boolean;
  isTrialActive: boolean;
  isLoading: boolean;
}

export const EntitlementsContext = createContext<EntitlementsContextValue | null>(null);

export interface EntitlementsProviderProps {
  /** Optional override for tests. */
  user?: EntitlementUser;
  now?: number;
  children: ReactNode;
}

export function EntitlementsProvider({ user, now, children }: EntitlementsProviderProps) {
  const { session, isAuthenticated } = useAccount();

  const query = useQuery({
    queryKey: ["entitlements", session?.userId ?? null, isAuthenticated],
    queryFn: async () => {
      if (user) {
        return buildEntitlementSnapshot(user, now ?? Date.now());
      }
      return getEntitlementsFn({ data: { sessionToken: null } });
    },
    staleTime: 30_000,
    retry: false,
  });

  const value = useMemo((): EntitlementsContextValue => {
    const at = now ?? Date.now();
    const resolvedUser = user ?? {
      ...DEFAULT_ENTITLEMENT_USER,
      ...(query.data
        ? {
            accountId: session?.userId ?? null,
            plan: query.data.plan,
            subscriptionStatus: query.data.subscriptionStatus,
            trialStatus: query.data.trialStatus,
            revision: query.data.revision,
          }
        : {}),
    };

    const snapshot =
      user != null
        ? buildEntitlementSnapshot(resolvedUser, at)
        : query.data ?? buildEntitlementSnapshot(DEFAULT_ENTITLEMENT_USER, at);

    return {
      user: resolvedUser,
      snapshot,
      hasEntitlement: (entitlement) => {
        if (user) return hasEntitlement(user, entitlement, at);
        return snapshot.entitlements.includes(entitlement);
      },
      isTrialActive: user ? isTrialActive(user, at) : snapshot.trialActive,
      isLoading: user == null && query.isLoading,
    };
  }, [now, query.data, query.isLoading, session?.userId, user]);

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function useEntitlementsContext(): EntitlementsContextValue {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) {
    throw new Error("useEntitlements must be used within EntitlementsProvider");
  }
  return ctx;
}
