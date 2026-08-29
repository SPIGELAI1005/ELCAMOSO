import { cn } from "@/lib/utils";

/**
 * Mobile menu toggle derived from the O ))) mark.
 * Closed → open: waves fold inward, then a clean X resolves.
 * Open → closed: X dissolves, mark radiates back out.
 */
export function WaveMenuIcon({ open = false, className }: { open?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 40"
      fill="none"
      aria-hidden="true"
      data-open={open ? "true" : "false"}
      className={cn("menu-mark h-8 w-9 text-foreground", className)}
    >
      <g className="menu-mark-closed">
        <circle
          className="menu-mark-source"
          cx="11"
          cy="20"
          r="8.5"
          stroke="currentColor"
          strokeWidth="2.6"
        />
        <path
          className="menu-mark-wave menu-mark-wave-1"
          d="M22 11 C 29 16.5, 29 23.5, 22 29"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          className="menu-mark-wave menu-mark-wave-2"
          d="M29 7.5 C 38 14.5, 38 25.5, 29 32.5"
          stroke="currentColor"
          strokeWidth="2.35"
          strokeLinecap="round"
        />
        <path
          className="menu-mark-wave menu-mark-wave-3"
          d="M36 4 C 47.5 13, 47.5 27, 36 36"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </g>

      <g className="menu-mark-open">
        <path
          className="menu-mark-x menu-mark-x-a"
          d="M14 10 L34 30"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          className="menu-mark-x menu-mark-x-b"
          d="M34 10 L14 30"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
