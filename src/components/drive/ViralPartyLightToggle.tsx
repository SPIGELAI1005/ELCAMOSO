"use client";

import { useEffect, useState } from "react";

import {
  DRIVE_PILL_BADGE_OFF_CLASS,
  DRIVE_PILL_BADGE_ON_CLASS,
  DRIVE_PILL_BADGE_WIDE_CLASS,
  DrivePillBadge,
} from "@/components/drive/DrivePillBadge";
import { ViralPartyLightIcon } from "@/components/drive/ViralPartyLightIcon";
import {
  isViralPartyLightOn,
  setViralPartyLightOn,
  subscribeViralPartyLightOn,
} from "@/lib/drive/viral-party-lights";
import { cn } from "@/lib/utils";

/** Same chrome as the Drive messages / Road Noise Masking pill. */
const PILL_CLASS =
  "relative flex h-10 w-[3.75rem] shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-foreground/80 shadow-[0_0_14px_rgba(229,57,53,0.18)] backdrop-blur-md transition-colors hover:border-[#e53935]/60 hover:text-foreground";

/**
 * Drive-cockpit control for the Viral Epic Party light show: a messages-sized
 * pill with a two-line Light / Show caption on the left and an ON/OFF status
 * bubble on the upper-right of the pill, matching Road Noise Masking.
 */
export function ViralPartyLightToggle({
  reducedMotion,
  className,
}: {
  reducedMotion: boolean;
  className?: string;
}) {
  const [storedOn, setStoredOn] = useState(true);

  useEffect(() => {
    const sync = () => setStoredOn(isViralPartyLightOn());
    sync();
    return subscribeViralPartyLightOn(sync);
  }, []);

  const visualOn = !reducedMotion && storedOn;
  const aria = reducedMotion
    ? "Light Show, off. The light show is disabled when reduced motion is on."
    : `Light Show, ${visualOn ? "on" : "off"}`;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={visualOn}
      aria-label={aria}
      title="Light Show"
      disabled={reducedMotion}
      data-testid="viral-party-light-toggle"
      onClick={() => {
        if (reducedMotion) return;
        setViralPartyLightOn(!storedOn);
      }}
      className={cn(
        "flex items-center gap-2 bg-transparent p-0 sm:gap-3",
        reducedMotion && "cursor-not-allowed opacity-70",
        className,
      )}
    >
      <span
        data-testid="viral-party-light-caption"
        className="flex h-10 shrink-0 flex-col justify-center whitespace-nowrap text-right text-[10px] leading-tight tracking-[0.28em] text-muted-foreground"
        aria-hidden
      >
        <span>Light</span>
        <span>Show</span>
      </span>
      <span
        data-testid="viral-party-light-pill"
        className={cn(
          PILL_CLASS,
          visualOn ? "text-foreground" : "text-foreground/45",
          reducedMotion && "hover:border-white/15 hover:text-foreground/45",
        )}
      >
        <ViralPartyLightIcon />
        <DrivePillBadge
          testId="viral-party-light-badge"
          className={cn(
            DRIVE_PILL_BADGE_WIDE_CLASS,
            visualOn ? DRIVE_PILL_BADGE_ON_CLASS : DRIVE_PILL_BADGE_OFF_CLASS,
          )}
        >
          {visualOn ? "ON" : "OFF"}
        </DrivePillBadge>
      </span>
    </button>
  );
}
