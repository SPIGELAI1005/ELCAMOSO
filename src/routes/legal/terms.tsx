import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { createSeoHeadFromPath } from "@/lib/seo";
import { LegalNote, LegalPage, LegalSection } from "@/components/LegalPage";
import { LEGAL_OPERATOR } from "@/lib/legal/operator";

export const Route = createFileRoute("/legal/terms")({
  component: Terms,
  head: () => createSeoHeadFromPath("/legal/terms"),
});

function Terms() {
  const o = LEGAL_OPERATOR;
  const hash = useRouterState({ select: (s) => s.location.hash });
  useEffect(() => {
    const id = hash.replace(/^#/, "");
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [hash]);

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
          Optional Drive+, Drive the Music and Drive Unlimited are paid subscriptions for extended
          motion sound features. Prices shown in the app are in EUR unless stated otherwise
          (currently €33.60 per year for yearly Drive+ and yearly Drive the Music, early-adopter
          display). Payment is processed by our payment provider; we do not store full card numbers.
        </p>
        <p>
          Dynamic Drive preview, when offered, is free for eligible accounts: typically 30 minutes
          total, up to three drives, within 14 days, with no card required. Preview terms appear
          before activation.
        </p>
        <p>
          Consumers have a statutory 14-day right of withdrawal (Widerrufsrecht, §§ 312g, 355 BGB)
          for distance contracts. The{" "}
          <Link
            to="/legal/withdrawal"
            className="text-foreground underline-offset-2 hover:underline"
          >
            withdrawal information and model form
          </Link>{" "}
          apply. If you expressly request immediate start of the digital service at checkout and
          acknowledge the legal consequences, the withdrawal right for digital content expires when
          performance starts (§ 356(5) BGB); for services you owe a pro-rata amount if you then
          withdraw (§ 357a BGB). A valid withdrawal within 14 days refunds the payment and revokes
          Founder perks granted by that purchase (no forever sounds / Founder seat from that
          purchase).
        </p>
        <p>
          Ordinary termination: monthly plans may be cancelled at any time and then end at the close
          of the current billing period. Yearly plans run for 12 months. After the initial term they
          are cancellable at any time with one month’s notice, as permitted after 1 March 2022 (§
          309 Nr. 9 BGB). There is no refund of the remaining yearly term except where the law
          requires it. Forever sounds from a Founders Pack stay yours after a regular cancellation.
          Use{" "}
          <Link to="/legal/cancel" className="text-foreground underline-offset-2 hover:underline">
            Cancel contract (Verträge hier kündigen)
          </Link>{" "}
          to terminate.
        </p>
        <p>
          Refund and cancellation questions:{" "}
          <a
            className="text-foreground underline-offset-2 hover:underline"
            href={`mailto:${o.email}`}
          >
            {o.email}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="7a. Founders, Crew and rewards">
        <p>
          The Founders Pack, Founders Test Crew, Smiles, Smile Shop, invite rewards, leaderboards,
          challenges and promotions are governed additionally by our{" "}
          <Link to="/legal/rewards" className="text-foreground underline-offset-2 hover:underline">
            Founders, Crew &amp; Rewards Terms
          </Link>
          .
        </p>
        <p>
          The Founders Pack is a yearly Drive+ or yearly Drive the Music subscription at the price
          shown at checkout (currently €33.60 per year, early-adopter display). Checkout uses those
          existing yearly prices; there is no separate Founders Pack Stripe product. Anyone who
          purchases one of those yearly packages from 9 November 2026 until 27 November 2026 23:59
          Europe/Berlin becomes a Founder.
        </p>
        <p>
          A Founders Pack buyer receives: (1) the package they paid for (Drive+ or Drive the Music);
          (2) Drive Unlimited free for 4 months from the purchase date, after which access falls
          back to the paid package; (3) four catalog sounds they choose, which remain theirs for as
          long as we operate ELCAMOSO even if they later cancel the subscription. Existing Founders
          who signed up and confirmed before 9 November 2026 23:59 Europe/Berlin keep Racing V10,
          American Muscle V8 and GT V8 forever and Drive Unlimited until 27 May 2027 23:59
          Europe/Berlin. The Black Friday Special does not grant a free Founder seat.
        </p>
      </LegalSection>

      <LegalSection id="black-friday-special" title="7b. Black Friday Special">
        <p>
          The Black Friday Special runs from 9 November 2026 00:00 until 27 November 2026 23:59
          Europe/Berlin. Drive+ is not included.
        </p>
        <p>
          A login (sign in or sign up) is required to receive the Black Friday Special Drive the
          Music minutes. During the offer, signed-in drivers may use Drive the Music for 30 minutes
          per calendar day per account. The daily allowance resets at midnight Europe/Berlin.
          Minutes do not carry over. Paying users and Founders who already own Drive the Music
          (including existing Founders with Drive Unlimited, and anyone who purchases the Founders
          Pack) are not limited by this daily allowance — they keep Drive the Music without the
          30-minute cap. Founders also receive Midnight Dark Rave without a daily limit until 27
          November 2026 23:59 Europe/Berlin.
        </p>
        <p>
          Start Drive on the home page opens Midnight Dark Rave during the offer. Visitors without
          an account may use Midnight Dark Rave for 15 minutes per calendar day. The daily allowance
          resets at midnight Europe/Berlin. Minutes do not carry over. Signed-in drivers may use
          Midnight Dark Rave with no daily limit until 27 November 2026 23:59 Europe/Berlin.
          Midnight Dark Rave does not count against the 30-minute Drive the Music allowance. After
          the offer ends, Start Drive falls back to Racing V10.
        </p>
        <p>
          Separately, Drive the Music may be offered with 4 months included at checkout as a Black
          Friday deal, as shown at purchase. That deal is independent of the daily Black Friday
          Special minutes and of Midnight Dark Rave, and runs until 27 November 2026 23:59
          Europe/Berlin.
        </p>
        <p>
          The Black Friday Special does not grant free Founder status. Signed-in Black Friday
          Special users may purchase the Founders Pack until 27 November 2026 23:59 Europe/Berlin by
          buying yearly Drive+ or yearly Drive the Music at the prices shown at checkout. Buying
          grants Drive Unlimited for 4 months from the purchase date (then the paid package), four
          forever sounds chosen in the app, and the Black Friday Special benefits while the special
          is running. Existing Founders with Drive Unlimited are not limited by the 30-minute Drive
          the Music cap. Founders who signed up and confirmed before 9 November 2026 23:59
          Europe/Berlin keep Racing V10, American Muscle V8 and GT V8 forever and Drive Unlimited
          until 27 May 2027 23:59 Europe/Berlin. Further Founders Pack conditions, including how
          forever-sound picks work, are in the{" "}
          <Link to="/legal/rewards" className="text-foreground underline-offset-2 hover:underline">
            Founders, Crew &amp; Rewards Terms
          </Link>
          .
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
          These Terms are governed by the laws of the Federal Republic of Germany, excluding
          conflict-of-law rules and excluding the UN Convention on Contracts for the International
          Sale of Goods (CISG). Mandatory consumer protection provisions of the law of the country
          in which you have your habitual residence remain unaffected and cannot be derogated from
          by agreement.
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
