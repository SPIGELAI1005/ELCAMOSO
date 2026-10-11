import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { ElcamosoMark } from "@/components/ElcamosoLogo";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";
import type { PublicClaimView, SoundSpinPublicStatus } from "@/lib/rewards/types";

export interface SoundSpinWheelProps {
  status: SoundSpinPublicStatus;
  busy: boolean;
  onClaim: () => void;
  /** Server-recorded claim; animation never chooses the prize. */
  revealedClaim: PublicClaimView | null;
}

const DECORATIVE_SEGMENTS = 8;

/**
 * Visual Sound Spin wheel. Segment sizes are decorative — odds come from
 * `status.displayedOdds`. The server records the outcome before animation.
 */
export function SoundSpinWheel({ status, busy, onClaim, revealedClaim }: SoundSpinWheelProps) {
  const reducedMotion = useReducedMotion();
  const labelId = useId();
  const resultId = useId();
  const [spinning, setSpinning] = useState(false);
  const [rotationDeg, setRotationDeg] = useState(0);
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (spinTimer.current) clearTimeout(spinTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!revealedClaim) return;
    if (reducedMotion) {
      setSpinning(false);
      return;
    }
    setSpinning(true);
    // Decorative spin only — landing angle is not mapped to prize probability.
    setRotationDeg((prev) => prev + 1080 + Math.floor(Math.random() * 120));
    if (spinTimer.current) clearTimeout(spinTimer.current);
    spinTimer.current = setTimeout(() => setSpinning(false), 1800);
  }, [revealedClaim?.claimId, reducedMotion]);

  const canClaim =
    status.claimingEnabled && !status.alreadyClaimed && !busy && !revealedClaim;

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (canClaim) onClaim();
    }
  }

  const resultLabel = revealedClaim?.outcome.label ?? null;

  return (
    <section
      className="mx-auto flex w-full max-w-lg flex-col items-center gap-8 px-4"
      aria-labelledby={labelId}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <ElcamosoMark className="h-10 w-10 text-foreground" />
        <h1
          id={labelId}
          className="font-[family-name:var(--font-display)] text-3xl tracking-[0.28em] text-foreground uppercase"
        >
          Sound Spin
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {status.campaign?.description ??
            "Monthly free spin for verified accounts. No paid spins."}
        </p>
      </div>

      <div
        className="relative aspect-square w-full max-w-[280px]"
        role="img"
        aria-label="Decorative Sound Spin wheel. Odds are listed below; segments are not sized to probability."
      >
        <div
          className="absolute inset-0 rounded-full border border-foreground/25 bg-[radial-gradient(circle_at_50%_40%,#1a1a1a_0%,#000_70%)] shadow-[inset_0_0_40px_rgba(245,245,247,0.06)] transition-transform duration-[1800ms] ease-out motion-reduce:transition-none"
          style={{
            transform: `rotate(${rotationDeg}deg)`,
            backgroundImage: decorativeConic(),
          }}
          data-spinning={spinning ? "true" : "false"}
        />
        <div className="pointer-events-none absolute inset-[18%] rounded-full border border-foreground/15 bg-black/80" />
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1">
          <div className="h-0 w-0 border-x-[8px] border-x-transparent border-t-[14px] border-t-foreground" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] tracking-[0.35em] text-foreground/70 uppercase">O )))</span>
        </div>
      </div>

      <div
        id={resultId}
        role="status"
        aria-live="polite"
        className="min-h-[3.5rem] text-center"
      >
        {resultLabel ? (
          <p className="text-base text-foreground">
            You received: <span className="font-medium">{resultLabel}</span>
          </p>
        ) : status.alreadyClaimed && status.claim ? (
          <p className="text-base text-foreground">
            This month&apos;s reward:{" "}
            <span className="font-medium">{status.claim.outcome.label}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Claim records your reward on the server first. Reloading never rerolls.
          </p>
        )}
      </div>

      <button
        type="button"
        className="inline-flex h-12 min-w-[12rem] items-center justify-center rounded-full border border-foreground/30 bg-foreground px-8 text-[11px] tracking-[0.2em] text-background uppercase transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canClaim}
        onClick={onClaim}
        onKeyDown={handleKeyDown}
        aria-describedby={resultId}
      >
        {busy ? "Claiming…" : status.alreadyClaimed || revealedClaim ? "Claimed" : "Claim free spin"}
      </button>
    </section>
  );
}

function decorativeConic(): string {
  const stops: string[] = [];
  for (let i = 0; i < DECORATIVE_SEGMENTS; i++) {
    const start = (i / DECORATIVE_SEGMENTS) * 360;
    const end = ((i + 1) / DECORATIVE_SEGMENTS) * 360;
    const tone = i % 2 === 0 ? "#141414" : "#0a0a0a";
    stops.push(`${tone} ${start}deg ${end}deg`);
  }
  return `conic-gradient(from -90deg, ${stops.join(", ")})`;
}
