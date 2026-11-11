import { useEffect, useRef, useState } from "react";
import {
  isViralPartyLightOn,
  setViralPartyLivePeak,
  subscribeViralPartyLightOn,
  viralPartyFrameAt,
  viralPartyLightPeak,
  VIRAL_PARTY_COLORS,
  VIRAL_PARTY_CONFETTI_COUNT,
  type ColorMix,
  type ViralPartyColor,
} from "@/lib/drive/viral-party-lights";
import { cn } from "@/lib/utils";
import "./viral-party-lights.css";

interface ViralPartyLightShowProps {
  /** metres per second */
  speed: number;
  reducedMotion: boolean;
  className?: string;
}

const EDGE_GRADIENT: Record<"left" | "right" | "top" | "bottom", string> = {
  left: "ellipse at left",
  right: "ellipse at right",
  top: "ellipse at top",
  bottom: "ellipse at bottom",
};

const EDGE_POS: Record<"left" | "right" | "top" | "bottom", string> = {
  left: "absolute inset-y-0 left-0 w-1/2",
  right: "absolute inset-y-0 right-0 w-1/2",
  top: "absolute inset-x-0 top-0 h-1/2",
  bottom: "absolute inset-x-0 bottom-0 h-1/2",
};

const WIDE_POS: Record<"left" | "right" | "top" | "bottom", string> = {
  left: "absolute inset-y-0 left-0 w-[70%]",
  right: "absolute inset-y-0 right-0 w-[70%]",
  top: "absolute inset-x-0 top-0 h-[70%]",
  bottom: "absolute inset-x-0 bottom-0 h-[70%]",
};

const HEX: Record<ViralPartyColor, string> = {
  pink: VIRAL_PARTY_COLORS.pink,
  violet: VIRAL_PARTY_COLORS.violet,
  cyan: VIRAL_PARTY_COLORS.cyan,
  gold: VIRAL_PARTY_COLORS.gold,
};

const EDGES = ["left", "right", "top", "bottom"] as const;
const COLORS: ViralPartyColor[] = ["pink", "violet", "cyan", "gold"];

const CONFETTI = Array.from({ length: VIRAL_PARTY_CONFETTI_COUNT }, (_, i) => ({
  left: `${14 + ((i * 19) % 72)}%`,
  top: `${10 + (i % 5) * 12}%`,
  delay: `${(i * 0.17) % 1.8}s`,
  duration: `${2.2 + (i % 4) * 0.25}s`,
  size: 4 + (i % 3),
}));

function applyMix(nodes: Record<ViralPartyColor, HTMLDivElement | null>, mix: ColorMix) {
  for (const color of COLORS) {
    const node = nodes[color];
    if (node) node.style.opacity = String(mix[color]);
  }
}

/** Soft edge wash + brightness toggle for Viral Epic Party, beat-synced in rAF. */
export function ViralPartyLightShow({ speed, reducedMotion, className }: ViralPartyLightShowProps) {
  const [on, setOn] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const climbRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const layerRefs = useRef({
    left: { pink: null, violet: null, cyan: null, gold: null } as Record<
      ViralPartyColor,
      HTMLDivElement | null
    >,
    right: { pink: null, violet: null, cyan: null, gold: null } as Record<
      ViralPartyColor,
      HTMLDivElement | null
    >,
    top: { pink: null, violet: null, cyan: null, gold: null } as Record<
      ViralPartyColor,
      HTMLDivElement | null
    >,
    bottom: { pink: null, violet: null, cyan: null, gold: null } as Record<
      ViralPartyColor,
      HTMLDivElement | null
    >,
  });

  useEffect(() => {
    const sync = () => setOn(isViralPartyLightOn());
    sync();
    return subscribeViralPartyLightOn(sync);
  }, []);

  const peak = reducedMotion ? 0 : viralPartyLightPeak(on);

  useEffect(() => {
    setViralPartyLivePeak(peak);
  }, [peak]);

  useEffect(() => {
    if (peak <= 0 || typeof requestAnimationFrame === "undefined") return;
    let raf = 0;
    const tick = (now: number) => {
      const kmh = speedRef.current * 3.6;
      const frame = viralPartyFrameAt(now, peak, kmh);
      const layers = layerRefs.current;
      applyMix(layers.left, frame.edges.left);
      applyMix(layers.right, frame.edges.right);
      applyMix(layers.top, frame.edges.top);
      applyMix(layers.bottom, frame.edges.bottom);
      if (climbRef.current) {
        climbRef.current.style.opacity = String(frame.climbOpacity);
        climbRef.current.style.transform = `translate3d(0, ${(1 - frame.climb) * 100}%, 0)`;
      }
      if (confettiRef.current) {
        confettiRef.current.style.opacity = frame.confetti ? "1" : "0";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [peak]);

  return (
    <>
      {peak > 0 ? (
        <div
          ref={rootRef}
          className={cn("pointer-events-none fixed inset-0 overflow-hidden", className)}
          aria-hidden="true"
          data-testid="viral-party-light-show"
        >
          {EDGES.map((edge) =>
            COLORS.map((color) => (
              <div
                key={`${edge}-${color}`}
                ref={(node) => {
                  layerRefs.current[edge][color] = node;
                }}
                className={cn(
                  edge === "left" || edge === "right" ? WIDE_POS[edge] : EDGE_POS[edge],
                )}
                style={{
                  opacity: 0,
                  willChange: "opacity",
                  background: `radial-gradient(${EDGE_GRADIENT[edge]}, ${HEX[color]}99 0%, transparent 72%)`,
                }}
              />
            )),
          )}
          <div
            ref={climbRef}
            className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(to_top,#ff2dad66_0%,#8a2cff55_40%,#00d9ff44_75%,transparent_100%)]"
            style={{
              opacity: 0,
              willChange: "opacity, transform",
              transform: "translate3d(0, 100%, 0)",
            }}
            data-testid="viral-party-climb"
          />
          <div
            ref={confettiRef}
            className="absolute inset-x-0 top-0 h-[40%] overflow-hidden"
            style={{ opacity: 0, willChange: "opacity" }}
            data-testid="viral-party-confetti"
          >
            {CONFETTI.map((speck, i) => (
              <span
                key={i}
                className="viral-party-confetti-speck"
                style={{
                  left: speck.left,
                  top: speck.top,
                  width: speck.size,
                  height: speck.size + 3,
                  animationDelay: speck.delay,
                  animationDuration: speck.duration,
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
