import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AccountSignInDialog } from "@/components/AccountSignInDialog";
import {
  DRIVE_SPECIAL_PURPLE,
  driveSpecialBannerText,
  driveSpecialName,
  driveSpecialSignUpDescription,
  driveSpecialWindowForCopy,
  isDriveSpecialActive,
} from "@/lib/billing/drive-special";
import { useAccount } from "@/lib/account/AccountProvider";
import { useSettings } from "@/lib/drive/useSettings";
import { cn } from "@/lib/utils";

/**
 * Purple promo strip for the Black Friday Special, then the Cyber Monday Special.
 * Only shown inside a special window; name, dates and terms link follow the open window.
 */
export function DriveSpecialBanner({ className }: { className?: string }) {
  const { settings } = useSettings();
  const { isAuthenticated } = useAccount();
  // Ticking `now` (not just a boolean) so the name/dates switch from Black Friday to Cyber
  // Monday at the boundary without a reload. Null until mounted (SSR renders nothing).
  const [now, setNow] = useState<number | null>(null);
  const [signUpOpen, setSignUpOpen] = useState(false);
  useEffect(() => {
    const check = () => setNow(Date.now());
    check();
    const id = window.setInterval(check, 60_000);
    return () => window.clearInterval(id);
  }, []);
  if (now === null || !isDriveSpecialActive(now)) return null;
  const copy = driveSpecialBannerText(settings.language, now);
  return (
    <>
      <div
        data-testid="drive-special-banner"
        className={cn(
          "flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-b px-3 py-2 text-xs",
          className,
        )}
        style={{
          borderColor: `${DRIVE_SPECIAL_PURPLE}55`,
          background: `linear-gradient(90deg, #08050b, ${DRIVE_SPECIAL_PURPLE}2e, #08050b), #08050b`,
        }}
      >
        <span
          className="font-semibold tracking-[0.18em] uppercase"
          style={{ color: DRIVE_SPECIAL_PURPLE }}
        >
          {driveSpecialName(now)}
        </span>
        <span className="text-foreground/90">{copy.teaser}</span>
        <span className="flex flex-wrap items-center justify-center gap-2">
          {isAuthenticated ? (
            <Link
              to="/sounds"
              data-testid="drive-special-banner-sounds"
              className="rounded-sm px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-white uppercase"
              style={{ background: DRIVE_SPECIAL_PURPLE }}
            >
              {copy.cta}
            </Link>
          ) : (
            <button
              type="button"
              data-testid="drive-special-banner-signup"
              className="rounded-sm px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-white uppercase"
              style={{ background: DRIVE_SPECIAL_PURPLE }}
              onClick={() => setSignUpOpen(true)}
            >
              {copy.signup}
            </button>
          )}
          <Link
            to="/legal/terms"
            hash={driveSpecialWindowForCopy(now).termsHash}
            className="rounded-sm px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] uppercase"
            style={{ color: DRIVE_SPECIAL_PURPLE, border: `1px solid ${DRIVE_SPECIAL_PURPLE}99` }}
          >
            {copy.terms}
          </Link>
        </span>
      </div>
      <AccountSignInDialog
        open={signUpOpen}
        onOpenChange={setSignUpOpen}
        returnTo="/drive"
        title={copy.signup}
        description={driveSpecialSignUpDescription(settings.language, now)}
      />
    </>
  );
}
