import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { AccountSignInDialog } from "@/components/AccountSignInDialog";
import { useAccount } from "@/lib/account/AccountProvider";
import { useEntitlements } from "@/lib/entitlements/useEntitlements";
import {
  FOUNDERS_SIGNUP_DEADLINE_MS,
  msUntilFounderDeadline,
  splitCountdown,
} from "@/lib/founders/founders";
import { getFoundersSeatsFn } from "@/lib/founders/server-fns";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "elc.foundersBanner.dismissed.v1";
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Founders Pack ticker strip: thin red-accent "special promotion" bar with live countdown
 * to 09.11.2026 23:59:59 Berlin, live seats left and a Claim button. Disappears after the
 * deadline, can be dismissed (localStorage). Founders see a "You're a Founder" state.
 */
export function FoundersBanner({ compact = false, className }: { compact?: boolean; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [signInOpen, setSignInOpen] = useState(false);
  const { isAuthenticated } = useAccount();
  const { snapshot } = useEntitlements();
  const founder = snapshot.founder ?? null;
  const seats = useQuery({
    queryKey: ["founders-seats"],
    queryFn: () => getFoundersSeatsFn(),
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (now == null || dismissed || now > FOUNDERS_SIGNUP_DEADLINE_MS) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const { d, h, m, s } = splitCountdown(msUntilFounderDeadline(now));
  const left = seats.data?.left;
  const full = left === 0 && !founder;

  let message: React.ReactNode;
  let cta: React.ReactNode = null;
  if (founder) {
    const seatLabel = founder.seat ? `Founder seat #${founder.seat}` : null;
    message = compact ? (
      <>
        <span className="font-semibold text-foreground">Congratulations! You're a Founder! THANK YOU!</span>
        {seatLabel ? <span className="text-[#e53935]"> · {seatLabel}</span> : null}
      </>
    ) : (
      <span className="flex flex-col gap-1">
        <span>
          <span className="font-semibold text-foreground">Congratulations! You're a Founder! THANK YOU!</span>
          {seatLabel ? (
            <span className="ml-2 inline-block whitespace-nowrap border border-[#e53935]/60 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.2em] text-[#e53935] uppercase">
              {seatLabel}
            </span>
          ) : null}
        </span>
        <span className="text-muted-foreground">
          3 sounds free forever · 6 months Drive+ free · Founders Test Crew: new features first · Exclusive Crew perks to follow
        </span>
      </span>
    );
  } else if (full) {
    message = (
      <>
        <span className="text-foreground">Founder seats are full</span>
        {!compact ? <span className="text-muted-foreground"> · Thanks for the rush. Drive+ is open on Pricing.</span> : null}
      </>
    );
  } else {
    message = compact ? (
      <>
        <span className="text-foreground">Sign up before 09.11.</span>
        <span className="text-muted-foreground"> · 3 sounds free forever + 6 mo Drive+</span>
      </>
    ) : (
      <>
        <span className="text-foreground">Sign up before 09.11.</span>
        <span className="text-muted-foreground">
          {" "}and keep 3 sounds free forever + 6 months Drive+ free + Founders Test Crew
        </span>
      </>
    );
    cta = isAuthenticated ? null : (
      <button
        type="button"
        onClick={() => setSignInOpen(true)}
        className="order-4 shrink-0 border border-[#e53935] sm:order-none px-2.5 py-1 text-[10px] font-medium tracking-[0.2em] text-[#e53935] uppercase transition-colors hover:bg-[#e53935] hover:text-white"
      >
        Claim it
      </button>
    );
  }

  return (
    <div
      role="region"
      aria-label="Founders Pack promotion"
      className={cn(
        "relative w-full border-y border-[#e53935]/40 bg-black/80 backdrop-blur-sm",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-[#e53935]" />
      <div
        className={cn(
          "mx-auto flex max-w-6xl items-center gap-3 pr-2 pl-4",
          compact ? "py-1.5" : "flex-wrap py-2 sm:flex-nowrap",
        )}
      >
        <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold tracking-[0.28em] text-[#e53935] uppercase">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e53935] opacity-70 motion-reduce:hidden" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#e53935]" />
          </span>
          Founders Pack
        </span>
        {!compact ? <span className="flex-1 sm:hidden" /> : null}
        <p className={cn("min-w-0 flex-1 text-xs leading-snug", !compact && "order-3 basis-full sm:order-none sm:basis-auto", compact && "hidden truncate sm:block")}>{message}</p>
        {compact ? <span className="flex-1 sm:hidden" /> : null}
        {!founder && !full ? (
          <span
            className={cn("shrink-0 font-mono text-[11px] tabular-nums text-foreground", !compact && "order-4 sm:order-none")}
            aria-label="Time left to become a Founder"
          >
            {d}d {pad(h)}:{pad(m)}:{pad(s)}
          </span>
        ) : null}
        {!founder && !full && left != null ? (
          <span className={cn("shrink-0 text-[10px] tracking-[0.16em] text-muted-foreground uppercase", !compact && "order-4 sm:order-none")}>
            {compact ? (
              <>
                {left}
                <span className="hidden sm:inline"> seats</span> left
              </>
            ) : (
              <>
                {left} seats left
              </>
            )}
          </span>
        ) : null}
        {cta}
        {!compact && !founder && !full && isAuthenticated ? (
          <Link
            to="/pricing"
            className="order-4 shrink-0 sm:order-none text-[10px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
          >
            Perks
          </Link>
        ) : null}
        <Link
          to="/legal/rewards"
          className={cn("shrink-0 text-[9px] tracking-[0.16em] text-muted-foreground/80 uppercase underline-offset-2 hover:text-foreground hover:underline", !compact && "order-4 sm:order-none", compact && "hidden sm:inline")}
        >
          Terms apply
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss Founders Pack banner"
          className="order-2 shrink-0 sm:order-none px-1.5 text-sm leading-none text-muted-foreground hover:text-foreground"
        >
          ×
        </button>
      </div>
      <AccountSignInDialog
        open={signInOpen}
        onOpenChange={setSignInOpen}
        returnTo="/"
        title="Claim your Founder seat"
        description="Sign in with your email before 09.11. to keep 3 sounds free forever, get 6 months of Drive+ free and join the Founders Test Crew. Limited seats."
      />
    </div>
  );
}

/** Small "Founder" badge (profile / account / Smiles cards). */
export function FounderBadge({ seat, className }: { seat?: number | null; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border border-[#e53935]/60 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.24em] text-[#e53935] uppercase",
        className,
      )}
    >
      Founder{seat ? ` #${seat}` : ""}
    </span>
  );
}
