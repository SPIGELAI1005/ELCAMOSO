import { Link } from "@tanstack/react-router";

import { FALLBACK_SOUND_PROFILE_ID } from "@/lib/sound/profile-access-config";
import { useFeatureAccess } from "@/lib/entitlements/selectors";
import {
  clearLockedFallback,
  demoClipForProfile,
  useLockedFallback,
} from "@/lib/entitlements/locked-fallback-notice";
import { useSettings } from "@/lib/drive/useSettings";
import { getProfile } from "@/lib/sound/profiles";
import { cn } from "@/lib/utils";
import { LockGlyph } from "@/components/premium/PremiumBadge";

/** Explains that a picked Drive+ sound is replaced by the free V10 for now. */
export function LockedSoundNotice({ className }: { className?: string }) {
  const requested = useLockedFallback();
  const { settings } = useSettings();
  const access = useFeatureAccess();
  if (!requested || access.canDriveWithProfile(requested)) return null;
  if (settings.profileId !== FALLBACK_SOUND_PROFILE_ID) return null;
  const name = getProfile(requested).name;
  const clip = demoClipForProfile(requested);
  return (
    <div
      role="status"
      data-testid="locked-sound-notice"
      className={cn(
        "mx-auto w-full max-w-md border border-foreground/25 bg-surface-1/40 px-4 py-3 text-sm",
        className,
      )}
    >
      <p>
        <LockGlyph className="mr-1.5 inline-block align-[-1px]" />
        <strong className="font-medium">{name}</strong> is part of Drive+. You&apos;re hearing the
        free V10 for now.
      </p>
      {clip ? (
        <audio className="mt-3 w-full" controls preload="none" src={clip}>
          <track kind="captions" />
        </audio>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Link
          to="/pricing"
          className="inline-flex h-10 items-center rounded-full bg-foreground px-5 text-[10px] tracking-[0.2em] text-background uppercase"
        >
          Upgrade to Drive+
        </Link>
        <button
          type="button"
          onClick={clearLockedFallback}
          className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
