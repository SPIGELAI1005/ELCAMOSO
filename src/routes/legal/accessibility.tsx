import { createSeoHeadFromPath } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { LEGAL_OPERATOR } from "@/lib/legal/operator";

export const Route = createFileRoute("/legal/accessibility")({
  component: Accessibility,
  head: () => createSeoHeadFromPath("/legal/accessibility"),
});

function Accessibility() {
  return (
    <LegalPage
      title="Accessibility"
      subtitle="Our commitment to making ELCAMOSO usable (EU Web Accessibility / ADA-oriented)."
    >
      <LegalSection title="Commitment">
        <p>
          We aim for ELCAMOSO to be perceivable, operable, understandable and robust, aligned with
          WCAG 2.2 Level AA where practicable for a real-time audio web app.
        </p>
      </LegalSection>

      <LegalSection title="Measures we take">
        <ul className="list-disc space-y-2 pl-5">
          <li>Semantic headings and labelled controls on primary flows</li>
          <li>Keyboard-reachable navigation and form controls where the UI allows</li>
          <li>Respect for reduced-motion preferences for non-essential animation</li>
          <li>Touch targets sized for mobile where feasible (about 44 px on key controls)</li>
          <li>Text alternatives for primary brand controls via aria-labels</li>
        </ul>
      </LegalSection>

      <LegalSection title="Known limitations">
        <p>
          Real-time Drive and Demo audio graphs are inherently auditory. Some Studio / Debug
          diagnostics may be denser. Canvas or wave visuals may not fully convey the same
          information as sound. We continue to improve focus order, contrast, and screen-reader
          labelling.
        </p>
      </LegalSection>

      <LegalSection title="Feedback">
        <p>
          If you encounter a barrier, contact{" "}
          <a
            className="text-foreground underline-offset-2 hover:underline"
            href={`mailto:${LEGAL_OPERATOR.email}`}
          >
            {LEGAL_OPERATOR.email}
          </a>{" "}
          with the page URL, browser, and a short description. We will try to respond and improve.
        </p>
        <p>
          Related:{" "}
          <Link to="/legal/privacy" className="text-foreground underline-offset-2 hover:underline">
            Privacy
          </Link>
          ,{" "}
          <Link to="/settings" className="text-foreground underline-offset-2 hover:underline">
            Settings
          </Link>{" "}
          (reduced motion / language).
        </p>
      </LegalSection>
    </LegalPage>
  );
}
