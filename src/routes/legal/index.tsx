import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { LEGAL_LINKS } from "@/lib/legal/operator";

export const Route = createFileRoute("/legal/")({
  component: LegalIndex,
  head: () => ({
    meta: [
      { title: "Legal · ELCAMOSO" },
      {
        name: "description",
        content: "Impressum, privacy, cookies, terms and accessibility for ELCAMOSO.",
      },
      { property: "og:title", content: "Legal · ELCAMOSO" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/legal" },
    ],
    links: [{ rel: "canonical", href: "/legal" }],
  }),
});

function LegalIndex() {
  return (
    <LegalPage
      title="Legal"
      subtitle="Information required for users in Germany, the EU/EEA/UK, and the United States."
    >
      <LegalSection title="Documents">
        <ul className="space-y-3">
          {LEGAL_LINKS.map((link) => (
            <li key={link.to}>
              <Link
                to={link.to}
                className="text-foreground underline-offset-2 hover:underline"
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <Link to="/about" className="text-foreground underline-offset-2 hover:underline">
              About ELCAMOSO
            </Link>
          </li>
        </ul>
      </LegalSection>
    </LegalPage>
  );
}
