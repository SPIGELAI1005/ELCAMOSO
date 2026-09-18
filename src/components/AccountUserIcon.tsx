import { MARK_IDLE_RADIATE_CYCLE_MS } from "@/components/ElcamosoLogo";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";
import { cn } from "@/lib/utils";

interface AccountUserIconProps {
  className?: string;
}

const WAVES = [
  {
    d: "M16.6 3.7 C 19.4 5.5, 19.4 9.5, 16.6 11.3",
    w: 1.55,
    baseOpacity: 0.95,
  },
  {
    d: "M20.6 2.1 C 24.4 4.7, 24.4 10.3, 20.6 12.9",
    w: 1.5,
    baseOpacity: 0.72,
  },
  {
    d: "M24.6 0.6 C 29.4 4.0, 29.4 11.0, 24.6 14.4",
    w: 1.4,
    baseOpacity: 0.48,
  },
] as const;

const WAVE_STAGGER_MS = 130;

/**
 * Account trigger mark: user silhouette whose head is the ELCAMOSO O ))) .
 */
export function AccountUserIcon({ className }: AccountUserIconProps) {
  const reducedMotion = useReducedMotion();

  return (
    <svg
      viewBox="0 0 32 24"
      fill="none"
      aria-hidden="true"
      className={cn("h-5 w-auto overflow-visible", className)}
    >
      {/* Head as O */}
      <circle cx="9.5" cy="7.5" r="4.1" stroke="currentColor" strokeWidth="1.6" />
      {/* ))) waves - same idle radiate pulse as the brand mark */}
      {WAVES.map((wave, i) => (
        <path
          key={wave.d}
          d={wave.d}
          stroke="currentColor"
          strokeWidth={wave.w}
          strokeLinecap="round"
          style={
            reducedMotion
              ? { opacity: wave.baseOpacity }
              : {
                  opacity: wave.baseOpacity,
                  animation: `wave-radiate ${MARK_IDLE_RADIATE_CYCLE_MS}ms ease-out ${i * WAVE_STAGGER_MS}ms infinite`,
                }
          }
        />
      ))}
      {/* Shoulders */}
      <path
        d="M3.7 20.2 C 3.7 15.6, 6.1 13.4, 9.5 13.4 C 12.9 13.4, 15.3 15.6, 15.3 20.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
