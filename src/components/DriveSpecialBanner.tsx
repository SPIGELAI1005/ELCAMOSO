import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AccountSignInDialog } from "@/components/AccountSignInDialog";
import {
  DRIVE_SPECIAL_NAME,
  DRIVE_SPECIAL_PURPLE,
  driveSpecialBannerText,
  isDriveSpecialActive,
} from "@/lib/billing/drive-special";
import { useAccount } from "@/lib/account/AccountProvider";
import { useSettings } from "@/lib/drive/useSettings";
import { cn } from "@/lib/utils";

/** Purple promo strip for the Black Friday Special. Only shown inside the special window. */
export function DriveSpecialBanner({ className }: { className?: string }) {
  const { settings } = useSettings();
  const { isAuthenticated } = useAccount();
  const [show, setShow] = useState(false);
  const [signUpOpen, setSignUpOpen] = useState(false);
  useEffect(() => {
    const check = () => setShow(isDriveSpecialActive());
    check();
    const id = window.setInterval(check, 60_000);
    return () => window.clearInterval(id);
  }, []);
  if (!show) return null;
  const copy = driveSpecialBannerText(settings.language);
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
          {DRIVE_SPECIAL_NAME}
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
            hash="black-friday-special"
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
        description={
          settings.language.slice(0, 2).toLowerCase() === "de"
            ? "Lege ein Konto an, um Midnight Dark Rave unbegrenzt und Drive the Music 30 Minuten am Tag bis zum 27. November zu nutzen."
            : settings.language.slice(0, 2).toLowerCase() === "ro"
              ? "Creează un cont ca să ai Midnight Dark Rave nelimitat și Drive the Music 30 de minute pe zi până pe 27 noiembrie."
              : "Create an account to keep Midnight Dark Rave unlimited and Drive the Music 30 minutes a day until 27 November."
        }
      />
    </>
  );
}
