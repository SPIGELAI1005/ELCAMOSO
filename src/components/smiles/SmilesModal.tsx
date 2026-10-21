import { Link } from "@tanstack/react-router";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SmilesCard } from "@/components/smiles/SmilesCard";
import type { JourneySummary } from "@/lib/journey/types";
import { getProfile } from "@/lib/sound/profiles";
import { isSmilesWorthy } from "@/lib/inbox/inbox";

/** Centered pop-up with the Smiles per Mile card, shown right after STOP. */
export function SmilesModal({
  journey,
  onClose,
  onOpenDriveSound,
}: {
  journey: JourneySummary | null;
  onClose: () => void;
  /** Opens the "Your drive has a sound" view on the Drive page. */
  onOpenDriveSound?: (journeyId: string) => void;
}) {
  const p = journey ? getProfile(journey.profileId) : null;
  return (
    <Dialog open={Boolean(journey)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        data-testid="smiles-modal"
        className="max-h-[92dvh] w-[calc(100vw-1.5rem)] z-[200] max-w-xl overflow-y-auto rounded-[32px] border-white/10 bg-black/60 p-4 backdrop-blur-2xl sm:p-6 [&>button]:top-5 [&>button]:right-5 [&>button]:rounded-full [&>button]:border [&>button]:border-white/25 [&>button]:p-1.5"
      >
        <DialogTitle className="sr-only">Smiles per Mile</DialogTitle>
        <DialogDescription className="sr-only">
          Summary of the drive you just finished.
        </DialogDescription>
        {journey && p ? (
          <>
            {!isSmilesWorthy(journey) ? (
              <p data-testid="smiles-short-drive" className="px-2 pt-6 text-center text-xs tracking-[0.12em] text-foreground/70">
                Short drive. Go a little further next time for a full Smiles score.
              </p>
            ) : null}
            <SmilesCard
              journeyId={journey.id}
              profileId={journey.profileId}
              profileName={p.name}
              category={p.category}
              distanceM={journey.distanceM ?? 0}
              durationMs={journey.durationMs}
              trace={null}
              live={journey.smiles}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              {onOpenDriveSound ? (
                <button
                  type="button"
                  onClick={() => onOpenDriveSound(journey.id)}
                  className="flex h-12 items-center justify-center rounded-full border border-white/20 text-[10px] tracking-[0.22em] text-foreground/85 uppercase"
                >
                  Your drive has a sound
                </button>
              ) : null}
              <Link
                to="/journeys/$journeyId"
                params={{ journeyId: journey.id }}
                onClick={onClose}
                className="flex h-12 items-center justify-center rounded-full border border-white/20 text-[10px] tracking-[0.22em] text-foreground/85 uppercase"
              >
                View full summary
              </Link>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
