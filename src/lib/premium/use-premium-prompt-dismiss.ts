import { useCallback, useState } from "react";

import { dismissPremiumPrompt, isPremiumPromptDismissed } from "@/lib/premium/dismiss-store";
import type { PremiumContext } from "@/lib/premium/contexts";

/** Tracks dismiss state for inline upgrade prompts (local, per context). */
export function usePremiumPromptDismiss(context: PremiumContext, enabled: boolean) {
  const [dismissed, setDismissed] = useState(() => enabled && isPremiumPromptDismissed(context));

  const dismiss = useCallback(() => {
    dismissPremiumPrompt(context);
    setDismissed(true);
  }, [context]);

  return { dismissed, dismiss };
}
