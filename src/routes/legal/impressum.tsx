import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { LEGAL_OPERATOR, operatorAddressLines } from "@/lib/legal/operator";

export const Route = createFileRoute("/legal/impressum")({
  component: Impressum,
  head: () => ({
    meta: [
      { title: "Impressum · ELCAMOSO" },
      {
        name: "description",
        content: "Legal notice (Impressum) for ELCAMOSO pursuant to Section 5 DDG.",
      },
      { property: "og:title", content: "Impressum · ELCAMOSO" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/legal/impressum" },
    ],
    links: [{ rel: "canonical", href: "/legal/impressum" }],
  }),
});

/**
 * Structured like https://www.one4team.com/impressum
 * (Service provider, Contact, Consumer dispute resolution).
 */
function Impressum() {
  const o = LEGAL_OPERATOR;

  return (
    <LegalPage
      title="Legal Notice"
      subtitle="Information pursuant to Section 5 DDG (German Digital Services Act)"
    >
      <LegalSection title="Service provider">
        <p className="text-foreground">{o.serviceName}</p>
        <p>Owner: {o.ownerName}</p>
        {operatorAddressLines().map((line) => (
          <p key={line}>{line}</p>
        ))}
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Email:{" "}
          <a
            className="text-foreground underline-offset-2 hover:underline"
            href={`mailto:${o.email}`}
          >
            {o.email}
          </a>
        </p>
      </LegalSection>

      <LegalSection title="Consumer dispute resolution">
        <p>
          We are neither willing nor obliged to participate in dispute resolution proceedings before
          a consumer arbitration board.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
