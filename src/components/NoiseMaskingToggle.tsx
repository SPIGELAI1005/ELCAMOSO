"use client";

import { Lock } from "lucide-react";

import { RoadNoiseMaskingIcon } from "@/components/RoadNoiseMaskingIcon";
import { useNoiseMaskingGate } from "@/lib/drive/useNoiseMaskingGate";
import { cn } from "@/lib/utils";

/**
 * Drive-cockpit control: a round icon button for the whole Road Noise Masking
 * package, styled to match the header messages / profile icon cluster.
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
        className={cn(
          "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border backdrop-blur-md transition-colors",
          masterOn
            ? "border-[#e53935]/70 bg-white/[0.12] text-foreground shadow-[0_0_14px_rgba(229,57,53,0.18)]"
            : "border-white/15 bg-white/[0.06] text-foreground/45",
          "hover:border-[#e53935]/60 hover:text-foreground",
          className,
        )}
      >
        <RoadNoiseMaskingIcon className="h-5 w-auto" />
        {allowed ? null : (
          <span
            data-testid="road-noise-masking-lock"
            aria-hidden
            className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-white/25 bg-background/90 text-foreground shadow-[0_0_8px_rgba(0,0,0,0.35)]"
          >
            <Lock className="h-2.5 w-2.5" strokeWidth={2.4} />
          </span>
        )}
      </button>
      {gate.dialog}
    </>
  );
}
