import { sampleDriveFxSpeed } from "@/lib/drive/car-fx";
import { useEffect, useRef, useState } from "react";
import {
  getPoliceLightLevel,
  nextPoliceLightLevel,
  advancePolicePhase,
  policeLightOpacity,
  policeLightPair,
  setPoliceLightLevel,
  type PoliceLightLevel,
} from "@/lib/drive/police-lights";
import { cn } from "@/lib/utils";

interface PoliceLightShowProps {
  /** metres per second */
  speed: number;
  reducedMotion: boolean;
  className?: string;
}

const LABEL: Record<PoliceLightLevel, string> = { "60": "Lights 60%", "85": "Lights 85%", off: "Lights off" };

/** Soft red/blue glow at the screen edges for the Police Patrol sound; pulses faster with speed. */
export function PoliceLightShow({ speed, reducedMotion, className }: PoliceLightShowProps) {
  const [level, setLevel] = useState<PoliceLightLevel>("60");
  const redRef = useRef<HTMLDivElement>(null);
  const blueRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => setLevel(getPoliceLightLevel()), []);

  const peak = reducedMotion ? 0 : policeLightOpacity(level);

  useEffect(() => {
    if (peak <= 0 || typeof requestAnimationFrame === "undefined") return;
    let raf = 0;
    const tick = (now: number) => {
      const phase = advancePolicePhase(now, sampleDriveFxSpeed(now, speedRef.current * 3.6), 0);
      const { red, blue } = policeLightPair(phase);
      if (redRef.current) redRef.current.style.opacity = String(red * peak);
      if (blueRef.current) blueRef.current.style.opacity = String(blue * peak);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [peak]);

  return (
    <>
      {peak > 0 ? (
        <div className={cn("pointer-events-none fixed inset-0 overflow-hidden", className)} aria-hidden="true" data-testid="police-light-show">
          <div
            ref={redRef}
            className="absolute inset-y-0 left-0 w-1/2 bg-[radial-gradient(ellipse_at_left,oklch(0.6_0.24_27_/_55%)_0%,transparent_70%)]"
            style={{ opacity: 0 }}
          />
          <div
            ref={blueRef}
            className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(ellipse_at_right,oklch(0.55_0.22_262_/_55%)_0%,transparent_70%)]"
            style={{ opacity: 0 }}
          />
        </div>
      ) : null}
      {reducedMotion ? null : (
        <button
          type="button"
          onClick={() => {
            const next = nextPoliceLightLevel(level);
            setLevel(next);
            setPoliceLightLevel(next);
          }}
          className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-[2] rounded-full border border-border bg-background/70 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur"
          aria-label={`Police lights: ${LABEL[level]}. Tap to change.`}
          data-testid="police-light-toggle"
        >
          {LABEL[level]}
        </button>
      )}
    </>
  );
}
