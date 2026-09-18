import { DRIVE_OUTPUT_MODE_COPY, type DriveOutputMode } from "@/lib/journey-trace";

const MODES: DriveOutputMode[] = ["live", "capture", "live-and-capture"];

export function DriveModePicker({
  value,
  onChange,
}: {
  value: DriveOutputMode;
  onChange: (mode: DriveOutputMode) => void;
}) {
  return (
    <div className="w-full">
      <p className="text-center text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
        Choose drive mode
      </p>
      <p className="mt-2 text-center text-xs text-muted-foreground">Drive first. Hear it later.</p>
      <div className="mt-6 flex flex-col gap-2">
        {MODES.map((mode) => {
          const copy = DRIVE_OUTPUT_MODE_COPY[mode];
          const active = value === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onChange(mode)}
              className={
                active
                  ? "border border-foreground/50 bg-foreground/[0.04] px-5 py-4 text-left"
                  : "border border-foreground/15 px-5 py-4 text-left"
              }
            >
              <div className="text-[11px] tracking-[0.22em] uppercase">{copy.title}</div>
              <div className="mt-1.5 text-sm font-light text-muted-foreground">{copy.subtitle}</div>
            </button>
          );
        })}
      </div>
      {value === "capture" ? (
        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          ELCAMOSO records how the drive moved, not where you went.
        </p>
      ) : null}
    </div>
  );
}
