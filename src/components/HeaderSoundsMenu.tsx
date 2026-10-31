"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import { PremiumBadge } from "@/components/premium/PremiumBadge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getSession } from "@/lib/drive/session";
import { useSettings } from "@/lib/drive/useSettings";
import { useAccount } from "@/lib/account/AccountProvider";
import { useFeatureAccess } from "@/lib/entitlements/selectors";
import {
  DRIVE_PLUS_LOCKED_MESSAGE,
  isSoundTierGateActive,
  SOUND_TIER_GATE_LABEL,
} from "@/lib/sound/profile-access-config";
import { t, type Locale } from "@/lib/i18n";
import {
  PROFILE_CATEGORIES,
  SOUND_PROFILES,
  type ProfileCategory,
  type SoundProfile,
} from "@/lib/sound/profiles";
import { useSessionSelector } from "@/lib/store/session-store";
import { cn } from "@/lib/utils";
import { HALLOWEEN_ORANGE, HALLOWEEN_TAG, halloweenPinned } from "@/lib/halloween/halloween";

type MenuGroup = { category: ProfileCategory | typeof HALLOWEEN_TAG; profiles: SoundProfile[]; halloween?: boolean };

/** Halloween profiles pinned first (only inside the window), then the normal categories. */
export function profilesByCategory(now?: number): MenuGroup[] {
  const { pinned, rest } = halloweenPinned(SOUND_PROFILES, now);
  const groups: MenuGroup[] = PROFILE_CATEGORIES.map((category) => ({
    category,
    profiles: rest.filter((p) => p.category === category),
  })).filter((group) => group.profiles.length > 0);
  return pinned.length ? [{ category: HALLOWEEN_TAG, profiles: pinned, halloween: true }, ...groups] : groups;
}

function closeOtherNavGroups(except?: Element | null) {
  document.querySelectorAll("details[data-nav-group]").forEach((node) => {
    if (except && node === except) return;
    (node as HTMLDetailsElement).open = false;
  });
}

export interface HeaderSoundsMenuProps {
  language: Locale;
  /** Desktop primary nav, compact mobile header chip, or mobile sheet accordion. */
  variant?: "nav" | "compact" | "sheet";
  onNavigate?: () => void;
  className?: string;
}

/**
 * Red header shortcut: pick any Sound Profile allowed by the current plan
 * (every profile is free until the Drive+ gate date in profile-access-config).
 */
export function HeaderSoundsMenu({
  language,
  variant = "nav",
  onNavigate,
  className,
}: HeaderSoundsMenuProps) {
  const { settings, update } = useSettings();
  const navigate = useNavigate();
  const { canDriveWithProfile, canPreviewProfile } = useFeatureAccess();
  const sessionStatus = useSessionSelector((snap) => snap.status);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { isAuthenticated } = useAccount();
  const gateActive = isSoundTierGateActive();
  const [upsellFor, setUpsellFor] = useState<string | null>(null);
  const groups = useMemo(() => profilesByCategory(), []);

  function canSelect(id: string) {
    return canDriveWithProfile(id) || canPreviewProfile(id);
  }

  function selectProfile(id: string, opts?: { preview?: boolean }) {
    if (!canSelect(id)) return;
    if (!opts?.preview && !canDriveWithProfile(id)) {
      setUpsellFor(id);
      return;
    }
    setUpsellFor(null);
    update({ profileId: id });
    if (sessionStatus === "running" || sessionStatus === "starting") {
      const snap = getSession().snapshot();
      void getSession().listenProfile(id, snap.auditionKmh || 60);
    }
    closeOtherNavGroups();
    setSheetOpen(false);
    onNavigate?.();
    void navigate({ to: "/drive" });
  }

  const triggerLabel = t(language, "nav.sounds");
  const activeId = settings.profileId;

  const upsellProfile = upsellFor ? SOUND_PROFILES.find((p) => p.id === upsellFor) : undefined;
  const upsellPanel = upsellProfile ? (
    <div
      data-testid="sound-upsell"
      className="mx-2 mb-2 rounded-sm border border-border/70 bg-secondary/40 px-3 py-2.5 text-xs"
    >
      <p className="text-foreground">
        {upsellProfile.name}: {DRIVE_PLUS_LOCKED_MESSAGE}
      </p>
      <p className="mt-0.5 text-muted-foreground">
        {isAuthenticated
          ? "Upgrade to Drive+ to drive with every sound."
          : "Sign in to use Drive+ or sounds granted to your account."}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {isAuthenticated ? (
          <Link
            to="/pricing"
            onClick={() => {
              closeOtherNavGroups();
              setSheetOpen(false);
              onNavigate?.();
            }}
            className="rounded-sm bg-foreground px-2.5 py-1 text-[10px] tracking-[0.14em] text-background uppercase"
          >
            Get Drive+
          </Link>
        ) : (
          <a
            href="/auth/account/google/start"
            className="rounded-sm bg-foreground px-2.5 py-1 text-[10px] tracking-[0.14em] text-background uppercase"
          >
            Sign in
          </a>
        )}
        <button
          type="button"
          onClick={() => selectProfile(upsellProfile.id, { preview: true })}
          className="rounded-sm border border-border px-2.5 py-1 text-[10px] tracking-[0.14em] text-muted-foreground uppercase"
        >
          Preview
        </button>
      </div>
    </div>
  ) : null;

  const profileList = (
    <div className="max-h-[min(70vh,28rem)] overflow-y-auto overscroll-contain">
      {!gateActive ? (
        <p
          data-testid="sound-free-until"
          className="px-3 pt-1.5 pb-0.5 text-[10px] text-muted-foreground/80"
        >
          All sounds free until {SOUND_TIER_GATE_LABEL}
        </p>
      ) : null}
      {upsellPanel}
      {groups.map(({ category, profiles, halloween }) => (
        <div
          key={category}
          className={cn("mb-1", halloween && "mb-2 rounded-sm border pb-1")}
          style={halloween ? { borderColor: `${HALLOWEEN_ORANGE}66`, background: `${HALLOWEEN_ORANGE}12` } : undefined}
          data-testid={halloween ? "sounds-halloween-group" : undefined}
        >
          <p
            className={cn(
              "px-3 py-1.5 text-[9px] tracking-[0.22em] uppercase",
              halloween ? "font-semibold" : "text-muted-foreground/70",
            )}
            style={halloween ? { color: HALLOWEEN_ORANGE } : undefined}
          >
            {category}
          </p>
          {profiles.map((profile) => {
            const locked = !canDriveWithProfile(profile.id);
            const selectable = canSelect(profile.id);
            const active = profile.id === activeId;
            return (
              <button
                key={profile.id}
                type="button"
                role="menuitem"
                disabled={!selectable}
                onClick={() => selectProfile(profile.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2.5 text-left text-xs tracking-[0.08em] transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : selectable
                      ? "text-foreground hover:bg-secondary"
                      : "cursor-not-allowed text-muted-foreground/50",
                  locked && selectable && !active ? "text-muted-foreground" : null,
                )}
              >
                <span className="min-w-0 truncate normal-case tracking-normal">{profile.name}</span>
                {halloween && !locked ? (
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold tracking-[0.12em] text-black uppercase"
                    style={{ background: HALLOWEEN_ORANGE }}
                  >
                    🎃 Special
                  </span>
                ) : null}
                {locked ? <PremiumBadge className="shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );

  const footerLinks = (
    <div className="mt-1 space-y-0.5 border-t border-border/60 pt-1.5">
      <Link
        to="/sounds"
        role="menuitem"
        onClick={() => {
          closeOtherNavGroups();
          setSheetOpen(false);
          onNavigate?.();
        }}
        className="block rounded-sm px-3 py-2.5 text-xs tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:bg-secondary hover:text-foreground"
      >
        {t(language, "nav.browseSounds")}
      </Link>
      <Link
        to="/studio"
        role="menuitem"
        onClick={() => {
          closeOtherNavGroups();
          setSheetOpen(false);
          onNavigate?.();
        }}
        className="block rounded-sm px-3 py-2.5 text-xs tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:bg-secondary hover:text-foreground"
      >
        {t(language, "nav.studio")}
      </Link>
      <Link
        to="/garage"
        role="menuitem"
        onClick={() => {
          closeOtherNavGroups();
          setSheetOpen(false);
          onNavigate?.();
        }}
        className="block rounded-sm px-3 py-2.5 text-xs tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:bg-secondary hover:text-foreground"
      >
        {t(language, "nav.garage")}
      </Link>
    </div>
  );

  if (variant === "sheet") {
    return (
      <Collapsible open={sheetOpen} onOpenChange={setSheetOpen} className={className}>
        <CollapsibleTrigger
          className={cn(
            "flex w-full items-center justify-between px-4 py-4 text-left text-sm tracking-[0.2em] uppercase outline-none",
            "text-[#e53935] transition-colors hover:text-foreground",
            sheetOpen && "text-foreground",
          )}
        >
          <span>{triggerLabel}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 opacity-70 transition-transform duration-200",
              sheetOpen && "rotate-180",
            )}
            aria-hidden="true"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="border-l border-border/50 ml-4 pr-2 pb-2">
          {profileList}
          {footerLinks}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  if (variant === "compact") {
    return (
      <details
        data-nav-group="sounds-picker"
        className={cn("group/nav relative", className)}
        onToggle={(e) => {
          if ((e.target as HTMLDetailsElement).open) {
            closeOtherNavGroups(e.currentTarget);
          }
        }}
      >
        <summary
          className={cn(
            "inline-flex h-12 cursor-pointer list-none items-center gap-0.5 px-2 text-xs tracking-[0.14em] uppercase outline-none",
            "[&::-webkit-details-marker]:hidden",
            "text-[#e53935] transition-colors hover:text-foreground group-open/nav:text-foreground",
          )}
          aria-label={triggerLabel}
        >
          {triggerLabel}
          <ChevronDown
            className="h-3.5 w-3.5 opacity-70 transition-transform duration-200 group-open/nav:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div
          role="menu"
          className="absolute top-full left-1/2 z-[60] mt-1 w-[min(calc(100vw-1.5rem),18rem)] -translate-x-1/2 border border-border/70 bg-background/95 p-1.5 shadow-lg backdrop-blur-md"
        >
          {profileList}
          {footerLinks}
        </div>
      </details>
    );
  }

  return (
    <details
      data-nav-group="sounds-picker"
      className={cn("group/nav relative", className)}
      onToggle={(e) => {
        if ((e.target as HTMLDetailsElement).open) {
          closeOtherNavGroups(e.currentTarget);
        }
      }}
    >
      <summary
        className={cn(
          "inline-flex min-h-12 cursor-pointer list-none items-center gap-1 px-1.5 text-xs tracking-[0.14em] uppercase outline-none xl:text-[13px]",
          "[&::-webkit-details-marker]:hidden",
          "text-[#e53935] transition-colors hover:text-foreground group-open/nav:text-foreground",
        )}
      >
        {triggerLabel}
        <ChevronDown
          className="h-3.5 w-3.5 opacity-70 transition-transform duration-200 group-open/nav:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div
        id="nav-submenu-sounds-picker"
        role="menu"
        className="absolute top-full left-1/2 z-[60] mt-1 w-[min(calc(100vw-1.5rem),17rem)] -translate-x-1/2 border border-border/70 bg-background/95 p-1.5 shadow-lg backdrop-blur-md"
      >
        {profileList}
        {footerLinks}
      </div>
    </details>
  );
}
