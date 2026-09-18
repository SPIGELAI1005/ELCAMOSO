import { createSeoHeadFromPath } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalNote, LegalPage, LegalSection } from "@/components/LegalPage";
import { clearCookieConsent } from "@/lib/legal/cookie-consent";

export const Route = createFileRoute("/legal/cookies")({
  component: Cookies,
  head: () => createSeoHeadFromPath("/legal/cookies"),
});

function Cookies() {
  return (
    <LegalPage
      title="Cookie Notice"
      subtitle="Information about cookies and similar technologies (EU ePrivacy / GDPR; US disclosures)."
    >
      <LegalNote>
        ELCAMOSO is primarily a client-side app. Most preferences use browser storage, not classic
        third-party advertising cookies.
      </LegalNote>

      <LegalSection title="1. What we mean by cookies">
        <p>
          “Cookies” here includes HTTP cookies and similar technologies such as localStorage,
          IndexedDB, and consent flags stored on your device.
        </p>
      </LegalSection>

      <LegalSection title="2. Essential storage (always needed)">
        <ul className="list-disc space-y-2 pl-5">
          <li>App settings, selected Sound Profile, volume and tuning</li>
          <li>Garage / custom sounds and playlists kept on this device</li>
          <li>Onboarding and cookie-consent preference flags</li>
          <li>Optional service worker / PWA cache for offline shell assets</li>
        </ul>
        <p>
          These are necessary to provide the service you request and to remember choices between
          visits.
        </p>
      </LegalSection>

      <LegalSection title="3. Optional technologies">
        <p>
          <strong className="font-normal text-foreground">Usage insights</strong> - only if you
          enable them in Settings. May use first-party storage or network requests for aggregate
          analytics / crash reporting without uploading raw motion trails.
        </p>
        <p>
          <strong className="font-normal text-foreground">ELCAMOSO Cloud</strong> - only if you
          enable Cloud sync. Uses network requests authenticated by your local account identifier;
          not an advertising cookie.
        </p>
      </LegalSection>

      <LegalSection title="4. Your choices">
        <p>
          Use the cookie bar (Essential only / Accept) when it appears, or clear site data in your
          browser. You can also reset the consent flag:
        </p>
        <button
          type="button"
          className="mt-2 h-10 rounded-full border border-border px-4 text-[10px] tracking-[0.18em] uppercase hover:bg-secondary"
          onClick={() => {
            clearCookieConsent();
            window.location.reload();
          }}
        >
          Reset cookie preference
        </button>
        <p className="mt-3">
          Manage Usage insights and Cloud under{" "}
          <Link to="/settings" className="text-foreground underline-offset-2 hover:underline">
            Settings
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="5. More information">
        <p>
          See the{" "}
          <Link to="/legal/privacy" className="text-foreground underline-offset-2 hover:underline">
            Privacy Policy
          </Link>{" "}
          for processing purposes, legal bases, and contact details.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
