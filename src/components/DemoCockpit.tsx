import {
  useCallback,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { DemoControls, DemoSelector } from "@/lib/drive/session";
import { StartDriveBeacon } from "@/components/StartDriveBeacon";

interface DemoCockpitProps {
  controls: DemoControls;
  setControls: (next: Partial<DemoControls>) => void;
  /** Starts demo audio when gas is pressed if not already running. */
  onGasEngage?: (amount: number) => void;
  reducedMotion?: boolean;
  /** When true, footwell ambient animation runs. */
  live?: boolean;
}

const PRND: { id: DemoSelector; hint: string }[] = [
  { id: "P", hint: "Park" },
  { id: "R", hint: "Reverse" },
  { id: "N", hint: "Neutral" },
  { id: "D", hint: "Drive" },
];

/**
 * Compact PRND strip + brake/gas pedals for Demo Drive.
 * P: locked, no rev. N: rev in place. D/R: roll with pedals.
 */
export function DemoCockpit({
  controls,
  setControls,
  onGasEngage,
  reducedMotion = false,
  live = false,
}: DemoCockpitProps) {
  const parkLocked = controls.selector === "P";

  return (
    <div className={`flex flex-col gap-5 ${reducedMotion ? "" : "animate-rise"}`}>
      <PrndSelector
        value={controls.selector}
        reducedMotion={reducedMotion}
        onChange={(selector) => {
          if (selector === "P") {
            setControls({ selector, throttle: 0, regen: 0 });
            return;
          }
          setControls({ selector });
        }}
      />

      <div
        className="relative mx-auto w-full max-w-sm overflow-hidden rounded-xl border border-border/50 px-5 pb-5 pt-8 sm:px-8 sm:pb-6 sm:pt-9"
        style={{
          background:
            "radial-gradient(ellipse 90% 80% at 50% 40%, #181818 0%, #0c0c0c 50%, #050505 100%)",
          boxShadow: "inset 0 24px 48px rgba(0,0,0,0.45)",
        }}
        role="group"
        aria-label="Pedals"
      >
        <div
          className={`pointer-events-none absolute inset-x-5 bottom-4 top-14 ${
            live && !reducedMotion ? "animate-pedal-bay" : "opacity-20"
          }`}
          aria-hidden="true"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent 0, transparent 7px, #1f1f1f 7px, #1f1f1f 9px)",
            maskImage: "linear-gradient(180deg, transparent, #000 25%, #000 80%, transparent)",
          }}
        />

        <div
          data-pedal-bay
          className="relative mx-auto grid h-[8.5rem] w-fit grid-cols-[9.5rem_3.1rem] items-center gap-x-7 sm:h-[10.5rem] sm:grid-cols-[11.5rem_3.75rem] sm:gap-x-9"
          style={
            {
              ["--brake-travel-max"]: "2rem",
              ["--gas-travel-max"]: "0.5rem",
            } as CSSProperties
          }
        >
          <style>{`
            @media (min-width: 640px) {
              [data-pedal-bay] {
                --brake-travel-max: 2.5rem;
                --gas-travel-max: 0.6rem;
              }
            }
          `}</style>
          <PedalPad
            kind="brake"
            label="Brake"
            value={controls.regen}
            reducedMotion={reducedMotion}
            travelVar="--brake-travel-max"
            onEngage={(v) => setControls({ regen: v, throttle: 0 })}
            onRelease={() => setControls({ regen: 0 })}
          />
          <PedalPad
            kind="gas"
            label="Gas"
            value={controls.throttle}
            disabled={parkLocked}
            reducedMotion={reducedMotion}
            travelVar="--gas-travel-max"
            onEngage={(v) => {
              if (parkLocked) return;
              if (onGasEngage) {
                onGasEngage(v);
                return;
              }
              setControls({ throttle: v, regen: 0 });
            }}
            onRelease={() => setControls({ throttle: 0 })}
          />
        </div>

        <div className="relative z-10 mx-auto mt-3 grid w-fit grid-cols-[9.5rem_3.1rem] gap-x-7 sm:grid-cols-[11.5rem_3.75rem] sm:gap-x-9">
          <PedalCaption label="Brake" value={controls.regen} />
          <PedalCaption label="Gas" value={controls.throttle} muted={parkLocked} />
        </div>
      </div>

      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
        {parkLocked
          ? "Park is locked. Shift to N to rev, or D / R to roll."
          : controls.selector === "N"
            ? "Neutral: gas revs in place. Pedals spring back on release."
            : "Press and drag the pedals. Deeper press = more demand."}
      </p>
    </div>
  );
}

function PedalCaption({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <p
      className={`text-center text-[9px] tracking-[0.22em] uppercase ${
        muted ? "text-muted-foreground/50" : "text-muted-foreground"
      }`}
    >
      {label}
      <span className="ml-1.5 tabular-nums text-foreground/65">{Math.round(value * 100)}</span>
    </p>
  );
}

function PrndSelector({
  value,
  onChange,
  reducedMotion,
}: {
  value: DemoSelector;
  onChange: (next: DemoSelector) => void;
  reducedMotion?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-sm">
      <p className="mb-2.5 text-center text-[9px] tracking-[0.28em] text-muted-foreground uppercase">
        Drive Mode
      </p>
      <div
        className="mx-auto grid h-11 grid-cols-4 gap-0.5 rounded-full border border-border/80 p-1"
        style={{
          background: "linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 55%, #141414 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 20px rgba(0,0,0,0.35)",
        }}
        role="radiogroup"
        aria-label="Park Reverse Neutral Drive"
      >
        {PRND.map((mode) => {
          const active = value === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={mode.hint}
              title={mode.hint}
              onClick={() => onChange(mode.id)}
              className={`relative flex items-center justify-center rounded-full transition-[color,background-color,box-shadow] duration-300 ${
                active
                  ? `text-[#f0b429] ${reducedMotion ? "" : "animate-prnd-glow"}`
                  : "text-[#c8c8c8]/70 hover:text-[#f5f5f7]"
              }`}
              style={
                active
                  ? {
                      background:
                        "radial-gradient(ellipse at center, oklch(0.72 0.12 75 / 0.28), transparent 72%)",
                      boxShadow: "inset 0 0 0 1px oklch(0.78 0.14 75 / 0.45)",
                    }
                  : undefined
              }
            >
              {/* No letter-spacing: tracking on a single glyph shifts it left optically. */}
              <span className="block text-[15px] leading-none font-medium tracking-normal">
                {mode.id}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PedalPad({
  kind,
  label,
  value,
  disabled,
  reducedMotion,
  travelVar,
  onEngage,
  onRelease,
}: {
  kind: "brake" | "gas";
  label: string;
  value: number;
  disabled?: boolean;
  reducedMotion?: boolean;
  travelVar: "--brake-travel-max" | "--gas-travel-max";
  onEngage: (amount: number) => void;
  onRelease: () => void;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(false);
  const pressed = value > 0.04;
  const amount = reducedMotion || disabled ? 0 : value;

  const readAmount = useCallback((clientY: number) => {
    const el = shellRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const t = (clientY - rect.top) / Math.max(1, rect.height);
    return Math.min(1, Math.max(0, t));
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    activeRef.current = true;
    const raw = readAmount(e.clientY);
    onEngage(Math.max(raw, kind === "gas" ? 0.35 : 0.25));
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!activeRef.current || disabled) return;
    onEngage(readAmount(e.clientY));
  };

  const end = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!activeRef.current) return;
    activeRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    onRelease();
  };

  const motionStyle: CSSProperties = {
    transform: `translateY(calc(${amount} * var(${travelVar}, 0px)))`,
    transition: reducedMotion ? undefined : "transform 80ms linear",
  };

  const pedalButton = (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${label} pedal`}
      aria-disabled={disabled || undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-valuetext={disabled ? "Locked in Park" : `${Math.round(value * 100)} percent`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={() => {
        if (!activeRef.current) return;
        activeRef.current = false;
        onRelease();
      }}
      className="absolute inset-0 z-10 touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-foreground/35 disabled:cursor-not-allowed"
    >
      <BlackPedalFace kind={kind} pressed={pressed} />
      <span className="sr-only">{label}</span>
    </button>
  );

  return (
    <div
      className={`relative z-[1] flex h-full items-center justify-center ${
        disabled ? "opacity-40" : ""
      }`}
    >
      <div
        ref={shellRef}
        className={
          kind === "brake"
            ? "relative h-[4.25rem] w-full sm:h-[5.1rem]"
            : "relative h-full min-h-[8.5rem] w-full sm:min-h-[10.5rem]"
        }
      >
        {/* Mount arm */}
        <div
          className={`pointer-events-none absolute left-1/2 z-0 -translate-x-1/2 rounded-full ${
            kind === "gas"
              ? "-top-5 h-5 w-[5px] sm:-top-6 sm:h-6"
              : "-top-4 h-4 w-[5px] sm:-top-5 sm:h-5"
          }`}
          aria-hidden="true"
          style={{
            background: "linear-gradient(180deg, #2a2a2a, #0a0a0a)",
            boxShadow: "inset 1px 0 0 rgba(255,255,255,0.08), 0 2px 6px rgba(0,0,0,0.5)",
          }}
        />
        <div className="absolute inset-0 z-[1]" style={motionStyle}>
          {kind === "gas" && !disabled ? (
            <StartDriveBeacon variant="pedal" className="size-full">
              {pedalButton}
            </StartDriveBeacon>
          ) : (
            pedalButton
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Matte-black EV pedals: soft plate, raised rubber ribs, thin rim highlight.
 * Brake wide + 8 ribs; gas tall/tapered + 5 ribs.
 */
function BlackPedalFace({ kind, pressed }: { kind: "brake" | "gas"; pressed: boolean }) {
  const ribs = kind === "brake" ? 8 : 5;

  return (
    <span
      className="pointer-events-none absolute inset-0 block"
      aria-hidden="true"
      style={{
        borderRadius: kind === "brake" ? "14px" : "12px",
        clipPath:
          kind === "gas"
            ? "polygon(14% 0%, 86% 0%, 100% 6%, 100% 94%, 86% 100%, 14% 100%, 0% 94%, 0% 6%)"
            : undefined,
        background: pressed
          ? "linear-gradient(160deg, #1c1c1c 0%, #0a0a0a 45%, #050505 100%)"
          : "linear-gradient(160deg, #222 0%, #121212 40%, #0a0a0a 100%)",
        boxShadow: pressed
          ? "inset 0 2px 8px rgba(0,0,0,0.75), inset 0 0 0 1px rgba(255,255,255,0.04), 0 4px 10px rgba(0,0,0,0.55)"
          : "inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.06), 0 14px 28px rgba(0,0,0,0.7)",
      }}
    >
      {/* Soft top sheen */}
      <span
        className="absolute inset-x-0 top-0 h-1/3 rounded-[inherit] opacity-40"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.07), transparent)",
        }}
      />
      {/* Rubber grip ribs */}
      <span
        className="absolute inset-0 flex"
        style={{
          gap: kind === "brake" ? "5px" : "4px",
          padding: kind === "brake" ? "10px 11px" : "11px 8px",
        }}
      >
        {Array.from({ length: ribs }, (_, i) => (
          <span
            key={i}
            className="h-full flex-1"
            style={{
              borderRadius: "999px",
              background:
                "linear-gradient(180deg, #2a2a2a 0%, #111 18%, #050505 55%, #141414 100%)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.8), 1px 0 0 rgba(0,0,0,0.45), -1px 0 0 rgba(255,255,255,0.03)",
            }}
          />
        ))}
      </span>
    </span>
  );
}
