import { useEffect, useState } from "react";

import { AccountSignInDialog } from "@/components/AccountSignInDialog";
import { DrivePlusCheckoutButton } from "@/components/DrivePlusCheckoutButton";
import { useAccount } from "@/lib/account/AccountProvider";
import { SOUND_PACKAGE_LABEL, type SoundPackage } from "@/lib/drive/sound-share";
import { getProfile } from "@/lib/sound/profiles";

const BTN =
  "inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-[11px] tracking-[0.2em] text-primary-foreground uppercase transition-opacity hover:opacity-90";

/** Pricing banner for /pricing?plan=…&sound=…: points at the package that contains the sound. */
export function SoundPackageCallout({
  plan,
  sound,
  billingAvailable,
  lifetimeAvailable,
}: {
  plan: SoundPackage;
  sound?: string | undefined;
  billingAvailable: boolean;
  lifetimeAvailable: boolean;
}) {
  const { isAuthenticated, isLoading } = useAccount();
  const [signIn, setSignIn] = useState(false);
  const label = SOUND_PACKAGE_LABEL[plan];
  const soundName = sound ? getProfile(sound).name : null;
  const returnTo = `/pricing?plan=${plan}${sound ? `&sound=${encodeURIComponent(sound)}` : ""}`;

  useEffect(() => {
    const el = document.getElementById(plan);
    if (!el) return;
    el.setAttribute("data-highlighted", "true");
    el.classList.add("ring-2", "ring-[#e53935]", "rounded-2xl", "px-4");
    return () => {
      el.removeAttribute("data-highlighted");
      el.classList.remove("ring-2", "ring-[#e53935]", "rounded-2xl", "px-4");
    };
  }, [plan]);

  return (
    <aside
      data-testid="sound-package-callout"
      data-plan={plan}
      className="mx-auto mt-8 w-full max-w-2xl px-6 sm:px-10"
    >
      <div className="rounded-2xl border-2 border-[#e53935] px-5 py-5">
        <p className="text-[10px] tracking-[0.3em] text-[#e53935] uppercase">Your package</p>
        <p className="mt-2 text-lg font-light">
          {soundName ? (
            <>
              <strong className="font-medium">{soundName}</strong> is included in{" "}
            </>
          ) : (
            "Selected: "
          )}
          <strong className="font-medium">{label}</strong>.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Lifetime includes both Drive+ and Drive the Music.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {billingAvailable ? (
            <>
              <DrivePlusCheckoutButton
                plan={plan === "drive-music" ? "drive_music" : "drive_plus"}
                interval="yearly"
                label={`Get ${label}`}
                source="sound-share"
                returnTo={returnTo}
                className={BTN}
              />
              {lifetimeAvailable ? (
                <DrivePlusCheckoutButton
                  interval="lifetime"
                  label="Lifetime · both"
                  source="sound-share"
                  returnTo={returnTo}
                  className="inline-flex h-12 items-center rounded-full border border-foreground/20 px-6 text-[11px] tracking-[0.2em] uppercase"
                />
              ) : null}
            </>
          ) : (
            <>
              {!isLoading && !isAuthenticated ? (
                <button
                  type="button"
                  data-testid="sound-package-signin"
                  className={BTN}
                  onClick={() => setSignIn(true)}
                >
                  Sign in or create account
                </button>
              ) : null}
              <p className="w-full text-sm text-muted-foreground">
                {label} opens for purchase on 9.11.2026.
              </p>
            </>
          )}
        </div>
      </div>
      <AccountSignInDialog open={signIn} onOpenChange={setSignIn} returnTo={returnTo} />
    </aside>
  );
}
