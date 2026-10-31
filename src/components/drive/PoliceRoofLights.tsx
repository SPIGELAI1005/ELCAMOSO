import { useEffect, useRef } from "react";
import { advancePolicePhase, policeLightPair, POLICE_HERO_SIZE, POLICE_ROOF_BAR } from "@/lib/drive/police-lights";
import { cn } from "@/lib/utils";

interface PoliceRoofLightsProps {
  /** metres per second */
  speed: number;
  reducedMotion: boolean;
  className?: string;
}

/**
 * Animated red/blue glow over the light bar of the Police Patrol backdrop. Uses the same
 * framing as DriveProfileBackdrop (contain with padding, cover on xl) via SVG viewBox, and the
 * shared flash clock so it pulses in sync with the screen-edge light show. Static under reduced motion.
 */
export function PoliceRoofLights({ speed, reducedMotion, className }: PoliceRoofLightsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    if (reducedMotion || typeof requestAnimationFrame === "undefined") return;
    let raf = 0;
    const tick = (now: number) => {
      const { red, blue } = policeLightPair(advancePolicePhase(now, speedRef.current * 3.6));
      rootRef.current?.querySelectorAll<SVGGElement>(".police-roof-red").forEach((g) => (g.style.opacity = String(red)));
      rootRef.current?.querySelectorAll<SVGGElement>(".police-roof-blue").forEach((g) => (g.style.opacity = String(blue)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  if (reducedMotion) return null;
  const { red, blue } = POLICE_ROOF_BAR;
  const svg = (aspect: string, extra: string) => (
    <svg
      viewBox={`0 0 ${POLICE_HERO_SIZE.w} ${POLICE_HERO_SIZE.h}`}
      preserveAspectRatio={aspect}
      className={cn("absolute inset-0 h-full w-full mix-blend-screen", extra)}
    >
      <defs>
        <radialGradient id={`pr-red-${aspect.replace(" ", "-")}`}>
          <stop offset="0%" stopColor="#fff2f2" stopOpacity="0.95" />
          <stop offset="35%" stopColor="#ff2a2a" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ff0000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`pr-blue-${aspect.replace(" ", "-")}`}>
          <stop offset="0%" stopColor="#f2f6ff" stopOpacity="0.95" />
          <stop offset="35%" stopColor="#2a5bff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#0030ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="police-roof-red" style={{ opacity: 0 }}>
        <ellipse cx={red.cx} cy={red.cy} rx={red.rx * 2.2} ry={red.ry * 5} fill={`url(#pr-red-${aspect.replace(" ", "-")})`} opacity={0.45} />
        <ellipse cx={red.cx} cy={red.cy} rx={red.rx} ry={red.ry} fill={`url(#pr-red-${aspect.replace(" ", "-")})`} />
      </g>
      <g className="police-roof-blue" style={{ opacity: 0 }}>
        <ellipse cx={blue.cx} cy={blue.cy} rx={blue.rx * 2.2} ry={blue.ry * 5} fill={`url(#pr-blue-${aspect.replace(" ", "-")})`} opacity={0.45} />
        <ellipse cx={blue.cx} cy={blue.cy} rx={blue.rx} ry={blue.ry} fill={`url(#pr-blue-${aspect.replace(" ", "-")})`} />
      </g>
    </svg>
  );
  return (
    <div ref={rootRef} className={cn("pointer-events-none fixed inset-0 overflow-hidden", className)} aria-hidden="true" data-testid="police-roof-lights">
      {/* contain framing with padding (matches backdrop below xl) */}
      <div className="absolute inset-0 px-2 sm:px-4 md:px-8 lg:px-10 xl:hidden">
        <div className="relative h-full w-full">{svg("xMidYMid meet", "")}</div>
      </div>
      {/* cover framing on xl */}
      <div className="absolute inset-0 hidden xl:block">{svg("xMidYMid slice", "")}</div>
    </div>
  );
}
