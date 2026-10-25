import { Link, createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { AccountSignInDialog } from "@/components/AccountSignInDialog";
import { SmileLeaderboard } from "@/components/smiles/SmileLeaderboard";
import { useSmileStatus } from "@/components/smiles/SmileRewards";
import { SmileSymbol } from "@/components/smiles/SmilesSymbols";
import { useAccount } from "@/lib/account/AccountProvider";
import { createSeoHeadFromPath } from "@/lib/seo";
import {
  DAILY_SMILE_CAP,
  FOUNDER_MULTIPLIER,
  INVITE_MAX_MONTHS,
  REFERRAL_BONUS,
  SHARE_BONUS_RATE,
  SMILE_LEVELS,
  STREAK_BONUS,
  STREAK_DAYS,
} from "@/lib/smiles/rewards";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/crew")({
  component: CrewPage,
  head: () => createSeoHeadFromPath("/crew"),
});

const LEVEL_LINES: Record<string, string> = {
  Cruiser: "Everyone starts here. Welcome aboard.",
  Smiler: "The corners of your mouth know.",
  Grinner: "Passengers have noticed.",
  Joyrider: "You take the long way home. On purpose.",
  Legend: "The road smiles back.",
};

function Section({ id, eyebrow, title, children }: { id?: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-16 scroll-mt-28 border-t border-border pt-16 sm:mt-20 sm:pt-20">
      <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-light sm:text-3xl">{title}</h2>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">{children}</div>
    </section>
  );
}

const pill = "inline-flex h-11 items-center rounded-full border border-border px-6 text-[11px] tracking-[0.2em] text-foreground uppercase";

function CrewPage() {
  const { isAuthenticated } = useAccount();
  const status = useSmileStatus(isAuthenticated);
  const [copied, setCopied] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const refLink = isAuthenticated && status.refCode ? `https://www.elcamoso.com/?ref=${status.refCode}` : null;
  const earn: [string, string][] = [
    ["Drive", "Every Smiles card pays out its smiles."],
    ["Share", `+${Math.round(SHARE_BONUS_RATE * 100)}% on top, once a day.`],
    [`${STREAK_DAYS}-day streak`, `+${STREAK_BONUS}. Drive daily, grin weekly.`],
    ["Bring a friend", `They get 1 month Drive+ free, you earn up to ${INVITE_MAX_MONTHS} months. Plus +${REFERRAL_BONUS} smiles.`],
    ["Daily cap", `${DAILY_SMILE_CAP} a day. Leave some joy for tomorrow.`],
    ["Founders", `${FOUNDER_MULTIPLIER}x on everything.`],
  ];

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[42vh] bg-[radial-gradient(ellipse_at_top,oklch(1_0_0_/_0.06),transparent_65%)]"
      />
      <article className="relative mx-auto w-full max-w-2xl px-6 pt-16 pb-28 sm:px-10">
        <header>
          <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">The ELCAMOSO Crew</p>
          <h1 className="mt-5 text-3xl font-light leading-[1.15] sm:text-5xl sm:leading-[1.12]">
            Drive. Grin.
            <span className="mt-2 block text-foreground">Collect the smiles.</span>
          </h1>
          <p className="mt-6 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            Every good drive earns Smiles. Stack them, level up, and spend them in the Smile Shop.
          </p>
        </header>

        <Section id="earn" eyebrow="How smiles work" title="Earning">
          <dl className="divide-y divide-border border-y border-border" data-testid="crew-earn">
            {earn.map(([k, v]) => (
              <div key={k} className="flex flex-col gap-1 py-4 sm:flex-row sm:justify-between sm:gap-6">
                <dt className="text-foreground">{k}</dt>
                <dd className="sm:text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="levels" eyebrow="Levels" title="Five grins to Legend">
          <table className="w-full text-left" data-testid="crew-levels">
            <thead className="text-[10px] tracking-[0.2em] uppercase">
              <tr className="border-b border-border">
                <th className="py-3 font-normal">Level</th>
                <th className="py-3 font-normal">From</th>
                <th className="hidden py-3 font-normal sm:table-cell">Vibe</th>
              </tr>
            </thead>
            <tbody>
              {SMILE_LEVELS.map((l) => (
                <tr key={l.name} className={cn("border-b border-border/60", isAuthenticated && status.level.name === l.name && "text-[#e53935]")}>
                  <td className="py-3">
                    <span className="flex items-center gap-2 text-foreground">
                      <SmileSymbol className="h-4 w-auto text-white" />
                      {l.name}
                    </span>
                  </td>
                  <td className="py-3 tabular-nums">{l.min.toLocaleString("en")}</td>
                  <td className="hidden py-3 sm:table-cell">{LEVEL_LINES[l.name]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section id="leaderboard" eyebrow="Live" title="This week's board">
          <SmileLeaderboard />
        </Section>

        <Section id="challenge" eyebrow="Monthly challenge" title="Something's revving">
          <div className="rounded-3xl border border-[#e53935]/40 bg-[radial-gradient(ellipse_at_0%_0%,rgba(229,57,53,0.22),transparent_60%)] p-5">
            <div className="text-foreground">Most smiles in V10 Race mode</div>
            <div className="text-xs">Top 10 win a month of Drive+. Starts soon.</div>
          </div>
        </Section>

        <Section id="invite" eyebrow="Bring a friend" title={refLink ? "They get 1 month, you earn up to 6" : "Join the Crew"}>
          {refLink ? (
            <>
              <p>{"Bring a friend: they get 1 month Drive+ free, you earn up to 6 months."} Unlocks once they confirm their email and finish a real drive. Plus +{REFERRAL_BONUS} smiles for you, always.</p>
              <p className="text-[#e53935]" data-testid="invite-months">
                {status.inviteMonths} of {INVITE_MAX_MONTHS} free months earned
              </p>
              <p className="break-all text-foreground" data-testid="crew-invite">{refLink}</p>
              <button
                type="button"
                className={pill}
                onClick={() => void navigator.clipboard?.writeText(refLink).then(() => setCopied(true))}
              >
                {copied ? "Copied" : "Copy invite link"}
              </button>
            </>
          ) : (
            <>
              <p>Sign up free and your first drive starts the smile meter.</p>
              <button type="button" className={pill} data-testid="crew-signup" onClick={() => setSignIn(true)}>
                Sign up free
              </button>
              <AccountSignInDialog
                open={signIn}
                onOpenChange={setSignIn}
                returnTo="/crew"
                title="Join the Crew"
                description="Sign up free. Smiles start on your next drive."
              />
            </>
          )}
          <div>
            <Link to="/smile-shop" className="text-foreground underline-offset-4 hover:underline">
              Spend your smiles in the Smile Shop →
            </Link>
          </div>
        </Section>

        <Section id="founders" eyebrow="Founders Test Crew" title="First in the seat">
          <p className="text-foreground">Exclusive Crew perks to follow.</p>
        </Section>
      </article>
    </main>
  );
}
