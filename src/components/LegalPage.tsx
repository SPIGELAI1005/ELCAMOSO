import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LEGAL_LINKS, LEGAL_OPERATOR } from "@/lib/legal/operator";

interface LegalPageProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** Shared shell for Impressum / Privacy / Cookies / Terms pages. */
export function LegalPage({ title, subtitle, children }: LegalPageProps) {
  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-2xl px-6 pt-12 pb-28 sm:px-10 sm:pt-16">
        <p className="text-[11px] tracking-[0.34em] text-muted-foreground uppercase">Legal</p>
        <h1 className="mt-4 text-3xl font-light">{title}</h1>
        {subtitle ? <p className="mt-3 text-sm text-muted-foreground">{subtitle}</p> : null}
        <p className="mt-2 text-xs text-muted-foreground">
          Last updated: {LEGAL_OPERATOR.lastUpdated}
        </p>

        <nav
          aria-label="Legal pages"
          className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-b border-border pb-6 text-[10px] tracking-[0.18em] text-muted-foreground uppercase"
        >
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="legal-prose mt-10 space-y-6 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      </div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-light text-foreground">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

export function LegalNote({ children }: { children: ReactNode }) {
  return (
    <aside className="border border-border bg-[#0A0A0A] p-4 text-xs leading-relaxed text-muted-foreground">
      {children}
    </aside>
  );
}
