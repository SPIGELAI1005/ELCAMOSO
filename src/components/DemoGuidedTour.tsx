import { useEffect, useRef, useState } from "react";

export interface TourStep {
  profileId: string;
  title: string;
  cue: string;
  /** Seconds from tour start */
  at: number;
  /** Seconds duration */
  duration: number;
  /** Peak throttle in this step (0..1) */
  peakThrottle: number;
}

export const DEFAULT_DEMO_TOUR: TourStep[] = [
  {
    profileId: "laughing-machine",
    title: "Laughing Machine",
    cue: "Throttle up - the cabin cracks up.",
    at: 0,
    duration: 7,
    peakThrottle: 0.92,
  },
  {
    profileId: "neon-drive",
    title: "Neon Drive",
    cue: "Night pulses that tighten as you push.",
    at: 7,
    duration: 7,
    peakThrottle: 0.85,
  },
  {
    profileId: "construction-monster",
    title: "Construction Monster",
    cue: "Hydraulics and diesel strain under load.",
    at: 14,
    duration: 7,
    peakThrottle: 0.88,
  },
  {
    profileId: "farting-car",
    title: "Farting Car",
    cue: "Exactly what it sounds like. Social risk accepted.",
    at: 21,
    duration: 7,
    peakThrottle: 0.9,
  },
];

export const DEMO_TOUR_TOTAL_S = 28;

interface Props {
  active: boolean;
  running: boolean;
  onStart: () => void;
  onStop: () => void;
  onProfile: (profileId: string) => void;
  onControls: (next: { throttle: number; accel: number; regen: number; selector: "D" }) => void;
  reducedMotion?: boolean;
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function throttleForStep(local: number, duration: number, peak: number) {
  const u = Math.min(1, Math.max(0, local / duration));
  if (u < 0.15) return easeInOut(u / 0.15) * peak * 0.45;
  if (u < 0.55) return peak * (0.45 + easeInOut((u - 0.15) / 0.4) * 0.55);
  if (u < 0.75) return peak;
  return peak * (1 - easeInOut((u - 0.75) / 0.25) * 0.85);
}

/**
 * ~28s guided Demo Drive: swaps character-true profiles and scripts throttle
 * so each title reads within the first second of demand.
 */
export function DemoGuidedTour({
  active,
  running,
  onStart,
  onStop,
  onProfile,
  onControls,
  reducedMotion = false,
}: Props) {
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number | null>(null);
  const lastProfile = useRef<string | null>(null);
  const raf = useRef<number | null>(null);

  const step =
    DEFAULT_DEMO_TOUR.find((s) => elapsed >= s.at && elapsed < s.at + s.duration) ??
    DEFAULT_DEMO_TOUR[DEFAULT_DEMO_TOUR.length - 1]!;
  const done = playing && elapsed >= DEMO_TOUR_TOTAL_S;

  useEffect(() => {
    if (!playing) {
      if (raf.current) cancelAnimationFrame(raf.current);
      return;
    }
    const tick = (now: number) => {
      if (startedAt.current == null) startedAt.current = now;
      const t = (now - startedAt.current) / 1000;
      setElapsed(t);
      if (t >= DEMO_TOUR_TOTAL_S) {
        setPlaying(false);
        onControls({ throttle: 0.2, accel: 0.4, regen: 0, selector: "D" });
        return;
      }
      const current =
        DEFAULT_DEMO_TOUR.find((s) => t >= s.at && t < s.at + s.duration) ??
        DEFAULT_DEMO_TOUR[0]!;
      if (lastProfile.current !== current.profileId) {
        lastProfile.current = current.profileId;
        onProfile(current.profileId);
      }
      const local = t - current.at;
      const throttle = throttleForStep(local, current.duration, current.peakThrottle);
      const accel = 0.45 + throttle * 0.5;
      onControls({ throttle, accel, regen: 0, selector: "D" });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing, onControls, onProfile]);

  const begin = () => {
    lastProfile.current = null;
    startedAt.current = null;
    setElapsed(0);
    setPlaying(true);
    onProfile(DEFAULT_DEMO_TOUR[0]!.profileId);
    onControls({ throttle: 0.15, accel: 0.5, regen: 0, selector: "D" });
    if (!running) onStart();
  };

  const cancel = () => {
    setPlaying(false);
    startedAt.current = null;
    setElapsed(0);
    lastProfile.current = null;
    onStop();
  };

  const progress = Math.min(1, elapsed / DEMO_TOUR_TOTAL_S);

  return (
    <section className="mt-10 border border-border p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">
            Guided tour
          </h2>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            About 28 seconds. Four Sound Profiles, auto throttle, so each character is obvious.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!playing ? (
            <button
              type="button"
              onClick={begin}
              className="h-10 rounded-full border border-foreground bg-foreground px-5 text-[10px] tracking-[0.2em] text-background uppercase"
            >
              {done ? "Replay tour" : "Start tour"}
            </button>
          ) : (
            <button
              type="button"
              onClick={cancel}
              className="h-10 rounded-full border border-border px-5 text-[10px] tracking-[0.2em] uppercase hover:bg-secondary"
            >
              Stop tour
            </button>
          )}
        </div>
      </div>

      {(playing || done) && (
        <div className="mt-6">
          <div className="flex items-baseline justify-between gap-4">
            <p className="truncate text-base font-light">{step.title}</p>
            <p className="shrink-0 text-[10px] tracking-[0.18em] text-muted-foreground tabular-nums uppercase">
              {Math.min(DEMO_TOUR_TOTAL_S, Math.floor(elapsed))}s / {DEMO_TOUR_TOTAL_S}s
            </p>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{done ? "Tour complete. Try the pedals, or pick another sound." : step.cue}</p>
          <div
            className="mt-4 h-px overflow-hidden bg-border"
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Tour progress"
          >
            <div
              className={`h-full bg-foreground ${reducedMotion || !active ? "" : "transition-[width] duration-100"}`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <ol className="mt-4 flex flex-wrap gap-2">
            {DEFAULT_DEMO_TOUR.map((s) => {
              const on = playing && step.profileId === s.profileId;
              const past = elapsed >= s.at + s.duration;
              return (
                <li
                  key={s.profileId}
                  className={`rounded-full border px-2.5 py-1 text-[9px] tracking-[0.14em] uppercase ${
                    on
                      ? "border-foreground text-foreground"
                      : past
                        ? "border-border text-foreground/50"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {s.title}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
