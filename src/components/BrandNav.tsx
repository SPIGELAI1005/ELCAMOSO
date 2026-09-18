"use client";

import { Link, useRouterState } from "@tanstack/react-router";
import { AccountMenu } from "@/components/AccountMenu";
import { ElcamosoLogo, ElcamosoMark } from "@/components/ElcamosoLogo";
import { WaveMenuIcon } from "@/components/WaveMenuIcon";
import {
  Sheet,
  SheetClose,
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

type NavLink = {
  to: string;
  key: string;
  accent?: boolean;
};

/** Desktop primary navigation. */
const DESKTOP_LINKS: NavLink[] = [
  { to: "/drive", key: "nav.drive", accent: true },
  { to: "/explore", key: "nav.explore" },
  { to: "/studio", key: "nav.studio" },
  { to: "/garage", key: "nav.garage" },
  { to: "/sounds", key: "nav.sounds" },
  { to: "/demo", key: "nav.demo" },
  { to: "/pricing", key: "nav.pricing" },
  { to: "/about", key: "nav.about", accent: true },
  { to: "/settings", key: "nav.settings" },
];

const MENU_LINKS: NavLink[] = [
  { to: "/", key: "nav.home" },
  { to: "/drive", key: "nav.drive", accent: true },
  { to: "/explore", key: "nav.explore" },
  { to: "/studio", key: "nav.studio" },
  { to: "/garage", key: "nav.garage" },
  { to: "/sounds", key: "nav.sounds" },
  { to: "/demo", key: "nav.demo" },
  { to: "/pricing", key: "nav.pricing" },
  { to: "/settings", key: "nav.settings" },
  { to: "/about", key: "nav.about", accent: true },
];

function navLinkClassName(accent?: boolean) {
  return accent
    ? "text-[#e53935] transition-colors hover:text-[#ff5252]"
    : "text-muted-foreground transition-colors hover:text-foreground";
}

function navLinkActiveClassName(accent?: boolean) {
  return accent ? "text-[#e53935]" : "text-foreground";
}

export function BrandNav() {
  const { settings } = useSettings();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { safetyMode } = useSessionSelector((snap) => ({ safetyMode: snap.safetyMode }));
  const onDrive = pathname === "/drive" || pathname.startsWith("/drive/");
  if (safetyMode && onDrive) return null;

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:gap-4 lg:px-8">
        <Link
          to="/"
          aria-label="ELCAMOSO home"
          className="hidden min-w-0 shrink-0 md:inline-flex lg:hidden"
        >
          <ElcamosoMark className="h-8 w-auto" />
        </Link>

        <Link to="/" aria-label="ELCAMOSO home" className="hidden min-w-0 shrink-0 lg:inline-flex">
          <ElcamosoLogo variant="full" />
        </Link>

        <div className="flex-1 lg:hidden" aria-hidden="true" />

        <nav
          className="hidden min-w-0 items-center gap-4 text-[11px] tracking-[0.16em] uppercase lg:flex xl:gap-6 xl:text-xs"
          aria-label="Primary"
        >
          {DESKTOP_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={navLinkClassName(link.accent)}
              activeProps={{ className: navLinkActiveClassName(link.accent) }}
            >
              {t(settings.language, link.key)}
            </Link>
          ))}
          <AccountMenu className="ml-1" />
        </nav>

        <div className="flex items-center gap-1 lg:hidden">
          <AccountMenu />
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                data-testid="nav-menu"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary"
                aria-label={t(settings.language, "nav.menu")}
              >
                <WaveMenuIcon open={false} />
              </button>
            </SheetTrigger>

            <SheetContent
              side="right"
              id="nav-sheet"
              data-testid="nav-sheet"
              className="flex w-[min(100%,20rem)] flex-col border-border bg-background px-0 pt-14"
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
                {MENU_LINKS.map((link) => (
                  <SheetClose asChild key={link.to}>
                    <Link
                      to={link.to}
                      className={cn(
                        "px-4 py-4 text-sm tracking-[0.2em] uppercase transition-colors",
                        navLinkClassName(link.accent),
                      )}
                      activeProps={{ className: navLinkActiveClassName(link.accent) }}
                    >
                      {t(settings.language, link.key)}
                    </Link>
                  </SheetClose>
                ))}
                <AccountMenu variant="row" />
              </nav>
              <div className="mt-auto border-t border-border px-6 py-6">
                <p className="text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
                  Legal
                </p>
                <nav
                  aria-label="Legal"
                  className="mt-4 flex flex-col gap-3 text-xs tracking-[0.16em] text-muted-foreground uppercase"
                >
                  <SheetClose asChild>
                    <Link to="/legal/impressum" className="hover:text-foreground">
                      Impressum
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link to="/legal/privacy" className="hover:text-foreground">
                      Privacy
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link to="/legal/cookies" className="hover:text-foreground">
                      Cookies
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link to="/legal/terms" className="hover:text-foreground">
                      Terms
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link to="/legal" className="hover:text-foreground">
                      All legal
                    </Link>
                  </SheetClose>
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
