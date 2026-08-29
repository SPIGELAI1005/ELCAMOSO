import { Link, useRouterState } from "@tanstack/react-router";
import { useSessionSelector } from "@/lib/store/session-store";
import { useSettings } from "@/lib/drive/useSettings";
import { t } from "@/lib/i18n";

const PRIMARY = [
  { to: "/drive", key: "nav.drive" as const },
  { to: "/sounds", key: "nav.sounds" as const },
  { to: "/studio", key: "nav.studio" as const },
  { to: "/garage", key: "nav.garage" as const },
];

/** Mobile primary destinations. Hidden during driving safety mode. */
export function PrimaryBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { safetyMode } = useSessionSelector((snap) => ({ safetyMode: snap.safetyMode }));
  const { settings } = useSettings();
  const onDrive = pathname === "/drive" || pathname.startsWith("/drive/");
  if (safetyMode && onDrive) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md supports-[backdrop-filter]:bg-background/80 md:hidden"
    >
      <div className="grid h-14 grid-cols-4">
        {PRIMARY.map((link) => {
          const active =
            pathname === link.to || (link.to !== "/" && pathname.startsWith(`${link.to}/`));
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`flex items-center justify-center text-[10px] tracking-[0.16em] uppercase ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {t(settings.language, link.key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
