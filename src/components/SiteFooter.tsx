import { Link } from "@tanstack/react-router";
import { ElcamosoWordmark } from "@/components/ElcamosoLogo";
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
        <ElcamosoWordmark className="text-[11px] text-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">Your EV. Your Sound. More Emotion.</p>
        <a
          href="https://x.com/CO_FE_X"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="ELCAMOSO on X (opens in a new tab)"
          className="mt-5 inline-flex items-center gap-2 text-xs tracking-[0.14em] text-white uppercase underline-offset-4 hover:underline"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          <span>Follow on X</span>
        </a>

        <p className="mt-8 text-[10px] tracking-[0.28em] text-muted-foreground uppercase">Legal</p>
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
          <Link to="/story" className="underline-offset-4 hover:underline">
            Story
          </Link>
          <Link to="/science" className="underline-offset-4 hover:underline">
            Science
          </Link>
          <Link to="/crew" className="underline-offset-4 hover:underline">
            Crew
          </Link>
          <Link to="/news" className="underline-offset-4 hover:underline">
            News
          </Link>
        </nav>

        <p className="mt-8 max-w-xl text-[11px] leading-relaxed text-muted-foreground">
          © {year} {LEGAL_OPERATOR.serviceName}. Motion stays on this device unless you opt into
          ELCAMOSO Cloud or Usage insights. Not a vehicle control or safety system. Drive
          attentively and obey local traffic law.
        </p>
        <p className="mt-3 max-w-xl text-[11px] leading-relaxed text-muted-foreground">
          All vehicle images are illustrative and for orientation only. ELCAMOSO is an independent
          project and is not affiliated with, endorsed by or sponsored by any brand or car
          manufacturer. All brand and model names are trademarks of their respective owners.
        </p>
      </div>
    </footer>
  );
}
