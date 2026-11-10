import { cn } from "@/lib/utils";

/**
 * Road Noise Masking mark: a perspective road with the ELCAMOSO ))) waves.
 * Stroke language matches AccountUserIcon and the Drive messages control
 * (currentColor, rounded caps, ~1.6–1.9 stroke in a 32-unit viewBox).
 */
export function RoadNoiseMaskingIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("h-5 w-auto overflow-visible", className)}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Perspective road — wide enough to read at ~20px */}
      <path d="M6.5 27 L13.2 9.5" strokeWidth="1.9" />
      <path d="M25.5 27 L18.8 9.5" strokeWidth="1.9" />
      <path d="M16 25.8 L16 22.4" strokeWidth="1.8" />
      <path d="M16 20.2 L16 17.6" strokeWidth="1.7" />
      <path d="M16 15.6 L16 13.2" strokeWidth="1.6" />
      {/* Brand ))) waves, offset right so they don't hide the road */}
      <path d="M21.2 10.2 C 24 13.2, 24 19.2, 21.2 22.2" strokeWidth="1.6" />
      <path d="M24.6 7.8 C 28.8 12, 28.8 20.4, 24.6 24.6" strokeWidth="1.55" opacity="0.82" />
      <path d="M28 5.6 C 33.4 11.2, 33.4 21.2, 28 26.8" strokeWidth="1.45" opacity="0.62" />
    </svg>
  );
}
