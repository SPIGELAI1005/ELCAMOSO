import { cn } from "@/lib/utils";

type Variant = "full" | "mark" | "wordmark";

interface MarkProps {
  /** 0..1 — how many waves are lit / how far sound radiates */
  intensity?: number | undefined;
  /** animate waves in on mount */
  animate?: boolean | undefined;
  className?: string | undefined;
}

const WAVES = [
  { d: "M40 14 C 52 24, 52 48, 40 58", w: 3.2 },
  { d: "M54 9 C 69 22, 69 50, 54 63", w: 3.0 },
  { d: "M68 4 C 86 20, 86 52, 68 68", w: 2.8 },
];

export function ElcamosoMark({ intensity = 1, animate = false, className }: MarkProps) {
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
        style={animate ? { animation: "wave-in 400ms ease-out both" } : undefined}
      />
      {WAVES.map((wave, i) => {
        const lit = Math.min(1, Math.max(0, intensity * 3 - i));
        return (
          <path
            key={wave.d}
            d={wave.d}
            stroke="currentColor"
            strokeWidth={wave.w}
            strokeLinecap="round"
            style={{
              opacity: 0.12 + lit * 0.88,
              transition: "opacity 260ms ease-out",
              ...(animate
                ? { animation: `wave-in 400ms ease-out ${250 + i * 220}ms both` }
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
