"use client";

import { Lock } from "lucide-react";

import { useNoiseMaskingGate } from "@/lib/drive/useNoiseMaskingGate";
import { cn } from "@/lib/utils";

/** Compact Drive-cockpit control: one switch for the whole Noise masking package. */
export function NoiseMaskingDriveToggle({ className }: { className?: string }) {
  const gate = useNoiseMaskingGate();

  return (
    <>
      <div
        className={cn(
          "flex h-11 min-h-11 items-center justify-between gap-3 rounded-full border border-border px-4",
          className,
        )}
      >
        <button
          type="button"
          className="flex min-w-0 items-center gap-2 text-left"
          onClick={() => {
            if (!gate.allowed) gate.requestChange(() => undefined);
          }}
          aria-label={gate.allowed ? gate.label : `${gate.label} (locked). ${gate.signInRemark}`}
        >
          <span className="truncate text-[11px] tracking-[0.16em] uppercase">{gate.label}</span>
          {gate.allowed ? null : (
            <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          )}
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={gate.masterOn}
          aria-label={gate.label}
          onClick={() =>
            gate.requestChange(() => gate.update({ noiseMasking: !gate.settings.noiseMasking }))
          }
          className={`h-7 w-12 shrink-0 rounded-full border border-border transition-colors ${
            gate.masterOn ? "bg-foreground" : "bg-transparent"
          }`}
        >
          <span
            className={`block h-5 w-5 rounded-full transition-transform ${
              gate.masterOn ? "translate-x-6 bg-background" : "translate-x-1 bg-muted-foreground"
            }`}
          />
        </button>
      </div>
      {gate.dialog}
    </>
  );
}
