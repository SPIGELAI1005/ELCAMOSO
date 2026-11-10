"use client";

import { Lock } from "lucide-react";

import { RoadNoiseMaskingIcon } from "@/components/RoadNoiseMaskingIcon";
import { useNoiseMaskingGate } from "@/lib/drive/useNoiseMaskingGate";
import { cn } from "@/lib/utils";

/** Same chrome as the Drive messages / GPS pill (`data-testid=open-feedback`). */
const PILL_CLASS =
  "relative flex h-10 w-[3.75rem] shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-foreground/80 shadow-[0_0_14px_rgba(229,57,53,0.18)] backdrop-blur-md transition-colors hover:border-[#e53935]/60 hover:text-foreground";

/**
 * Drive-cockpit control: a messages-sized pill for Road Noise Masking,
 * with a GPS-style caption to the left (Road Noise / Masking ON|OFF).
 */
export function NoiseMaskingDriveToggle({
  className,
  previewAllowed = false,
}: {
  className?: string;
  /** Dev/preview only: treat the control as signed-in for layout screenshots. */
  previewAllowed?: boolean;
}) {
  const gate = useNoiseMaskingGate();
  const allowed = gate.allowed || (import.meta.env.DEV && previewAllowed === true);
  const masterOn = allowed && gate.settings.noiseMasking;
  const stateLabel = masterOn ? "ON" : "OFF";
  const aria = allowed
    ? `${gate.label}, ${masterOn ? "on" : "off"}`
    : `${gate.label} (locked). ${gate.signInRemark}`;

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={masterOn}
        aria-label={aria}
        title={gate.label}
        data-testid="road-noise-masking-toggle"
        onClick={() =>
          gate.requestChange(() => gate.update({ noiseMasking: !gate.settings.noiseMasking }))
        }
        className={cn("flex items-center gap-2 bg-transparent p-0 sm:gap-3", className)}
      >
        <span
          data-testid="road-noise-masking-caption"
          className="flex h-10 shrink-0 flex-col justify-center whitespace-nowrap text-right text-[10px] leading-tight tracking-[0.28em] text-muted-foreground"
          aria-hidden
        >
          <span>Road Noise</span>
          <span>
            Masking{" "}
            <span
              className={cn(
                "font-semibold",
                masterOn ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {stateLabel}
            </span>
          </span>
        </span>
        <span
          data-testid="road-noise-masking-pill"
          className={cn(PILL_CLASS, masterOn ? "text-foreground" : "text-foreground/45")}
        >
          <RoadNoiseMaskingIcon className="h-6 w-auto" />
          {allowed ? null : (
            <span
              data-testid="road-noise-masking-lock"
              aria-hidden
              className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-white/25 bg-background/90 text-foreground shadow-[0_0_8px_rgba(0,0,0,0.35)]"
            >
              <Lock className="h-2.5 w-2.5" strokeWidth={2.4} />
            </span>
          )}
        </span>
      </button>
      {gate.dialog}
    </>
  );
}
