import { createFileRoute, Link } from "@tanstack/react-router";
import { createSeoHeadFromPath } from "@/lib/seo";
import { LegalNote, LegalPage, LegalSection } from "@/components/LegalPage";
import { LEGAL_OPERATOR, operatorAddressLines } from "@/lib/legal/operator";

export const Route = createFileRoute("/legal/withdrawal")({
  component: Withdrawal,
  head: () => createSeoHeadFromPath("/legal/withdrawal"),
});

function Withdrawal() {
  const o = LEGAL_OPERATOR;
  const address = operatorAddressLines().join(", ");

  return (
    <LegalPage
      title="Right of withdrawal (Widerrufsrecht)"
      subtitle="Information for consumers in the EU/EEA on the statutory 14-day right of withdrawal for distance contracts."
    >
      <LegalNote>
        This page is a practical implementation of German consumer-contract rules. It is not legal
        advice. Have counsel review it for your entity and markets.
      </LegalNote>

      <LegalSection title="Widerrufsbelehrung">
        <p>
          You have the right to withdraw from this contract within 14 days without giving any
          reason. The withdrawal period is 14 days from the day of the conclusion of the contract
          (for services) or from the day on which you, or a third party named by you who is not the
          carrier, acquired possession of the digital content (for digital content not supplied on a
          tangible medium).
        </p>
        <p>
          To exercise the right of withdrawal, you must inform us ({o.serviceName}, {o.ownerName},{" "}
          {address}, email{" "}
          <a
            className="text-foreground underline-offset-2 hover:underline"
            href={`mailto:${o.email}`}
          >
            {o.email}
          </a>
          ) of your decision to withdraw from this contract by an unequivocal statement (for example
          a letter sent by post or an email). You may use the model withdrawal form below, but it is
          not obligatory.
        </p>
        <p>
          To meet the withdrawal deadline, it is sufficient for you to send your communication
          concerning your exercise of the right of withdrawal before the withdrawal period has
          expired.
        </p>
      </LegalSection>

      <LegalSection title="Effects of withdrawal">
        <p>
          If you withdraw from this contract, we shall reimburse to you all payments received from
          you, including the costs of delivery (except for the supplementary costs arising if you
          chose a type of delivery other than the least expensive type of standard delivery offered
          by us), without undue delay and in any event not later than 14 days from the day on which
          we are informed about your decision to withdraw. We will carry out the reimbursement using
          the same means of payment as you used for the initial transaction, unless you have
          expressly agreed otherwise; in any event, you will not incur any fees as a result of such
          reimbursement.
        </p>
        <p>
          A withdrawal within 14 days of a Founders Pack purchase (yearly Drive+ or yearly Drive the
          Music) refunds that purchase and revokes Founder perks from that purchase: the Founder
          seat (if it was granted only by that purchase), the 4-month Drive Unlimited grant, and the
          four forever-sound picks. Sounds that are free for everyone, and Founder rights of
          existing Founders who signed up before 9 November 2026 23:59 Europe/Berlin, are not taken
          away by a later withdrawal of a yearly subscription. After a regular cancellation of a
          subscription (end of the paid term, not a statutory withdrawal), the four forever sounds
          remain yours.
        </p>
      </LegalSection>

      <LegalSection title="Premature expiry / compensation (§ 356(5), § 357a BGB)">
        <p>
          For digital content that is not supplied on a tangible medium, the right of withdrawal
          expires if you have expressly consented to us beginning performance before the end of the
          withdrawal period and have acknowledged that you thereby lose your right of withdrawal,
          and we have begun performance (§ 356(5) BGB).
        </p>
        <p>
          For services, if you request that we begin during the withdrawal period and then withdraw,
          you shall pay us an amount which, in comparison with the full coverage of the contract, is
          proportionate to the services already provided up to the time you inform us of the
          withdrawal (§ 357a BGB).
        </p>
        <p>
          At checkout we ask you to tick an unticked checkbox confirming that request and
          acknowledgement. We store that confirmation with the payment provider as checkout
          metadata.
        </p>
      </LegalSection>

      <LegalSection title="Muster-Widerrufsformular (Anlage 2 EGBGB)">
        <p className="text-foreground">Model withdrawal form</p>
        <p>(Complete and return this form only if you wish to withdraw from the contract.)</p>
        <div className="space-y-2 border border-border bg-[#0A0A0A] p-4 text-xs">
          <p>
            To {o.serviceName}, {o.ownerName}, {address}, {o.email}:
          </p>
          <p>
            I/We (*) hereby give notice that I/We (*) withdraw from my/our (*) contract of sale of
            the following goods (*) / for the provision of the following service (*)
          </p>
          <p>Ordered on (*) / received on (*)</p>
          <p>Name of consumer(s)</p>
          <p>Address of consumer(s)</p>
          <p>Signature of consumer(s) (only if this form is notified on paper)</p>
          <p>Date</p>
          <p>(*) Delete as appropriate.</p>
        </div>
        <p className="mt-3">
          German version — Widerrufsformular: Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*)
          abgeschlossenen Vertrag über den Kauf der folgenden Waren (*) / die Erbringung der
          folgenden Dienstleistung (*). Bestellt am (*) / erhalten am (*). Name des/der
          Verbraucher(s). Anschrift des/der Verbraucher(s). Unterschrift (nur bei Mitteilung auf
          Papier). Datum. (*) Unzutreffendes streichen.
        </p>
        <p>
          Send the form to{" "}
          <a
            className="text-foreground underline-offset-2 hover:underline"
            href={`mailto:${o.email}?subject=${encodeURIComponent("Widerruf / withdrawal")}`}
          >
            {o.email}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Ordinary termination">
        <p>
          The statutory withdrawal right is separate from ordinary cancellation of a subscription
          (end of the current period for monthly plans; yearly plans as described in the{" "}
          <Link to="/legal/terms" className="text-foreground underline-offset-2 hover:underline">
            Terms of Use
          </Link>
          ). Use{" "}
          <Link to="/legal/cancel" className="text-foreground underline-offset-2 hover:underline">
            Cancel contract (Verträge hier kündigen)
          </Link>{" "}
          for ordinary termination.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
