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
import { driveSpecialBannerText, isDriveSpecialActive } from "@/lib/billing/drive-special";
import { AccountSignInDialog } from "@/components/AccountSignInDialog";
import { useSettings } from "@/lib/drive/useSettings";

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
  const { settings } = useSettings();
  const specialActive = isDriveSpecialActive();
  const signUpLabel = driveSpecialBannerText(settings.language).signup;
  const [signUpOpen, setSignUpOpen] = useState(false);
  /** Locked genre: Sign up dialog during Black Friday Special, else the Drive the Music package. */
  const unlockHref = "/pricing#drive-music";
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
                if (!isAuthenticated && specialActive) {
                  setSignUpOpen(true);
                  return;
                }
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
            {locked ? (
              <PremiumBadge
                className="ml-2 align-middle"
                label={!isAuthenticated && specialActive ? signUpLabel : "Drive the Music"}
              />
            ) : null}
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
          {!isAuthenticated && specialActive ? (
            <button type="button" className="underline" onClick={() => setSignUpOpen(true)}>
              {signUpLabel}
            </button>
          ) : (
            <a href={unlockHref} className="underline">
              Drive the Music
            </a>
          )}
          . Without it you&apos;ll hear the free V10 on the Drive page.
        </p>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">
        Auto DJ mixes into a new genre every 2-3 minutes, beat-matched on the bar. Tempo follows
        your speed. Accelerate hard for a build, brake for a softer passage, hold a steady speed for
        the groove. Climbs lift the key when your browser shares altitude.
      </p>
      <AccountSignInDialog
        open={signUpOpen}
        onOpenChange={setSignUpOpen}
        returnTo="/drive?sound=symphony-motion-orchestra"
        title={signUpLabel}
        description={
          settings.language.slice(0, 2).toLowerCase() === "de"
            ? "Lege ein Konto an, um Midnight Dark Rave unbegrenzt und Drive the Music 30 Minuten am Tag bis zum 27. November zu nutzen."
            : settings.language.slice(0, 2).toLowerCase() === "ro"
              ? "Creează un cont ca să ai Midnight Dark Rave nelimitat și Drive the Music 30 de minute pe zi până pe 27 noiembrie."
              : "Create an account to keep Midnight Dark Rave unlimited and Drive the Music 30 minutes a day until 27 November."
        }
      />
    </div>
  );
}
