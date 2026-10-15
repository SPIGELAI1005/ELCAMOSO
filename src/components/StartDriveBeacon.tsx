import { useReducedMotion } from "@/lib/drive/useReducedMotion";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function StartDriveBeaconLayers() {
  return (
    <>
      <span aria-hidden className="start-drive-beacon__layer start-drive-beacon__halo" />
      <span aria-hidden className="start-drive-beacon__layer start-drive-beacon__bloom" />
      <span aria-hidden className="start-drive-beacon__layer start-drive-beacon__ripple" />
      <span aria-hidden className="start-drive-beacon__layer start-drive-beacon__rim" />
    </>
  );
}

export function StartDriveBeacon({
  children,
  className,
  variant = "pill",
  enabled = true,
  glass = false,
}: {
  children: ReactNode;
  className?: string;
  variant?: "pill" | "pedal";
  enabled?: boolean;
  /** Hollow beacon fill so a glass CTA stays see-through. */
  glass?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const show = enabled && !reducedMotion;

  return (
    <span
      className={cn(
        "start-drive-beacon relative",
        variant === "pedal" ? "block size-full" : "inline-flex",
        variant === "pedal" && "start-drive-beacon--pedal",
        glass && "start-drive-beacon--glass",
        className,
      )}
    >
      {show ? <StartDriveBeaconLayers /> : null}
      {children}
    </span>
  );
}
