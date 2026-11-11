import { useEffect, useRef } from "react";
import {
  getViralPartyLivePeak,
  viralPartyFrameAt,
  VIRAL_PARTY_BEAM_CLIP_Y,
  VIRAL_PARTY_COLORS,
  VIRAL_PARTY_HERO_SIZE,
  VIRAL_PARTY_LEFT_SPOTS,
  VIRAL_PARTY_RIGHT_SPOTS,
  type ViralPartyColor,
} from "@/lib/drive/viral-party-lights";
import { cn } from "@/lib/utils";

interface ViralPartyStageLightsProps {
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

type Spot = (typeof VIRAL_PARTY_LEFT_SPOTS)[number];

/**
 * Soft, feathered colour washes over the background stage lights only.
 * Beams are clipped above the crowd / car line so nothing lights up on the
 * vehicle. Framing matches DriveProfileBackdrop (contain with padding, cover
 * at 4/3). Only layer opacity is animated.
 */
export function ViralPartyStageLights({
  speed,
  reducedMotion,
  className,
}: ViralPartyStageLightsProps) {
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
          const left = String(frame.beams.left[color]);
          const right = String(frame.beams.right[color]);
          root
            .querySelectorAll<SVGSVGElement>(`.viral-party-beam-left-${color}`)
            .forEach((node) => {
              node.style.opacity = left;
            });
          root
            .querySelectorAll<SVGSVGElement>(`.viral-party-beam-right-${color}`)
            .forEach((node) => {
              node.style.opacity = right;
            });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  if (reducedMotion) return null;

  const spotsOf = (side: "left" | "right") =>
    side === "left" ? VIRAL_PARTY_LEFT_SPOTS : VIRAL_PARTY_RIGHT_SPOTS;

  const layer = (side: "left" | "right", color: ViralPartyColor, aspect: string) => {
    const { hot, mid, edge } = FILL[color];
    const token = `${side}-${color}-${aspect.replace(/ /g, "-")}`;
    const bloomId = `vpl-bloom-${token}`;
    const shaftId = `vpl-shaft-${token}`;
    const clipId = `vpl-clip-${token}`;
    return (
      <svg
        viewBox={`0 0 ${VIRAL_PARTY_HERO_SIZE.w} ${VIRAL_PARTY_HERO_SIZE.h}`}
        preserveAspectRatio={aspect}
        className={`viral-party-beam-${side}-${color} absolute inset-0 h-full w-full`}
        style={{ opacity: 0, willChange: "opacity" }}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={VIRAL_PARTY_HERO_SIZE.w} height={VIRAL_PARTY_BEAM_CLIP_Y} />
          </clipPath>
          <radialGradient id={bloomId}>
            <stop offset="0%" stopColor={hot} stopOpacity="0.42" />
            <stop offset="40%" stopColor={mid} stopOpacity="0.16" />
            <stop offset="100%" stopColor={edge} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={shaftId} cx="50%" cy="0%" r="80%">
            <stop offset="0%" stopColor={hot} stopOpacity="0.16" />
            <stop offset="35%" stopColor={mid} stopOpacity="0.07" />
            <stop offset="100%" stopColor={edge} stopOpacity="0" />
          </radialGradient>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          {spotsOf(side).map((spot: Spot, i: number) => {
            const maxLen = Math.max(40, VIRAL_PARTY_BEAM_CLIP_Y - spot.cy - 16);
            const beamLen = Math.min(spot.beam, maxLen);
            return (
              <g key={`${side}-${i}`}>
                <ellipse
                  cx={spot.cx}
                  cy={spot.cy}
                  rx={spot.rx * 2.4}
                  ry={spot.ry * 2.2}
                  fill={`url(#${bloomId})`}
                />
                <ellipse
                  cx={spot.cx}
                  cy={spot.cy + beamLen * 0.36}
                  rx={Math.max(36, spot.rx * 2.6)}
                  ry={beamLen * 0.42}
                  fill={`url(#${shaftId})`}
                />
              </g>
            );
          })}
        </g>
      </svg>
    );
  };

  const stack = (aspect: string) =>
    (["left", "right"] as const).flatMap((side) =>
      COLORS.map((color) => layer(side, color, aspect)),
    );

  return (
    <div
      ref={rootRef}
      className={cn("pointer-events-none fixed inset-0 overflow-hidden", className)}
      aria-hidden="true"
      data-testid="viral-party-stage-lights"
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
