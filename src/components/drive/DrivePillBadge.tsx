import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared chrome for the Drive header pill badges (messages count and
 * Road Noise Masking ON/OFF). Position, height, type and shape match the
 * original messages counter: top-right of the pill, 20px tall, 10px
 * semibold type, rounded pill.
 */
export const DRIVE_PILL_BADGE_CLASS =
  "absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold";

/** Filled state: same red as the messages unread counter. */
export const DRIVE_PILL_BADGE_ON_CLASS = "bg-[#e53935] text-white";

/**
 * Empty state: no fill, with a subtle border matching the pill outline
 * (`border-white/15`) so the badge stays visible on the dark cockpit.
 */
export const DRIVE_PILL_BADGE_OFF_CLASS =
  "border border-white/15 bg-transparent text-foreground/80";

/** A little extra width so three-letter labels (ON / OFF) stay a pill, not a cramped circle. */
export const DRIVE_PILL_BADGE_WIDE_CLASS = "min-w-[1.35rem] px-1.5";

export function DrivePillBadge({
  children,
  className,
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <span data-testid={testId} className={cn(DRIVE_PILL_BADGE_CLASS, className)}>
      {children}
    </span>
  );
}
