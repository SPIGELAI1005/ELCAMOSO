"use client";

import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { Fragment, useEffect, useState } from "react";

import { AccountMenu } from "@/components/AccountMenu";
import { ElcamosoLogo, ElcamosoMark } from "@/components/ElcamosoLogo";
import { HeaderSoundsMenu } from "@/components/HeaderSoundsMenu";
import { WaveMenuIcon } from "@/components/WaveMenuIcon";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useSettings } from "@/lib/drive/useSettings";
import { useSessionSelector } from "@/lib/store/session-store";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type NavLeaf = {
  to: string;
  key: string;
  accent?: boolean;
};

type NavGroup = {
  kind: "group";
  id: string;
  key: string;
  accent?: boolean;
  items: NavLeaf[];
};

type NavLinkItem = NavLeaf & { kind: "link" };

type NavEntry = NavLinkItem | NavGroup;

/** Desktop + mobile primary navigation (groups render as dropdown / accordion). */
const NAV_ENTRIES: NavEntry[] = [
  { kind: "link", to: "/", key: "nav.home" },
  { kind: "link", to: "/drive", key: "nav.drive", accent: true },
  // Sounds profile picker is rendered separately (HeaderSoundsMenu) in red.
  {
    kind: "group",
    id: "explore",
    key: "nav.explore",
    items: [
      { to: "/explore", key: "nav.explore" },
      { to: "/demo", key: "nav.demo" },
    ],
  },
  { kind: "link", to: "/pricing", key: "nav.pricing" },
  {
    kind: "group",
    id: "about",
    key: "nav.about",
    accent: true,
    items: [
      { to: "/story", key: "nav.story" },
      { to: "/science", key: "nav.science" },
      { to: "/crew", key: "nav.crew" },
      { to: "/news", key: "nav.news" },
    ],
  },
  { kind: "link", to: "/settings", key: "nav.settings" },
];

const DESKTOP_ENTRIES = NAV_ENTRIES.filter(
  (entry) => !(entry.kind === "link" && entry.to === "/"),
);

function isNavLinkActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

function isGroupActive(pathname: string, items: NavLeaf[]) {
  return items.some((item) => isNavLinkActive(pathname, item.to));
}

function navLinkClassName(active: boolean, accent?: boolean) {
  if (active) return "text-foreground transition-colors";
  if (accent) return "text-[#e53935] transition-colors hover:text-foreground";
  return "text-muted-foreground transition-colors hover:text-foreground";
}

function closeDesktopNavGroups(except?: Element | null) {
  document.querySelectorAll("details[data-nav-group]").forEach((node) => {
    if (except && node === except) return;
    (node as HTMLDetailsElement).open = false;
  });
}

function DesktopNavGroup({
  group,
  pathname,
  language,
}: {
  group: NavGroup;
  pathname: string;
  language: Parameters<typeof t>[0];
}) {
  const groupActive = isGroupActive(pathname, group.items);

  return (
    <details data-nav-group={group.id} className="group/nav relative">
      <summary
        className={cn(
          "inline-flex min-h-12 cursor-pointer list-none items-center gap-1 px-1.5 text-xs tracking-[0.14em] uppercase outline-none xl:text-[13px]",
          "[&::-webkit-details-marker]:hidden",
          navLinkClassName(groupActive, group.accent),
          "group-open/nav:text-foreground",
        )}
      >
        {t(language, group.key)}
        <ChevronDown
          className="h-3.5 w-3.5 opacity-70 transition-transform duration-200 group-open/nav:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div
        id={`nav-submenu-${group.id}`}
        role="menu"
        className="absolute top-full left-0 z-[60] mt-1 min-w-[11.5rem] border border-border/70 bg-background/95 p-1.5 tracking-[0.14em] uppercase shadow-lg backdrop-blur-md"
      >
        {group.items.map((item) => {
          const active = isNavLinkActive(pathname, item.to);
          return (
            <Link
              key={item.to}
              role="menuitem"
              to={item.to}
              aria-current={active ? "page" : undefined}
              onClick={() => closeDesktopNavGroups()}
              className={cn(
                "block rounded-sm px-3 py-3 text-xs transition-colors hover:bg-secondary hover:text-foreground",
                navLinkClassName(active, item.accent),
              )}
            >
              {t(language, item.key)}
            </Link>
          );
        })}
      </div>
    </details>
  );
}

function MobileNavGroup({
  group,
  pathname,
  language,
  open,
  onOpenChange,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  language: Parameters<typeof t>[0];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: () => void;
}) {
  const groupActive = isGroupActive(pathname, group.items);

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center justify-between px-4 py-4 text-left text-sm tracking-[0.2em] uppercase outline-none",
          navLinkClassName(groupActive, group.accent),
        )}
      >
        <span>{t(language, group.key)}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 opacity-70 transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-l border-border/50 ml-4">
        {group.items.map((item) => {
          const active = isNavLinkActive(pathname, item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "block px-4 py-3.5 text-sm tracking-[0.2em] uppercase",
                navLinkClassName(active, item.accent ?? group.accent),
              )}
            >
              {t(language, item.key)}
            </Link>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function BrandNav() {
  const { settings } = useSettings();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { safetyMode } = useSessionSelector((snap) => ({ safetyMode: snap.safetyMode }));
  const onDrive = pathname === "/drive" || pathname.startsWith("/drive/");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mobileOpenGroups, setMobileOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!sheetOpen) setMobileOpenGroups({});
  }, [sheetOpen]);

  useEffect(() => {
    closeDesktopNavGroups();
  }, [pathname]);

  if (safetyMode && onDrive) return null;

  function closeSheet() {
    setSheetOpen(false);
  }

  function setGroupOpen(id: string, next: boolean) {
    setMobileOpenGroups((prev) => ({ ...prev, [id]: next }));
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 overflow-visible border-b border-border/60 bg-background/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="relative flex h-[3.85rem] items-center justify-between gap-3 overflow-visible px-4 sm:h-[4.4rem] sm:px-6 lg:gap-4 lg:px-8">
        <div className="z-10 flex min-w-0 shrink-0 items-center">
          <Link
            to="/"
            aria-label="ELCAMOSO home"
            className="hidden min-w-0 shrink-0 md:inline-flex lg:hidden"
          >
            <ElcamosoMark className="h-9 w-auto" />
          </Link>

          <Link to="/" aria-label="ELCAMOSO home" className="hidden min-w-0 shrink-0 lg:inline-flex">
            <ElcamosoLogo variant="full" className="scale-110" />
          </Link>
        </div>

        {/* Centered Sounds shortcut (mobile + desktop). */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 flex -translate-x-1/2 items-center">
          <div className="pointer-events-auto">
            <HeaderSoundsMenu language={settings.language} variant="nav" />
          </div>
        </div>

        <nav
          className="z-10 hidden min-w-0 items-center gap-3 overflow-visible text-xs tracking-[0.14em] uppercase lg:flex xl:gap-4 xl:text-[13px]"
          aria-label="Primary"
        >
          {DESKTOP_ENTRIES.map((entry) => {
            if (entry.kind === "group") {
              return (
                <DesktopNavGroup
                  key={entry.id}
                  group={entry}
                  pathname={pathname}
                  language={settings.language}
                />
              );
            }
            const active = isNavLinkActive(pathname, entry.to);
            return (
              <Link
                key={entry.to}
                to={entry.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-12 items-center px-1.5",
                  navLinkClassName(active, entry.accent),
                )}
              >
                {t(settings.language, entry.key)}
              </Link>
            );
          })}
          <AccountMenu className="ml-1" />
        </nav>

        <div className="z-10 flex items-center gap-1 lg:hidden">
          <AccountMenu />
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                data-testid="nav-menu"
                className="inline-flex h-12 w-12 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary"
                aria-label={t(settings.language, "nav.menu")}
                aria-expanded={sheetOpen}
              >
                <WaveMenuIcon open={sheetOpen} />
              </button>
            </SheetTrigger>

            <SheetContent
              side="right"
              id="nav-sheet"
              data-testid="nav-sheet"
              className="nav-sheet-scroll flex w-[min(100%,20rem)] flex-col border-border bg-background px-0 pt-14"
            >
              <SheetHeader className="space-y-4 border-b border-border px-6 pb-6 text-left">
                <div className="flex items-center gap-3">
                  <ElcamosoMark className="h-8 w-auto" />
                  <SheetTitle className="font-light tracking-[0.2em] uppercase">
                    ELCAMOSO
                  </SheetTitle>
                </div>
                <SheetDescription className="text-left text-xs tracking-[0.12em] text-muted-foreground">
                  {t(settings.language, "nav.menuHint")}
                </SheetDescription>
              </SheetHeader>
              <nav className="flex flex-col px-2 py-4" aria-label="Mobile">
                {NAV_ENTRIES.map((entry) => {
                  if (entry.kind === "group") {
                    return (
                      <MobileNavGroup
                        key={entry.id}
                        group={entry}
                        pathname={pathname}
                        language={settings.language}
                        open={Boolean(mobileOpenGroups[entry.id])}
                        onOpenChange={(next) => setGroupOpen(entry.id, next)}
                        onNavigate={closeSheet}
                      />
                    );
                  }
                  const active = isNavLinkActive(pathname, entry.to);
                  const link = (
                    <Link
                      to={entry.to}
                      aria-current={active ? "page" : undefined}
                      onClick={closeSheet}
                      className={cn(
                        "px-4 py-4 text-sm tracking-[0.2em] uppercase",
                        navLinkClassName(active, entry.accent),
                      )}
                    >
                      {t(settings.language, entry.key)}
                    </Link>
                  );
                  if (entry.to === "/drive") {
                    const soundsActive = isNavLinkActive(pathname, "/sounds");
                    const studioActive = isNavLinkActive(pathname, "/studio");
                    const garageActive = isNavLinkActive(pathname, "/garage");
                    return (
                      <Fragment key="drive-sounds-mobile">
                        {link}
                        <Link
                          to="/sounds"
                          aria-current={soundsActive ? "page" : undefined}
                          onClick={closeSheet}
                          className={cn(
                            "px-4 py-4 text-sm tracking-[0.2em] uppercase",
                            navLinkClassName(soundsActive, true),
                          )}
                        >
                          {t(settings.language, "nav.sounds")}
                        </Link>
                        <Link
                          to="/studio"
                          aria-current={studioActive ? "page" : undefined}
                          onClick={closeSheet}
                          className={cn(
                            "px-4 py-4 text-sm tracking-[0.2em] uppercase",
                            navLinkClassName(studioActive),
                          )}
                        >
                          {t(settings.language, "nav.studio")}
                        </Link>
                        <Link
                          to="/garage"
                          aria-current={garageActive ? "page" : undefined}
                          onClick={closeSheet}
                          className={cn(
                            "px-4 py-4 text-sm tracking-[0.2em] uppercase",
                            navLinkClassName(garageActive),
                          )}
                        >
                          {t(settings.language, "nav.garage")}
                        </Link>
                      </Fragment>
                    );
                  }
                  return <Fragment key={entry.to}>{link}</Fragment>;
                })}
                <AccountMenu variant="row" onNavigate={closeSheet} />
              </nav>
              <div className="mt-auto border-t border-border px-6 py-6">
                <p className="text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
                  Legal
                </p>
                <nav
                  aria-label="Legal"
                  className="mt-4 flex flex-col gap-3 text-xs tracking-[0.16em] text-muted-foreground uppercase"
                >
                  <Link to="/legal/impressum" onClick={closeSheet} className="hover:text-foreground">
                    Impressum
                  </Link>
                  <Link to="/legal/privacy" onClick={closeSheet} className="hover:text-foreground">
                    Privacy
                  </Link>
                  <Link to="/legal/cookies" onClick={closeSheet} className="hover:text-foreground">
                    Cookies
                  </Link>
                  <Link to="/legal/terms" onClick={closeSheet} className="hover:text-foreground">
                    Terms
                  </Link>
                  <Link to="/legal" onClick={closeSheet} className="hover:text-foreground">
                    All legal
                  </Link>
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
