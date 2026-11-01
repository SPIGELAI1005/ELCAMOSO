import { sampleDriveFxSpeed } from "@/lib/drive/car-fx";
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
      const { red, blue } = policeLightPair(advancePolicePhase(now, sampleDriveFxSpeed(now, speedRef.current * 3.6), 0));
      rootRef.current?.querySelectorAll<SVGSVGElement>(".police-roof-red").forEach((g) => (g.style.opacity = String(red)));
      rootRef.current?.querySelectorAll<SVGSVGElement>(".police-roof-blue").forEach((g) => (g.style.opacity = String(blue)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  if (reducedMotion) return null;
  const { red, blue } = POLICE_ROOF_BAR;
  // One composited layer per colour: the flash only changes element opacity (no SVG repaint),
  // which keeps the main thread free on weak in-car CPUs.
  const layer = (color: "red" | "blue", aspect: string) => {
    const e = color === "red" ? red : blue;
    const id = `pr-${color}-${aspect.replace(" ", "-")}`;
    const [hot, mid, edge] = color === "red" ? ["#fff2f2", "#ff2a2a", "#ff0000"] : ["#f2f6ff", "#2a5bff", "#0030ff"];
    return (
      <svg
        viewBox={`0 0 ${POLICE_HERO_SIZE.w} ${POLICE_HERO_SIZE.h}`}
        preserveAspectRatio={aspect}
        className={`police-roof-${color} absolute inset-0 h-full w-full`}
        style={{ opacity: 0, willChange: "opacity" }}
      >
        <defs>
          <radialGradient id={id}>
            <stop offset="0%" stopColor={hot} stopOpacity="0.95" />
            <stop offset="35%" stopColor={mid} stopOpacity="0.85" />
            <stop offset="100%" stopColor={edge} stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx={e.cx} cy={e.cy} rx={e.rx * 2.2} ry={e.ry * 5} fill={`url(#${id})`} opacity={0.45} />
        <ellipse cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} fill={`url(#${id})`} />
      </svg>
    );
  };
  const svg = (aspect: string, extra: string) => (
    <div className={cn("absolute inset-0", extra)}>
      {layer("red", aspect)}
      {layer("blue", aspect)}
    </div>
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
