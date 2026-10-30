import { useEffect, useState } from "react";
import {
  GENRE_IDS,
  GENRES,
  UPCOMING_GENRES,
  getGenreChoice,
  setGenreChoice,
  subscribeGenreChoice,
  type GenreChoice,
} from "@/lib/symphony/adaptive";
import { cn } from "@/lib/utils";

/** Genre selector for Drive the Music. Switches on the next bar, mid-drive. */
export function MusicGenrePicker({
  className,
  onPick,
  onStart,
}: {
  className?: string;
  /** Called after a genre is chosen (e.g. to open the Drive page with it). */
  onPick?: (choice: GenreChoice) => void;
  /** Shows a "Drive with this music" button when provided. */
  onStart?: () => void;
}) {
  const [choice, setChoice] = useState<GenreChoice>("auto");
  useEffect(() => {
    setChoice(getGenreChoice());
    return subscribeGenreChoice(setChoice);
  }, []);
  const options: { id: GenreChoice; label: string }[] = [
    { id: "auto", label: "Auto" },
    ...GENRE_IDS.map((id) => ({ id, label: GENRES[id].name })),
  ];
  return (
    <div className={className}>
      <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">Music genre</p>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Music genre">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={choice === o.id}
            onClick={() => {
              setGenreChoice(o.id);
              onPick?.(o.id);
            }}
            className={cn(
              "h-11 rounded-full border px-5 text-[11px] tracking-[0.18em] uppercase",
              choice === o.id ? "border-foreground bg-foreground text-background" : "border-border",
            )}
          >
            {o.label}
          </button>
        ))}
        {UPCOMING_GENRES.map((g) => (
          <span
            key={g}
            className="inline-flex h-11 items-center rounded-full border border-dashed border-border/60 px-5 text-[11px] tracking-[0.18em] text-muted-foreground/60 uppercase"
          >
            {g} · soon
          </span>
        ))}
      </div>
      {onStart ? (
        <button
          type="button"
          onClick={onStart}
          className="mt-4 h-11 rounded-full bg-foreground px-6 text-[11px] tracking-[0.18em] text-background uppercase"
        >
          Drive with this music
        </button>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">
        Tempo follows your speed. Accelerate hard for a build, brake for a softer passage, hold a
        steady speed for the groove. Climbs lift the key when your browser shares altitude.
      </p>
    </div>
  );
}
