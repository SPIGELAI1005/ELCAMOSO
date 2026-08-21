import { Link } from "@tanstack/react-router";
import { LEGAL_LINKS, LEGAL_OPERATOR } from "@/lib/legal/operator";

/** Site-wide footer with DE/EU/US-oriented legal links. */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer
      id="site-footer"
      className="mt-auto shrink-0 border-t border-border bg-[#0A0A0A] pb-[max(2rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:px-10">
        <p className="text-[11px] tracking-[0.34em] text-foreground uppercase">
          E L C Λ M O S O
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Your EV. Your Sound. More Emotion.
        </p>

        <p className="mt-8 text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
          Legal
        </p>
        <nav
          aria-label="Legal"
          className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-xs tracking-[0.14em] text-foreground uppercase"
        >
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="underline-offset-4 hover:underline"
              activeProps={{ className: "underline" }}
            >
              {link.label}
            </Link>
          ))}
          <Link to="/about" className="underline-offset-4 hover:underline">
            About
          </Link>
        </nav>

        <p className="mt-8 max-w-xl text-[11px] leading-relaxed text-muted-foreground">
          © {year} {LEGAL_OPERATOR.serviceName}. Motion stays on this device unless you
          opt into ELCAMOSO Cloud or Usage insights. Not a vehicle control or safety
          system. Drive attentively and obey local traffic law.
        </p>
      </div>
    </footer>
  );
}
