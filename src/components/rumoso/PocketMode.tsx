import { useEffect, useRef, useState } from "react";

import { zoneForEffort } from "@/lib/rumoso/colors";
import { formatDistanceKm, formatDuration, formatPace } from "@/lib/rumoso/gps-pace";
import { POCKET_UNLOCK_HOLD_MS, pocketUnlockProgress, pocketUnlockReady } from "@/lib/rumoso/pocket-mode";
import { SCREEN_LOCK_LIMIT_NOTE } from "@/lib/rumoso/wake-lock";

import { RumosoIcon, ZoneFigure } from "./RumosoIcon";

export function PocketMode({
  elapsedMs,
  distanceM,
  paceSec,
  effort,
  onUnlock,
}: {
  elapsedMs: number;
  distanceM: number;
  paceSec: number | null;
  effort: number;
  onUnlock: () => void;
}) {
  const zone = zoneForEffort(effort);
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef(0);
  const unlockedRef = useRef(false);

  const clearHold = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    startRef.current = null;
    setProgress(0);
  };

  useEffect(() => () => clearHold(), []);

  const tick = (now: number) => {
    const started = startRef.current;
    if (started == null || unlockedRef.current) return;
    const held = now - started;
    setProgress(pocketUnlockProgress(held));
    if (pocketUnlockReady(held)) {
      unlockedRef.current = true;
      clearHold();
      onUnlock();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    unlockedRef.current = false;
    startRef.current = performance.now();
    setProgress(0);
    rafRef.current = requestAnimationFrame(tick);
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!unlockedRef.current) clearHold();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black text-white select-none"
      data-testid="rumoso-pocket-mode"
      role="dialog"
      aria-label="Pocket mode"
      onContextMenu={(event) => event.preventDefault()}
      onTouchMove={(event) => event.preventDefault()}
      style={{ touchAction: "none" }}
    >
      <div className="flex flex-1 flex-col justify-center gap-8 px-8 pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="rounded-3xl border border-white/8 px-6 py-5">
          <p className="font-mono text-5xl font-light tabular-nums leading-none tracking-tight text-white/45">
            {formatDuration(elapsedMs)}
          </p>
          <p className="mt-2 text-[10px] tracking-[0.22em] text-white/30 uppercase">Time</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <PocketStat label="Distance" value={`${formatDistanceKm(distanceM)}`} unit="km" />
          <PocketStat label="Pace" value={formatPace(paceSec)} />
          <div className="rounded-2xl border border-white/8 px-3 py-4">
            <p className="flex items-center gap-1.5 font-mono text-lg font-light leading-none text-white/45">
              <ZoneFigure zone={zone.id} className="size-5 opacity-50" />
              <span style={{ color: zone.color, opacity: 0.7 }}>{zone.label}</span>
            </p>
            <p className="mt-2 text-[9px] tracking-[0.2em] text-white/30 uppercase">Effort</p>
          </div>
        </div>
      </div>

      <div className="px-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          data-testid="rumoso-pocket-unlock"
          aria-label="Hold to unlock"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onLostPointerCapture={onPointerEnd}
          className="relative flex h-16 w-full items-center justify-center overflow-hidden rounded-full border border-white/15 text-sm tracking-[0.2em] text-white/55 uppercase"
        >
          <span
            className="absolute inset-y-0 left-0 bg-white/10"
            style={{ width: `${Math.round(progress * 100)}%` }}
            aria-hidden
          />
          <span className="relative inline-flex items-center gap-2">
            <RumosoIcon name="run-start" className="size-4 opacity-70" />
            Hold to unlock
          </span>
        </button>
        <p className="mt-3 text-center text-[10px] leading-relaxed tracking-[0.04em] text-white/28">
          {SCREEN_LOCK_LIMIT_NOTE}
        </p>
      </div>
    </div>
  );
}

function PocketStat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl border border-white/8 px-3 py-4">
      <p className="font-mono text-lg font-light tabular-nums leading-none text-white/45">
        {value}
        {unit ? <span className="ml-0.5 text-[9px] text-white/30">{unit}</span> : null}
      </p>
      <p className="mt-2 text-[9px] tracking-[0.2em] text-white/30 uppercase">{label}</p>
    </div>
  );
}

export { POCKET_UNLOCK_HOLD_MS };
