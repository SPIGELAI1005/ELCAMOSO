import { cn } from "@/lib/utils";

type Variant = "full" | "mark" | "wordmark";

interface MarkProps {
  /** 0..1 — how many waves are lit / how far sound radiates */
  intensity?: number | undefined;
  /** 0..1 virtual throttle demand — drives outward radiation */
  throttle?: number | undefined;
  /** 0..1 regeneration — pulls the waves inward and dims them */
  regen?: number | undefined;
  /** profile character: higher = tighter, faster wave motion */
  waveResponse?: number | undefined;
  /** animate waves in on mount */
  animate?: boolean | undefined;
  /** calmer feedback: opacity only, no looping radiation */
  reducedMotion?: boolean | undefined;
  className?: string | undefined;
}

const WAVES = [
  { d: "M40 14 C 52 24, 52 48, 40 58", w: 3.2 },
  { d: "M54 9 C 69 22, 69 50, 54 63", w: 3.0 },
  { d: "M68 4 C 86 20, 86 52, 68 68", w: 2.8 },
];

export function ElcamosoMark({
  intensity = 1,
  throttle = 0,
  regen = 0,
  waveResponse = 1,
  animate = false,
  reducedMotion = false,
  className,
}: MarkProps) {
  const drive = Math.min(1, Math.max(0, throttle));
  const brake = Math.min(1, Math.max(0, regen));
  const live = !reducedMotion && (drive > 0.02 || brake > 0.02);
  const animateIn = animate && !reducedMotion;
  // faster, tighter motion for high-response profiles
  const cycle = 2400 / (0.55 + waveResponse * (0.5 + drive));

  return (
    <svg
      viewBox="0 0 92 72"
      fill="none"
      aria-hidden="true"
      className={cn("h-8 w-auto overflow-visible", className)}
    >
      <circle
        cx="20"
        cy="36"
        r="17"
        stroke="currentColor"
        strokeWidth="3.4"
        style={animateIn ? { animation: "wave-in 400ms ease-out both" } : undefined}
      />
      {WAVES.map((wave, i) => {
        const lit = Math.min(1, Math.max(0, intensity * 3 - i));
        // regen pulls waves in slightly, throttle pushes them out
        const shift = reducedMotion ? 0 : drive * (1.4 + i * 1.1) - brake * (1.2 + i * 0.9);
        return (
          <path
            key={wave.d}
            d={wave.d}
            stroke="currentColor"
            strokeWidth={wave.w}
            strokeLinecap="round"
            style={{
              opacity: (0.1 + lit * 0.9) * (1 - brake * 0.45),
              transform: `translateX(${shift}px)`,
              transformOrigin: "20px 36px",
              transition: reducedMotion
                ? "opacity 400ms ease-out"
                : "opacity 260ms ease-out, transform 220ms ease-out",
              ...(animateIn
                ? { animation: `wave-in 400ms ease-out ${250 + i * 220}ms both` }
                : live
                  ? {
                      animation: `wave-radiate ${Math.round(cycle)}ms ease-out ${i * 130}ms infinite`,
                    }
                  : {}),
            }}
          />
        );
      })}
    </svg>
  );
}


export function ElcamosoWordmark({ className }: { className?: string }) {
  return <span className={cn("wordmark", className)}>Elcamoso</span>;
}

interface LogoProps extends MarkProps {
  variant?: Variant | undefined;
  wordmarkClassName?: string | undefined;
}

export function ElcamosoLogo({
  variant = "full",
  intensity = 1,
  animate = false,
  className,
  wordmarkClassName,
}: LogoProps) {
  if (variant === "mark") {
    return <ElcamosoMark intensity={intensity} animate={animate} className={className} />;
  }
  if (variant === "wordmark") {
    return <ElcamosoWordmark className={cn("text-base", className)} />;
  }
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <ElcamosoMark intensity={intensity} animate={animate} className="h-5 w-auto" />
      <ElcamosoWordmark className={cn("text-sm", wordmarkClassName)} />
    </span>
  );
}

export default ElcamosoLogo;
