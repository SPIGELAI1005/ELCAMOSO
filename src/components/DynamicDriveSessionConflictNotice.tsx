import { useSyncExternalStore } from "react";

import {
  dismissDynamicDriveSessionConflict,
  getDynamicDriveSessionUiState,
  subscribeDynamicDriveSessionUi,
} from "@/lib/dynamic-drive-session/session-ui-store";

/** Non-blocking notice when Dynamic Drive is already active elsewhere. */
export function DynamicDriveSessionConflictNotice({ className = "" }: { className?: string }) {
  const state = useSyncExternalStore(
    subscribeDynamicDriveSessionUi,
    getDynamicDriveSessionUiState,
    getDynamicDriveSessionUiState,
  );

  if (!state.conflictMessage || state.dismissed) return null;

  return (
    <aside
      className={`rounded-xl border border-border/50 bg-card/30 px-4 py-3 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
            Dynamic Drive
          </p>
          <p className="mt-2 text-sm font-light text-foreground">{state.conflictMessage}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            End Dynamic Drive on your other device, or wait a moment if that session already ended.
            Basic Drive on this device is unaffected.
          </p>
        </div>
        <button
          type="button"
          onClick={dismissDynamicDriveSessionConflict}
          className="shrink-0 text-[10px] tracking-[0.18em] text-muted-foreground uppercase hover:text-foreground"
        >
          Dismiss
        </button>
      </div>
    </aside>
  );
}
