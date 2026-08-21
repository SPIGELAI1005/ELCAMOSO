import { Link, useRouterState } from "@tanstack/react-router";
import { HeadroomMeter } from "@/components/HeadroomMeter";
import { getSession } from "@/lib/drive/session";
import { useSessionStore } from "@/lib/store/session-store";
import { useSettings } from "@/lib/drive/useSettings";
import { getProfile } from "@/lib/sound/profiles";
import { getProfileGain } from "@/lib/drive/settings";
import { t } from "@/lib/i18n";
import { isLiveSessionStatus, miniPlayerTopClass } from "@/lib/ui/chrome";

export function MiniPlayer() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const snap = useSessionStore();
  const { settings } = useSettings();
  if (pathname === "/") return null;
  const live = isLiveSessionStatus(snap.status);
  if (!live) return null;
  const profile = getProfile(snap.profileId);
  const gain = getProfileGain(settings, snap.profileId);

  return (
    <>
      {/* In-flow spacer so fixed chrome does not cover page content. */}
      <div className="h-[4.25rem]" aria-hidden="true" />
      <div
        className={`fixed inset-x-0 z-40 border-b border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 ${miniPlayerTopClass()}`}
      >
        <div className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-8">
          <Link to="/drive" className="min-w-0 shrink">
            <p className="truncate text-sm font-light">{snap.profileName}</p>
            <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              {t(settings.language, "player.playing")}
            </p>
          </Link>
          <div className="min-w-0 flex-1">
            <HeadroomMeter
              compact
              meter={snap.meter}
              profile={profile}
              volume={settings.volume}
              profileGain={gain}
            />
          </div>
          <button
            type="button"
            onClick={() => getSession().stop()}
            className="h-11 min-w-11 shrink-0 rounded-full border border-border px-5 text-[11px] tracking-[0.2em] uppercase"
          >
            {t(settings.language, "player.stop")}
          </button>
        </div>
      </div>
    </>
  );
}
