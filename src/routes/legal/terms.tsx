import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalNote, LegalPage, LegalSection } from "@/components/LegalPage";
import { LEGAL_OPERATOR } from "@/lib/legal/operator";

export const Route = createFileRoute("/legal/terms")({
  component: Terms,
  head: () => ({
    meta: [
      { title: "Terms of Use · ELCAMOSO" },
      {
        name: "description",
        content: "Terms of use for the ELCAMOSO web application.",
      },
      { property: "og:title", content: "Terms of Use · ELCAMOSO" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/legal/terms" },
    ],
    links: [{ rel: "canonical", href: "/legal/terms" }],
  }),
});

function Terms() {
  const o = LEGAL_OPERATOR;

  return (
    <LegalPage
      title="Terms of Use"
      subtitle="Conditions for using the ELCAMOSO website and progressive web app (US / EU consumers)."
    >
      <LegalNote>
        These terms are a practical baseline for a consumer web app. Have counsel adapt governing
        law, liability caps, and consumer-rights wording for your entity and markets.
      </LegalNote>

      <LegalSection title="1. Agreement">
        <p>
          By accessing or using {o.serviceName} (“Service”), you agree to these Terms and our{" "}
          <Link to="/legal/privacy" className="text-foreground underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
          . If you do not agree, do not use the Service.
        </p>
      </LegalSection>

      <LegalSection title="2. The Service">
        <p>
          ELCAMOSO provides motion-responsive sound experiences for electric vehicles via a browser
          / PWA. Features may include Demo Drive, Audition, Studio, Garage, and optional Cloud or AI
          helpers. We may change, suspend, or discontinue features with reasonable notice where
          practicable.
        </p>
      </LegalSection>

      <LegalSection title="3. Not a vehicle or safety system">
        <p>
          The Service is entertainment and personalisation software. It does not control the
          vehicle, does not replace OEM systems, and is not a certified safety, ADAS, or navigation
          product. Always drive attentively, keep hands on the wheel as required by law, and comply
          with traffic rules in your jurisdiction. Do not interact with the phone UI while driving;
          use Demo / Audition when parked, or a securely mounted device with audio routed safely.
        </p>
      </LegalSection>

      <LegalSection title="4. Eligibility and accounts">
        <p>
          You must be old enough to form a binding contract in your place of residence and at least
          16 in the EU/EEA/UK (or older if local law requires). Optional Cloud features use a local
          account identifier; you are responsible for activity under that identifier.
        </p>
      </LegalSection>

      <LegalSection title="5. Acceptable use">
        <ul className="list-disc space-y-2 pl-5">
          <li>Do not reverse engineer, disrupt, or overload the Service</li>
          <li>Do not upload unlawful, infringing, or harmful content in snippets or Garage</li>
          <li>Do not use the Service to violate privacy or traffic law</li>
          <li>Do not misrepresent the Service as an OEM or vehicle safety feature</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Intellectual property">
        <p>
          The ELCAMOSO name, mark (O )))), wordmark, UI, and procedural sound designs are protected
          by intellectual property laws. You retain rights to content you lawfully create (for
          example custom Garage takes), and grant us a limited licence to host and process that
          content as needed to provide features you use (including optional share links).
        </p>
      </LegalSection>

      <LegalSection title="7. Drive+ subscriptions (when offered)">
        <p>
          Optional Drive+ is a paid subscription for extended motion sound features. Prices shown in
          the app are in EUR unless stated otherwise. Subscriptions renew automatically until
          canceled through your account plan settings or the payment provider customer portal.
        </p>
        <p>
          Dynamic Drive preview, when offered, is free for eligible accounts: typically 30 minutes
          total, up to three drives, within 14 days, with no card required. Preview terms appear
          before activation.
        </p>
        <p>
          EU/EEA consumers may have a 14-day withdrawal right for distance contracts where applicable
          law grants it. If you expressly request immediate access to digital content during that
          period, you may lose the withdrawal right once delivery begins — as explained at checkout
          where required.
        </p>
        <p>
          Cancel anytime before renewal to avoid the next billing period. We do not prorate partial
          periods unless required by law. Refund requests: contact{" "}
          <a
            className="text-foreground underline-offset-2 hover:underline"
            href={`mailto:${o.email}`}
          >
            {o.email}
          </a>
          . Payment processing is handled by our payment provider; we do not store full card numbers.
        </p>
      </LegalSection>

      <LegalSection title="8. Third-party services">
        <p>
          Optional AI, hosting, or Cloud backends may be provided by processors. Their outages or
          limits may affect features. Links to third-party sites are not endorsements.
        </p>
      </LegalSection>

      <LegalSection title="9. Disclaimer of warranties">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED “AS IS” AND “AS
          AVAILABLE”, WITHOUT WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR
          NON-INFRINGEMENT. SOUND OUTPUT MAY VARY BY DEVICE, BROWSER, AND SPEAKERS.
        </p>
        <p>
          Nothing in these Terms excludes mandatory consumer warranties that cannot be waived under
          German, EU, or applicable US state law.
        </p>
      </LegalSection>

      <LegalSection title="10. Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL,
          SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOSS OF PROFITS, DATA, OR GOODWILL,
          ARISING FROM YOUR USE OF THE SERVICE - INCLUDING ANY DISTRACTION WHILE DRIVING. OUR
          AGGREGATE LIABILITY FOR CLAIMS RELATING TO THE SERVICE IS LIMITED TO THE GREATER OF (A)
          AMOUNTS YOU PAID US FOR THE SERVICE IN THE 12 MONTHS BEFORE THE CLAIM, OR (B) EUR 50 / USD
          50.
        </p>
        <p>
          Liability for intent, gross negligence, injury to life, body or health, and other
          non-excludable liability under German / EU law remains unaffected.
        </p>
      </LegalSection>

      <LegalSection title="11. Governing law">
        <p>
          These Terms are governed by the laws of {o.country}, excluding conflict-of-law rules,
          unless mandatory consumer protection law of your habitual residence applies and cannot be
          derogated from by agreement (especially for EU consumers).
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          Questions:{" "}
          <a
            className="text-foreground underline-offset-2 hover:underline"
            href={`mailto:${o.email}`}
          >
            {o.email}
          </a>
          . See also the{" "}
          <Link
            to="/legal/impressum"
            className="text-foreground underline-offset-2 hover:underline"
          >
            Impressum
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
