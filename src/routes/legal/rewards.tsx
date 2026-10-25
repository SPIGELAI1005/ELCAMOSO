import { createFileRoute, Link } from "@tanstack/react-router";
import { createSeoHeadFromPath } from "@/lib/seo";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { LEGAL_OPERATOR } from "@/lib/legal/operator";

export const Route = createFileRoute("/legal/rewards")({
  component: RewardsTerms,
  head: () => createSeoHeadFromPath("/legal/rewards"),
});

const linkCls = "text-foreground underline-offset-2 hover:underline";

function RewardsTerms() {
  const o = LEGAL_OPERATOR;

  return (
    <LegalPage
      title="Founders, Crew & Rewards Terms"
      subtitle="Additional conditions for the Founders Pack, Founders Test Crew, Smiles, Smile Shop, invites, leaderboards, challenges and promotions."
    >
      <LegalSection title="1. Scope">
        <p>
          These terms add to our{" "}
          <Link to="/legal/terms" className={linkCls}>
            Terms of Use
          </Link>{" "}
          and apply to the Founders Pack, the Founders Test Crew, Smiles, the Smile Shop, invite
          rewards, leaderboards, challenges and promotional banners within {o.serviceName}. If
          these terms conflict with the Terms of Use on a rewards topic, these terms prevail.
          Participation is voluntary and free unless stated otherwise.
        </p>
      </LegalSection>

      <LegalSection title="2. “Free forever” sounds and Founder benefits">
        <p>
          “Free forever” sounds and Founder benefits are provided for as long as we operate
          ELCAMOSO and it remains technically and economically feasible for us to provide them.
          “Forever” does not mean beyond the life of the Service.
        </p>
        <p>
          Sounds may be technically updated, re-mastered or replaced with equivalent sounds, for
          example to improve quality, keep them compatible with new devices or browsers, or for
          legal or licensing reasons.
        </p>
      </LegalSection>

      <LegalSection title="3. Changes to offers, perks and rules">
        <p>
          We may change, pause or end the offer, perks, rewards, smile values, levels, shop items,
          prices and rules for valid reasons, such as abuse, legal or regulatory requirements,
          technical reasons, security, or economic reasons.
        </p>
        <p>
          Minor changes that do not materially affect you (for example wording, design, ordering of
          items, or new rewards) may be made at any time without notice. Material changes that
          affect benefits you already hold will be announced in the app or by email with
          reasonable notice where required by law. Where the law gives you the right to end the
          contract because of such a change, that right remains unaffected.
        </p>
      </LegalSection>

      <LegalSection title="4. Crew perks">
        <p>
          Statements such as “Exclusive Crew perks to follow” describe our current plans. They are
          not a guaranteed entitlement. The content, timing and availability of any Crew perks are
          at our discretion.
        </p>
      </LegalSection>

      <LegalSection title="5. Smiles">
        <ul className="list-disc space-y-2 pl-5">
          <li>Smiles are a loyalty feature, not a currency or a payment instrument.</li>
          <li>Smiles have no cash value and cannot be exchanged for money.</li>
          <li>Smiles are personal, non-transferable and non-refundable.</li>
          <li>
            Smiles may expire if stated in the app, and we may correct a balance that is wrong
            (for example after a technical error or misuse).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Smile Shop">
        <p>
          Smile Shop items, their availability and their smile prices may change. Items are
          available while stocks or offers last. Redeemed items cannot be returned for Smiles or
          money unless the law requires otherwise.
        </p>
      </LegalSection>

      <LegalSection title="7. Invites and Drive+ months">
        <p>
          When an invite qualifies, the invited friend receives 1 month of Drive+ and the inviter
          receives 1 month of Drive+ per qualifying friend, up to 6 months in total. A friend
          qualifies only with a new account, a confirmed email address and a genuine first drive,
          as described in the app.
        </p>
        <p>
          Drive+ months earned through invites or the Smile Shop are time-limited, are not
          exchangeable for cash and cannot be transferred. They do not renew automatically and
          create no paid subscription.
        </p>
      </LegalSection>

      <LegalSection title="8. Founder seats">
        <p>
          Founder seats are limited and allocated on a first come, first served basis. Eligibility
          ends on 09.11.2026 at 23:59 (Berlin time) and requires a confirmed email address. The
          number of seats shown in the app or on the website is for information only and may be
          approximate or delayed.
        </p>
      </LegalSection>

      <LegalSection title="9. Leaderboards and challenges">
        <p>
          Leaderboards and challenges are for fun. There is no entitlement to prizes unless a
          prize is expressly promised in the rules of a specific challenge. Rules are published per
          challenge. We may disqualify participants who break the rules or these terms.
        </p>
      </LegalSection>

      <LegalSection title="10. Fair play and misuse">
        <ul className="list-disc space-y-2 pl-5">
          <li>One account per person.</li>
          <li>No fake accounts, fake or simulated drives, bots or scripts.</li>
          <li>No manipulated location, motion or other data.</li>
          <li>No self-referrals or invite schemes between your own accounts.</li>
        </ul>
        <p>
          If we have reasonable indications of misuse, we may void Smiles, rewards and referral
          months, withdraw Founder status or seats, remove leaderboard entries, or suspend or close
          the accounts involved. Where reasonable, we will tell you and give you the opportunity to
          respond.
        </p>
      </LegalSection>

      <LegalSection title="11. Drive safely">
        <p>
          Use all features only in compliance with traffic laws and never in a way that distracts
          you from driving. No Smiles, rewards or rankings are given for unsafe or unlawful
          driving, and we may remove any that result from it. Do not interact with the app while
          driving.
        </p>
      </LegalSection>

      <LegalSection title="12. Your rights, law and liability">
        <p>
          Your statutory rights, especially mandatory consumer rights, remain unaffected. These
          terms are governed by the laws of {o.country}, subject to the mandatory consumer
          protection law of your habitual residence. The liability provisions of our{" "}
          <Link to="/legal/terms" className={linkCls}>
            Terms of Use
          </Link>{" "}
          apply.
        </p>
        <p>
          Questions:{" "}
          <a className={linkCls} href={`mailto:${o.email}`}>
            {o.email}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
