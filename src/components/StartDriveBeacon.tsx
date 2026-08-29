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
}: {
  children: ReactNode;
  className?: string;
  variant?: "pill" | "pedal";
  enabled?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const show = enabled && !reducedMotion;

  return (
    <span
      className={cn(
        "start-drive-beacon relative",
        variant === "pedal" ? "block size-full" : "inline-flex",
        variant === "pedal" && "start-drive-beacon--pedal",
        className,
      )}
    >
      {show ? <StartDriveBeaconLayers /> : null}
      {children}
    </span>
  );
}
