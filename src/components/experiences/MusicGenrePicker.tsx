import { useEffect, useState } from "react";
import {
  PUBLIC_GENRE_IDS,
  GENRES,
  UPCOMING_GENRES,
  getGenreChoice,
  setGenreChoice,
  subscribeGenreChoice,
  type GenreChoice,
  AUTO_DJ_LABEL,
} from "@/lib/symphony/adaptive";
import { useFeatureAccess } from "@/lib/entitlements/selectors";
import { cn } from "@/lib/utils";
import { PremiumBadge } from "@/components/premium/PremiumBadge";
import { useAccount } from "@/lib/account/AccountProvider";
import { isDriveSpecialActive } from "@/lib/billing/drive-special";

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
  const access = useFeatureAccess();
  const locked = !access.canDriveWithProfile("symphony-motion-orchestra");
  const { isAuthenticated } = useAccount();
  /** Locked genre: sign in during the 7 Days Drive Special, else the Drive the Music package. */
  const unlockHref =
    !isAuthenticated && isDriveSpecialActive()
      ? "/auth/account/google/start"
      : "/pricing#drive-music";
  useEffect(() => {
    setChoice(getGenreChoice());
    return subscribeGenreChoice(setChoice);
  }, []);
  const options: { id: GenreChoice; label: string }[] = [
    { id: "auto", label: AUTO_DJ_LABEL },
    ...PUBLIC_GENRE_IDS.map((id) => ({ id, label: GENRES[id].name })),
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
            data-locked={locked ? "true" : undefined}
            onClick={() => {
              if (locked) {
                window.location.href = unlockHref;
                return;
              }
              setGenreChoice(o.id);
              onPick?.(o.id);
            }}
            className={cn(
              "h-11 rounded-full border px-5 text-[11px] tracking-[0.18em] uppercase",
              choice === o.id ? "border-foreground bg-foreground text-background" : "border-border",
            )}
          >
            {o.label}
            {locked ? <PremiumBadge className="ml-2 align-middle" label="Drive the Music" /> : null}
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
      {locked ? (
        <p className="mt-3 text-xs text-muted-foreground" data-testid="genre-locked-note">
          Music genres are part of{" "}
          <a href={unlockHref} className="underline">
            Drive the Music
          </a>
          . Without it you&apos;ll hear the free V10 on the Drive page.
        </p>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">
        Auto DJ mixes into a new genre every 2-3 minutes, beat-matched on the bar. Tempo follows
        your speed. Accelerate hard for a build, brake for a softer passage, hold a steady speed for
        the groove. Climbs lift the key when your browser shares altitude.
      </p>
    </div>
  );
}
