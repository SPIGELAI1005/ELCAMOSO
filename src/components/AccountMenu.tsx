"use client";

import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";

import { AccountSignInDialog } from "@/components/AccountSignInDialog";
import { AccountUserIcon } from "@/components/AccountUserIcon";
import { ElcamosoMark } from "@/components/ElcamosoLogo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAccount } from "@/lib/account/AccountProvider";
import { useReducedMotion } from "@/lib/drive/useReducedMotion";
import { useSettings } from "@/lib/drive/useSettings";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface AccountMenuProps {
  className?: string;
  /** Compact trigger for the mobile sheet list. */
  variant?: "icon" | "row";
  onNavigate?: () => void;
}

export function AccountMenu({ className, variant = "icon", onNavigate }: AccountMenuProps) {
  const { session, isAuthenticated, isLoading, signOut } = useAccount();
  const { settings } = useSettings();
  const reducedMotion = useReducedMotion();
  const location = useRouterState({ select: (s) => s.location });
  const [signInOpen, setSignInOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const returnTo = `${location.pathname}${location.searchStr || ""}` || "/drive";

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      setProfileOpen(false);
    } finally {
      setSigningOut(false);
    }
  }

  function openAccount() {
    if (isAuthenticated) setProfileOpen(true);
    else setSignInOpen(true);
  }

  if (variant === "row") {
    return (
      <>
        <button
          type="button"
          onClick={openAccount}
          className={cn(
            "flex w-full items-center gap-3 px-4 py-4 text-left text-sm tracking-[0.2em] uppercase transition-colors",
            "text-muted-foreground hover:text-foreground",
            className,
          )}
        >
          <AccountUserIcon className="h-4 w-auto shrink-0" />
          <span className="min-w-0 truncate">
            {isLoading
              ? t(settings.language, "nav.account")
              : isAuthenticated
                ? t(settings.language, "nav.profile")
                : t(settings.language, "nav.signIn")}
          </span>
        </button>
        <AccountSignInDialog
          open={signInOpen}
          onOpenChange={setSignInOpen}
          returnTo={returnTo}
          title={t(settings.language, "account.signInTitle")}
          description={t(settings.language, "account.signInBody")}
        />
        <AccountProfileDialog
          open={profileOpen}
          onOpenChange={setProfileOpen}
          email={session?.email ?? ""}
          signingOut={signingOut}
          onSignOut={() => void handleSignOut()}
          onNavigate={() => {
            setProfileOpen(false);
            onNavigate?.();
          }}
          reducedMotion={reducedMotion}
          language={settings.language}
        />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openAccount}
        data-testid="nav-account"
        className={cn(
          "inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary",
          isAuthenticated && "ring-1 ring-border",
          className,
        )}
        aria-label={
          isAuthenticated ? t(settings.language, "nav.profile") : t(settings.language, "nav.signIn")
        }
      >
        <AccountUserIcon className="h-5 w-auto" />
      </button>

      <AccountSignInDialog
        open={signInOpen}
        onOpenChange={setSignInOpen}
        returnTo={returnTo}
        title={t(settings.language, "account.signInTitle")}
        description={t(settings.language, "account.signInBody")}
      />
      <AccountProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        email={session?.email ?? ""}
        signingOut={signingOut}
        onSignOut={() => void handleSignOut()}
        onNavigate={() => {
          setProfileOpen(false);
          onNavigate?.();
        }}
        reducedMotion={reducedMotion}
        language={settings.language}
      />
    </>
  );
}

function AccountProfileDialog({
  open,
  onOpenChange,
  email,
  signingOut,
  onSignOut,
  onNavigate,
  reducedMotion,
  language,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  signingOut: boolean;
  onSignOut: () => void;
  onNavigate: () => void;
  reducedMotion: boolean;
  language: "en" | "de" | "ro";
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden border-border/60 bg-background p-0 sm:rounded-2xl">
        <div className="relative border-b border-border/60 px-6 pt-10 pb-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(245,245,247,0.06),transparent_55%)]" />
          <div className="relative flex flex-col items-center text-center">
            <ElcamosoMark
              intensity={1}
              animate={!reducedMotion}
              reducedMotion={reducedMotion}
              className="h-14 w-auto text-foreground"
            />
            <DialogHeader className="mt-6 space-y-2">
              <DialogTitle className="text-center text-xl font-light tracking-tight">
                {t(language, "account.profileTitle")}
              </DialogTitle>
              <DialogDescription className="text-center text-sm text-muted-foreground">
                {email}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="space-y-2 px-6 py-6">
          <Link
            to="/settings"
            onClick={onNavigate}
            className="flex h-11 items-center justify-between rounded-full border border-border px-5 text-[11px] tracking-[0.2em] text-muted-foreground uppercase transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            {t(language, "nav.settings")}
            <span aria-hidden>→</span>
          </Link>
          <Link
            to="/pricing"
            onClick={onNavigate}
            className="flex h-11 items-center justify-between rounded-full border border-border px-5 text-[11px] tracking-[0.2em] text-muted-foreground uppercase transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            {t(language, "nav.pricing")}
            <span aria-hidden>→</span>
          </Link>
          <Link
            to="/drive"
            onClick={onNavigate}
            className="flex h-11 items-center justify-between rounded-full border border-border px-5 text-[11px] tracking-[0.2em] text-muted-foreground uppercase transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            {t(language, "nav.drive")}
            <span aria-hidden>→</span>
          </Link>
          <button
            type="button"
            disabled={signingOut}
            onClick={onSignOut}
            className="inline-flex h-11 w-full items-center justify-center rounded-full border border-border text-[11px] tracking-[0.2em] uppercase transition-colors hover:border-foreground/30 disabled:opacity-50"
          >
            {signingOut ? t(language, "account.signingOut") : t(language, "account.signOut")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
