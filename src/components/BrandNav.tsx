import { Link } from "@tanstack/react-router";
import { ElcamosoLogo } from "@/components/ElcamosoLogo";

const LINKS = [
  { to: "/drive", label: "Drive" },
  { to: "/sounds", label: "Sounds" },
  { to: "/studio", label: "Studio" },
  { to: "/garage", label: "Garage" },
  { to: "/settings", label: "Settings" },
] as const;

export function BrandNav() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 px-6 py-6 sm:px-10">
      <Link to="/" aria-label="ELCAMOSO home">
        <ElcamosoLogo variant="full" />
      </Link>
      <nav className="flex items-center gap-5 text-[11px] tracking-[0.18em] uppercase sm:gap-6 sm:text-xs">
        {LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
