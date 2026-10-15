"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import { PremiumBadge } from "@/components/premium/PremiumBadge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getSession } from "@/lib/drive/session";
import { useSettings } from "@/lib/drive/useSettings";
import { useFeatureAccess } from "@/lib/entitlements/selectors";
import { t, type Locale } from "@/lib/i18n";
import {
  PROFILE_CATEGORIES,
  SOUND_PROFILES,
  type ProfileCategory,
  type SoundProfile,
} from "@/lib/sound/profiles";
import { useSessionSelector } from "@/lib/store/session-store";
import { cn } from "@/lib/utils";

function profilesByCategory(): { category: ProfileCategory; profiles: SoundProfile[] }[] {
  return PROFILE_CATEGORIES.map((category) => ({
    category,
    profiles: SOUND_PROFILES.filter((p) => p.category === category),
  })).filter((group) => group.profiles.length > 0);
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
 * (or all profiles while VITE_UNLOCK_ALL_SOUNDS testing unlock is on).
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
  const groups = useMemo(() => profilesByCategory(), []);

  function canSelect(id: string) {
    return canDriveWithProfile(id) || canPreviewProfile(id);
  }

  function selectProfile(id: string) {
    if (!canSelect(id)) return;
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

  const profileList = (
    <div className="max-h-[min(70vh,28rem)] overflow-y-auto overscroll-contain">
      {groups.map(({ category, profiles }) => (
        <div key={category} className="mb-1">
          <p className="px-3 py-1.5 text-[9px] tracking-[0.22em] text-muted-foreground/70 uppercase">
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
