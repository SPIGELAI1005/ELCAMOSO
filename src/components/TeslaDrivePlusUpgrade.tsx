import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useQueryClient } from "@tanstack/react-query";

import { useAccount } from "@/lib/account/AccountProvider";
import { getDrivePlusYearlyDisplay } from "@/lib/billing/plan-display";
import { useEntitlements } from "@/lib/entitlements/useEntitlements";
import { onTeslaEntitlementUpdate } from "@/lib/tesla-upgrade/events";
import { readClientDriveSessionId } from "@/lib/tesla-upgrade/drive-session-id";
import { createTeslaUpgradeTokenFn } from "@/lib/tesla-upgrade/server-fns";
import { getEntitlementsFn } from "@/lib/entitlements/server-fns";

type UpgradePhase = "loading" | "pending" | "unlocked" | "error";

interface TeslaDrivePlusUpgradeProps {
  open: boolean;
  onClose: () => void;
  relaySessionId?: string | null;
  className?: string;
}

/** In-car Drive+ purchase - QR to phone, no card entry on Tesla browser. */
export function TeslaDrivePlusUpgrade({
  open,
  onClose,
  relaySessionId = null,
  className = "",
}: TeslaDrivePlusUpgradeProps) {
  const { session } = useAccount();
  const { plan } = useEntitlements();
  const queryClient = useQueryClient();
  const yearly = getDrivePlusYearlyDisplay();
  const [phase, setPhase] = useState<UpgradePhase>("loading");
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const alreadyUnlocked = plan === "DRIVE_PLUS";

  useEffect(() => {
    if (!open) return;
    if (alreadyUnlocked) {
      setPhase("unlocked");
      return;
    }

    let cancelled = false;
    setPhase("loading");
    setError(null);

    void createTeslaUpgradeTokenFn({
      data: {
        sessionToken: null,
        clientDriveSessionId: readClientDriveSessionId(),
        relaySessionId,
        origin: window.location.origin,
      },
    })
      .then((created) => {
        if (cancelled) return;
        setUpgradeUrl(created.upgradeUrl);
        setPhase("pending");
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not prepare phone link.");
        setPhase("error");
      });

    return () => {
      cancelled = true;
    };
  }, [open, alreadyUnlocked, relaySessionId, session?.userId]);

  useEffect(() => {
    if (!upgradeUrl) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(upgradeUrl, {
      margin: 1,
      width: 240,
      color: { dark: "#F5F5F7", light: "#00000000" },
    }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [upgradeUrl]);

  const markUnlocked = useMemo(
    () => () => {
      setPhase("unlocked");
      void queryClient.invalidateQueries({ queryKey: ["entitlements"] });
    },
    [queryClient],
  );

  useEffect(() => {
    if (!open || phase !== "pending") return;
    return onTeslaEntitlementUpdate((detail) => {
      if (detail.plan === "DRIVE_PLUS") markUnlocked();
    });
  }, [markUnlocked, open, phase]);

  useEffect(() => {
    if (!open || phase !== "pending" || alreadyUnlocked) return;
    const interval = window.setInterval(() => {
      void getEntitlementsFn({ data: { sessionToken: null } }).then((snapshot) => {
        if (snapshot.plan === "DRIVE_PLUS") markUnlocked();
      });
    }, 2500);
    return () => window.clearInterval(interval);
  }, [alreadyUnlocked, markUnlocked, open, phase, session?.userId]);

  if (!open) return null;

  return (
    <aside
      className={`rounded-2xl border border-border/60 bg-card/40 p-6 ${className}`}
      aria-live="polite"
    >
      {phase === "unlocked" || alreadyUnlocked ? (
        <div className="text-center">
          <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">Drive+</p>
          <p className="mt-4 text-2xl font-light">Drive+ is ready</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Virtual shifts, live rev, and every Sound Profile are available.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-8 h-11 rounded-full border border-foreground/20 px-6 text-[10px] tracking-[0.2em] uppercase"
          >
            Continue
          </button>
        </div>
      ) : (
        <>
          <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">Drive+</p>
          <p className="mt-4 text-xl font-light leading-snug">
            Virtual shifts.
            <br />
            Live rev.
            <br />
            Rev matching.
            <br />
            More emotion in every drive.
          </p>
          <p className="mt-6 text-2xl font-light">
            {yearly.amount}
            <span className="text-base text-muted-foreground"> / year</span>
          </p>
          {yearly.equivalentMonthly ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {yearly.equivalentMonthly} per month, billed annually
            </p>
          ) : null}

          <div className="mt-8 flex flex-col items-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR code to continue with Drive+ on your phone"
                className="h-[240px] w-[240px] rounded-lg border border-border/60 bg-black"
              />
            ) : (
              <div className="h-[240px] w-[240px] animate-pulse rounded-lg border border-border/60 bg-surface-2" />
            )}
            <p className="mt-5 text-sm text-muted-foreground">Scan with your phone.</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Payment stays on your phone - not in the car browser.
            </p>
          </div>

          {phase === "loading" ? (
            <p className="mt-4 text-sm text-muted-foreground">Preparing secure link…</p>
          ) : null}
          {error ? <p className="mt-4 text-sm text-muted-foreground">{error}</p> : null}

          <button
            type="button"
            onClick={onClose}
            className="mt-6 text-[10px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
          >
            Not now
          </button>
        </>
      )}
    </aside>
  );
}
