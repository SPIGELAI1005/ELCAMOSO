import { cn } from "@/lib/utils";

/**
 * Road Noise Masking mark, traced from George's artwork:
 * one diagonal road edge, a 3-dash center line, and three ))) arcs.
 * Uniform currentColor stroke, rounded caps; weight matches the Drive
 * messages icon (~1.13px when rendered at h-6).
 *
 * Coordinates are in a 1024×1024 design space (tightened viewBox).
 */
export function RoadNoiseMaskingIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="70 180 860 630"
      fill="none"
      aria-hidden="true"
      className={cn("h-6 w-auto overflow-visible", className)}
      stroke="currentColor"
      strokeWidth="31"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Road edge, bottom-left up to top-center-left */}
      <path d="M99 762.5 L352 212.5" />
      {/* Vertical dashed center line */}
      <path d="M392 289 L392 391" />
      <path d="M392 465 L392 564" />
      <path d="M392 641 L392 741" />
      {/* ))) arcs of increasing size, opening left */}
      <path d="M480.3 368.9 A134.1 134.1 0 0 1 482.1 627.5" />
      <path d="M595.1 278.4 A230.7 230.7 0 0 1 597.7 699.9" />
      <path d="M745.3 231.6 A301 301 0 0 1 752.3 740" />
    </svg>
  );
}
