import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ElcamosoLogo, ElcamosoMark } from "@/components/ElcamosoLogo";
import { WaveMenuIcon } from "@/components/WaveMenuIcon";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useSettings } from "@/lib/drive/useSettings";
import { t } from "@/lib/i18n";

const LINKS = [
  { to: "/", key: "nav.home" },
  { to: "/drive", key: "nav.drive" },
  { to: "/sounds", key: "nav.sounds" },
  { to: "/studio", key: "nav.studio" },
  { to: "/garage", key: "nav.garage" },
  { to: "/demo", key: "nav.demo" },
  { to: "/settings", key: "nav.settings" },
] as const;

export function BrandNav() {
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-14 items-center justify-between gap-4 px-4 sm:h-16 sm:px-8">
        <Link
          to="/"
          aria-label="ELCAMOSO home"
          className="hidden min-w-0 shrink md:inline-flex"
        >
          <ElcamosoLogo variant="full" />
        </Link>

        {/* Spacer keeps the wave menu pinned right while the mark is hidden. */}
        <div className="flex-1 md:hidden" aria-hidden="true" />

        <nav
          className="hidden items-center gap-5 text-[11px] tracking-[0.18em] uppercase md:flex md:gap-6 md:text-xs"
          aria-label="Primary"
        >
          {LINKS.filter((link) => link.to !== "/").map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {t(settings.language, link.key)}
            </Link>
          ))}
        </nav>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary md:hidden"
              aria-label={open ? t(settings.language, "nav.close") : t(settings.language, "nav.menu")}
            >
              <WaveMenuIcon open={open} />
            </button>
          </SheetTrigger>

          <SheetContent
            side="right"
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
              {LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className="px-4 py-4 text-sm tracking-[0.2em] text-muted-foreground uppercase transition-colors hover:text-foreground"
                  activeProps={{ className: "text-foreground" }}
                >
                  {t(settings.language, link.key)}
                </Link>
              ))}
            </nav>
            <div className="mt-auto border-t border-border px-6 py-6">
              <p className="text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
                Legal
              </p>
              <nav
                aria-label="Legal"
                className="mt-4 flex flex-col gap-3 text-xs tracking-[0.16em] text-muted-foreground uppercase"
              >
                <Link to="/legal/impressum" onClick={() => setOpen(false)} className="hover:text-foreground">
                  Impressum
                </Link>
                <Link to="/legal/privacy" onClick={() => setOpen(false)} className="hover:text-foreground">
                  Privacy
                </Link>
                <Link to="/legal/cookies" onClick={() => setOpen(false)} className="hover:text-foreground">
                  Cookies
                </Link>
                <Link to="/legal/terms" onClick={() => setOpen(false)} className="hover:text-foreground">
                  Terms
                </Link>
                <Link to="/legal" onClick={() => setOpen(false)} className="hover:text-foreground">
                  All legal
                </Link>
              </nav>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
