import { useState } from "react";
import { DRIVE_OUTPUT_MODE_COPY, type DriveOutputMode } from "@/lib/journey-trace";
import {
  getSilentCaptureGenre,
  listSilentCaptureGenres,
  setSilentCaptureGenre,
} from "@/lib/drive/silent-capture-genre";

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
      {value === "capture" || value === "live-and-capture" ? <SilentCaptureGenrePicker /> : null}
      {value === "capture" ? (
        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          ELCAMOSO records how the drive moved, not where you went. Stop at the end of the trip to
          hear your song.
        </p>
      ) : null}
    </div>
  );
}

function SilentCaptureGenrePicker() {
  const genres = listSilentCaptureGenres();
  const [genre, setGenre] = useState(() => getSilentCaptureGenre());
  return (
    <div className="mt-5">
      <p className="text-center text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
        Song genre
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2" data-testid="capture-genre-picker">
        {genres.map((g) => (
          <button
            key={g.id}
            type="button"
            aria-pressed={genre === g.id}
            onClick={() => {
              setGenre(g.id);
              setSilentCaptureGenre(g.id);
            }}
            className={
              genre === g.id
                ? "border border-foreground/60 bg-foreground/[0.06] px-3 py-3 text-[11px] tracking-[0.14em] uppercase"
                : "border border-foreground/15 px-3 py-3 text-[11px] tracking-[0.14em] text-muted-foreground uppercase"
            }
          >
            {g.name}
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        You can change it after the drive too.
      </p>
    </div>
  );
}
