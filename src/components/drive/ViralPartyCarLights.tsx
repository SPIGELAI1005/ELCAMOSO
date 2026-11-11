import { useEffect, useRef } from "react";
import {
  getViralPartyLivePeak,
  viralPartyFrameAt,
  VIRAL_PARTY_COLORS,
  VIRAL_PARTY_HEADLIGHTS,
  VIRAL_PARTY_HERO_SIZE,
  VIRAL_PARTY_SPOTS,
  VIRAL_PARTY_UNDERGLOW,
  type ViralPartyColor,
} from "@/lib/drive/viral-party-lights";
import { cn } from "@/lib/utils";

interface ViralPartyCarLightsProps {
  /** metres per second */
  speed: number;
  reducedMotion: boolean;
  className?: string;
}

const COLORS: ViralPartyColor[] = ["pink", "violet", "cyan", "gold"];

const FILL: Record<ViralPartyColor, { hot: string; mid: string; edge: string }> = {
  pink: {
    hot: VIRAL_PARTY_COLORS.pinkSoft,
    mid: VIRAL_PARTY_COLORS.pink,
    edge: VIRAL_PARTY_COLORS.pink,
  },
  violet: {
    hot: VIRAL_PARTY_COLORS.violetSoft,
    mid: VIRAL_PARTY_COLORS.violet,
    edge: VIRAL_PARTY_COLORS.violet,
  },
  cyan: {
    hot: VIRAL_PARTY_COLORS.cyanSoft,
    mid: VIRAL_PARTY_COLORS.cyan,
    edge: VIRAL_PARTY_COLORS.cyan,
  },
  gold: {
    hot: VIRAL_PARTY_COLORS.goldSoft,
    mid: VIRAL_PARTY_COLORS.gold,
    edge: VIRAL_PARTY_COLORS.gold,
  },
};

/**
 * Headlight, underglow and stage-beam washes over the Viral Epic Party still.
 * Framing matches DriveProfileBackdrop (contain with padding, cover at 4/3)
 * so the glows stay on the car. Only layer opacity is animated, like PoliceRoofLights.
 */
export function ViralPartyCarLights({ speed, reducedMotion, className }: ViralPartyCarLightsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  useEffect(() => {
    if (reducedMotion || typeof requestAnimationFrame === "undefined") return;
    let raf = 0;
    const tick = (now: number) => {
      const peak = getViralPartyLivePeak();
      const frame = viralPartyFrameAt(now, peak, speedRef.current * 3.6);
      const root = rootRef.current;
      if (root) {
        for (const color of COLORS) {
          const opacity = String(frame.car[color]);
          root.querySelectorAll<SVGSVGElement>(`.viral-party-car-${color}`).forEach((node) => {
            node.style.opacity = opacity;
          });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  if (reducedMotion) return null;

  const layer = (color: ViralPartyColor, aspect: string) => {
    const { hot, mid, edge } = FILL[color];
    const hid = `vpl-h-${color}-${aspect.replace(/ /g, "-")}`;
    const uid = `vpl-u-${color}-${aspect.replace(/ /g, "-")}`;
    const sid = `vpl-s-${color}-${aspect.replace(/ /g, "-")}`;
    return (
      <svg
        viewBox={`0 0 ${VIRAL_PARTY_HERO_SIZE.w} ${VIRAL_PARTY_HERO_SIZE.h}`}
        preserveAspectRatio={aspect}
        className={`viral-party-car-${color} absolute inset-0 h-full w-full`}
        style={{ opacity: 0, willChange: "opacity" }}
      >
        <defs>
          <radialGradient id={hid}>
            <stop offset="0%" stopColor={hot} stopOpacity="0.95" />
            <stop offset="40%" stopColor={mid} stopOpacity="0.85" />
            <stop offset="100%" stopColor={edge} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={uid}>
            <stop offset="0%" stopColor={hot} stopOpacity="0.8" />
            <stop offset="55%" stopColor={mid} stopOpacity="0.55" />
            <stop offset="100%" stopColor={edge} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={sid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={hot} stopOpacity="0.7" />
            <stop offset="35%" stopColor={mid} stopOpacity="0.28" />
            <stop offset="100%" stopColor={edge} stopOpacity="0" />
          </linearGradient>
        </defs>
        {VIRAL_PARTY_UNDERGLOW.map((e, i) => (
          <ellipse
            key={`u-${i}`}
            cx={e.cx}
            cy={e.cy}
            rx={e.rx * 1.15}
            ry={e.ry * 2.4}
            fill={`url(#${uid})`}
          />
        ))}
        <ellipse
          cx={VIRAL_PARTY_HEADLIGHTS.glow.cx}
          cy={VIRAL_PARTY_HEADLIGHTS.glow.cy}
          rx={VIRAL_PARTY_HEADLIGHTS.glow.rx}
          ry={VIRAL_PARTY_HEADLIGHTS.glow.ry}
          fill={`url(#${hid})`}
          opacity={0.55}
        />
        {VIRAL_PARTY_HEADLIGHTS.lamps.map((e, i) => (
          <ellipse
            key={`h-${i}`}
            cx={e.cx}
            cy={e.cy}
            rx={e.rx * 1.6}
            ry={e.ry * 2.2}
            fill={`url(#${hid})`}
          />
        ))}
        {VIRAL_PARTY_SPOTS.map((s, i) => (
          <g key={`s-${i}`}>
            <ellipse
              cx={s.cx}
              cy={s.cy}
              rx={s.rx * 1.8}
              ry={s.ry * 1.8}
              fill={`url(#${hid})`}
              opacity={0.7}
            />
            <polygon
              fill={`url(#${sid})`}
              points={`${s.cx - s.rx},${s.cy} ${s.cx + s.rx},${s.cy} ${s.cx + s.rx * 2.8},${s.cy + s.beam} ${s.cx - s.rx * 2.8},${s.cy + s.beam}`}
            />
          </g>
        ))}
      </svg>
    );
  };

  const stack = (aspect: string) => COLORS.map((color) => layer(color, aspect));

  return (
    <div
      ref={rootRef}
      className={cn("pointer-events-none fixed inset-0 overflow-hidden", className)}
      aria-hidden="true"
      data-testid="viral-party-car-lights"
    >
      <div className="absolute inset-0 px-2 sm:px-4 md:px-8 lg:px-10 [@media(min-aspect-ratio:4/3)]:hidden">
        <div className="relative h-full w-full">{stack("xMidYMid meet")}</div>
      </div>
      <div className="absolute inset-0 hidden [@media(min-aspect-ratio:4/3)]:block">
        {stack("xMidYMid slice")}
      </div>
    </div>
  );
}
