import { cn } from "@/lib/utils";

/**
 * Disco-ball mark for the Viral Epic Party Light Show toggle.
 * Uniform currentColor stroke, rounded caps; visual weight matches the
 * Drive messages / Road Noise Masking icons (~1.2px at h-6).
 */
export function ViralPartyLightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("h-6 w-auto overflow-visible", className)}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Hang from the truss */}
      <path d="M16 3.2 V7.2" />
      <circle cx="16" cy="18" r="9.2" />
      {/* Equator and meridians */}
      <ellipse cx="16" cy="18" rx="9.2" ry="3.1" />
      <ellipse cx="16" cy="18" rx="3.1" ry="9.2" />
      {/* Upper and lower latitudes */}
      <path d="M8.4 13.2 C11.8 11.8 20.2 11.8 23.6 13.2" />
      <path d="M8.4 22.8 C11.8 24.2 20.2 24.2 23.6 22.8" />
    </svg>
  );
}
