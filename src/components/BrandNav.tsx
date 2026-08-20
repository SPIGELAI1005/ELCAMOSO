import { Link } from "@tanstack/react-router";
import { ElcamosoLogo } from "@/components/ElcamosoLogo";

const LINKS = [
  { to: "/drive", label: "Drive" },
  { to: "/sounds", label: "Sounds" },
  { to: "/settings", label: "Settings" },
] as const;

export function BrandNav() {
  return (
    <header className="flex items-center justify-between px-6 py-6 sm:px-10">
      <Link to="/" aria-label="ELCAMOSO home">
        <ElcamosoLogo variant="full" />
      </Link>
      <nav className="flex items-center gap-6 text-xs tracking-[0.18em] uppercase">
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
