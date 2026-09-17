import { useEffect, useState } from "react";

import { useAccount } from "@/lib/account/AccountProvider";
import { formatTrialRemainingMinutes } from "@/lib/dynamic-drive-trial/display";
import { getDynamicDriveTrialStatusFn } from "@/lib/dynamic-drive-trial/server-fns";
import type { DynamicDriveTrialSnapshot } from "@/lib/dynamic-drive-trial/types";

function formatRemaining(seconds: number): string {
  return formatTrialRemainingMinutes(seconds).replace(" remaining", "");
}

interface TrialRemainingProps {
  className?: string;
  /** Smaller single-line layout for tight spaces. */
  compact?: boolean;
}

/** Shows Dynamic Drive preview time left — calm, not countdown pressure. */
export function TrialRemaining({ className = "", compact = false }: TrialRemainingProps) {
  const { session, isAuthenticated } = useAccount();
  const [snapshot, setSnapshot] = useState<DynamicDriveTrialSnapshot | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !session) {
      setSnapshot(null);
      return;
    }
    void getDynamicDriveTrialStatusFn({ data: { sessionToken: null } }).then(setSnapshot);
  }, [isAuthenticated, session]);

  if (!snapshot || snapshot.status === "converted") return null;
  if (snapshot.status !== "active" && snapshot.status !== "available") return null;

  const hasTime = snapshot.remainingSeconds > 0 && snapshot.remainingSessions > 0;

  if (compact) {
    return (
      <p className={`text-xs text-muted-foreground ${className}`}>
        {hasTime
          ? `Preview · ${formatRemaining(snapshot.remainingSeconds)} · ${snapshot.remainingSessions} drive${snapshot.remainingSessions === 1 ? "" : "s"} left`
          : "Preview available · sign in to start"}
      </p>
    );
  }

  return (
    <div
      className={`rounded-xl border border-border/50 bg-card/30 px-4 py-3 ${className}`}
      aria-live="polite"
    >
      <p className="text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
        Dynamic Drive preview
      </p>
      {hasTime ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {formatRemaining(snapshot.remainingSeconds)} remaining · {snapshot.remainingSessions}{" "}
          drive{snapshot.remainingSessions === 1 ? "" : "s"} left
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          30 minutes across 3 drives within 14 days. Free account required.
        </p>
      )}
    </div>
  );
}
