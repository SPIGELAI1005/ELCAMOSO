import type { ReactNode } from "react";

import { UpgradePrompt } from "@/components/premium/UpgradePrompt";
import type { UpgradePromptVariant } from "@/components/premium/UpgradePrompt";
import {
  entitlementForPremiumContext,
  type PremiumContext,
} from "@/lib/premium/contexts";
import type { Entitlement } from "@/lib/entitlements/types";
import { useEntitlement } from "@/lib/entitlements/selectors";

interface PremiumFeatureGateProps {
  context: PremiumContext;
  children: ReactNode;
  /** Override entitlement check while keeping benefit copy from context. */
  entitlement?: Entitlement;
  /** When true, show a non-dismissible prompt instead of children. */
  required?: boolean;
  promptVariant?: UpgradePromptVariant;
  promptTitle?: string;
  className?: string;
}

/**
 * Declarative premium gate with benefit copy.
 * Never full-screen — inline prompt only when locked.
 */
export function PremiumFeatureGate({
  context,
  children,
  entitlement,
  required = false,
  promptVariant = "inline",
  promptTitle,
  className = "",
}: PremiumFeatureGateProps) {
  const check = entitlement ?? entitlementForPremiumContext(context);
  const allowed = useEntitlement(check);

  if (allowed) return children;

  return (
    <UpgradePrompt
      context={context}
      title={promptTitle}
      variant={promptVariant}
      required={required}
      className={className}
    />
  );
}
