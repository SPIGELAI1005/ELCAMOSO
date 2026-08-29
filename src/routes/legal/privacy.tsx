import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalNote, LegalPage, LegalSection } from "@/components/LegalPage";
import { LEGAL_OPERATOR } from "@/lib/legal/operator";

export const Route = createFileRoute("/legal/privacy")({
  component: Privacy,
  head: () => ({
    meta: [
      { title: "Privacy Policy · ELCAMOSO" },
      {
        name: "description",
        content: "How ELCAMOSO processes personal data under GDPR and similar US privacy laws.",
      },
      { property: "og:title", content: "Privacy Policy · ELCAMOSO" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/legal/privacy" },
    ],
    links: [{ rel: "canonical", href: "/legal/privacy" }],
  }),
});

function Privacy() {
  const o = LEGAL_OPERATOR;

  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="Datenschutzerklärung / privacy notice for users in the EU/EEA/UK, Germany, and the United States."
    >
      <LegalNote>
        This notice describes the current product design. Have counsel review it for your hosting
        setup if processing expands beyond on-device defaults.
      </LegalNote>

      <LegalSection title="1. Controller">
        <p>
          The controller responsible for processing under the EU General Data Protection Regulation
          (GDPR) is:
        </p>
        <p>
          {o.ownerName}
          <br />
          {o.serviceName}
          <br />
          {o.street}
          <br />
          {o.postalCode} {o.city}, {o.country}
          <br />
          Email:{" "}
          <a
            className="text-foreground underline-offset-2 hover:underline"
            href={`mailto:${o.email}`}
          >
            {o.email}
          </a>
        </p>
      </LegalSection>

      <LegalSection title="2. What ELCAMOSO is">
        <p>
          ELCAMOSO is a web application that synthesizes motion-responsive sound for electric
          vehicles. Core motion and audio processing is designed to run on your device in the
          browser (Web Audio API, device sensors when you grant permission).
        </p>
      </LegalSection>

      <LegalSection title="3. Categories of data">
        <p>
          <strong className="font-normal text-foreground">On-device only (default).</strong>{" "}
          Settings, Sound Profiles, Garage items, snippets, drive traces and calibration data are
          stored in your browser storage (for example localStorage / IndexedDB). Motion sensor
          streams used for live sound are processed on-device and are not uploaded unless you
          explicitly enable a cloud feature that requires them.
        </p>
        <p>
          <strong className="font-normal text-foreground">ELCAMOSO Cloud (opt-in).</strong> If you
          enable Cloud sync, we process the Garage / settings document you choose to sync, tied to a
          local account identifier you create. Do not put secrets in free-text fields.
        </p>
        <p>
          <strong className="font-normal text-foreground">Usage insights (opt-in).</strong> If you
          enable Usage insights in Settings, we may process aggregate, product-level events (for
          example feature use or crash reports without raw GPS trails). See Settings for the current
          toggle.
        </p>
        <p>
          <strong className="font-normal text-foreground">AI helpers (optional).</strong> If you use
          prompt-to-sound or Find a sound with a server-side model, the text prompt you submit may
          be sent to our server and/or a model provider. Do not include personal data or location in
          prompts.
        </p>
        <p>
          <strong className="font-normal text-foreground">Drive+ billing (optional).</strong> If you
          purchase Drive+, payment is processed by our payment provider (currently Stripe). We
          receive subscription status, customer reference ids, and billing email — not full card
          numbers. See{" "}
          <Link to="/legal/terms" className="text-foreground underline-offset-2 hover:underline">
            Terms of Use
          </Link>{" "}
          for cancellation and refunds.
        </p>
        <p>
          <strong className="font-normal text-foreground">Technical logs.</strong> Our hosting
          provider may process standard server logs (IP address, user agent, timestamps) as
          necessary to operate and secure the website.
        </p>
      </LegalSection>

      <LegalSection title="4. Purposes and legal bases (GDPR)">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Provide the service you request (Art. 6 (1)(b) GDPR) - running the app, saving your
            on-device preferences, optional Cloud sync you enable.
          </li>
          <li>
            Legitimate interests (Art. 6 (1)(f) GDPR) - securing the service, preventing abuse,
            improving reliability via aggregate insights only when you opt in.
          </li>
          <li>
            Consent (Art. 6 (1)(a) GDPR) - optional cookies/storage beyond essential, Usage
            insights, and optional AI prompt processing where consent is required.
          </li>
          <li>
            Legal obligation (Art. 6 (1)(c) GDPR) - where we must retain or disclose information
            under applicable law.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Sensors and permissions">
        <p>
          Location / motion / wake-lock / microphone (if offered) are requested by the browser only
          when a feature needs them. You can deny or revoke permissions in the browser or OS.
          Denying sensors limits Drive features; Demo and Audition remain available without them.
        </p>
      </LegalSection>

      <LegalSection title="6. Retention">
        <p>
          On-device data remains until you clear site data, use in-app reset, or uninstall the PWA.
          Cloud documents are retained while your account remains active or until you delete them.
          Server logs are retained only as long as needed for security and operations, then deleted
          or anonymised.
        </p>
      </LegalSection>

      <LegalSection title="7. Recipients and transfers">
        <p>
          We do not sell personal information. Processors may include hosting, CDN, email, and (if
          configured) AI API providers. If personal data is transferred outside the EU/EEA/UK, we
          rely on an adequacy decision or appropriate safeguards such as Standard Contractual
          Clauses, unless an exception applies.
        </p>
      </LegalSection>

      <LegalSection title="8. Your rights (EU/EEA/UK)">
        <p>
          Subject to applicable law, you may have the right to access, rectify, erase, restrict,
          port, and object to processing, and to withdraw consent at any time. You may lodge a
          complaint with your local supervisory authority (in Germany, typically your state data
          protection authority / BfDI context as applicable).
        </p>
        <p>
          Contact:{" "}
          <a
            className="text-foreground underline-offset-2 hover:underline"
            href={`mailto:${o.email}`}
          >
            {o.email}
          </a>
        </p>
      </LegalSection>

      <LegalSection title="9. United States (including California)">
        <p>
          We do not sell or share personal information for cross-context behavioural advertising as
          those terms are commonly defined under the CCPA/CPRA. On-device processing is the default.
          If you are a California resident, you may request to know, delete, or correct personal
          information we hold about you in Cloud or logs, subject to exceptions. Contact{" "}
          <a
            className="text-foreground underline-offset-2 hover:underline"
            href={`mailto:${o.email}`}
          >
            {o.email}
          </a>
          . We will not discriminate against you for exercising privacy rights.
        </p>
      </LegalSection>

      <LegalSection title="10. Children">
        <p>
          ELCAMOSO is not directed to children under 16 (EU) or under 13 (US COPPA). Do not use the
          service if you are below the applicable age.
        </p>
      </LegalSection>

      <LegalSection title="11. Cookies and similar technologies">
        <p>
          See our{" "}
          <Link to="/legal/cookies" className="text-foreground underline-offset-2 hover:underline">
            Cookie notice
          </Link>{" "}
          for details. Essential storage is required for the app to remember settings.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes">
        <p>
          We may update this notice when the product or law changes. The “Last updated” date at the
          top of this page will change accordingly.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
