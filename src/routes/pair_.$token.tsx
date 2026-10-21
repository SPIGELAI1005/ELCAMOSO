import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { ElcamosoMark } from "@/components/ElcamosoLogo";
import {
  clearStoredRelayCred,
  PhonePairSession,
  writeStoredRelayCred,
  readStoredRelayCred,
} from "@/components/PhonePairSession";
import { claimDriveRelayTokenFn, peekDriveRelayClaimFn } from "@/lib/drive-relay/server-fns";
import { createSeoHeadFromPath } from "@/lib/seo";
import { useSettings } from "@/lib/drive/useSettings";
import { useAccount } from "@/lib/account/AccountProvider";
import { AccountSignInDialog } from "@/components/AccountSignInDialog";
import { clearPendingPair, savePendingPair } from "@/lib/drive-relay/pair-intent";
import type { ElcamosoSettings } from "@/lib/drive/settings";
import { getProfile } from "@/lib/sound/profiles";
import { isShiftMapPresetModeId } from "@/lib/drive/drive-shift-persona";

export const Route = createFileRoute("/pair_/$token")({
  validateSearch: (search: Record<string, unknown>): { s?: string; m?: string } => ({
    ...(typeof search["s"] === "string" ? { s: search["s"] } : {}),
    ...(typeof search["m"] === "string" ? { m: search["m"] } : {}),
  }),
  component: PairTokenScreen,
  head: () => createSeoHeadFromPath("/pair"),
});

function PairTokenScreen() {
  const { token } = Route.useParams();
  const { s: soundId, m: modeId } = Route.useSearch();
  const { update, loaded } = useSettings();
  const { isAuthenticated, isLoading: accountLoading } = useAccount();
  const navigate = useNavigate();
  const [signInOpen, setSignInOpen] = useState(false);
  const autoClaimed = useRef(false);
  const here =
    typeof window === "undefined"
      ? `/pair/${token}`
      : window.location.pathname + window.location.search;
  useEffect(() => {
    // Mirror the car's sound + mode on this phone.
    if (!loaded) return;
    const next: Partial<ElcamosoSettings> = {};
    if (soundId && getProfile(soundId)?.id === soundId) next.profileId = soundId;
    if (modeId && isShiftMapPresetModeId(modeId)) next.shiftMapPreset = modeId;
    if (Object.keys(next).length) update(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, soundId, modeId]);
  const [phase, setPhase] = useState<"loading" | "ready" | "invalid" | "expired" | "used">(
    "loading",
  );
  const [cred, setCred] = useState(() => readStoredRelayCred());
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void peekDriveRelayClaimFn({ data: { claimToken: token } }).then((peek) => {
      if (cancelled) return;
      if (!peek.ok) {
        setPhase("invalid");
        return;
      }
      if (peek.expired) setPhase("expired");
      else if (peek.used || peek.phoneConnected) setPhase("used");
      else setPhase("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Not signed in: remember this pair link and ask for login; we come back here after.
  useEffect(() => {
    if (accountLoading || isAuthenticated || cred) return;
    savePendingPair(here);
    setSignInOpen(true);
  }, [accountLoading, isAuthenticated, cred, here]);

  // Signed in (e.g. just returned from login): finish pairing without another tap.
  useEffect(() => {
    if (!isAuthenticated || cred || autoClaimed.current) return;
    if (phase === "ready") {
      autoClaimed.current = true;
      clearPendingPair();
      void claim();
    } else if (phase === "expired" || phase === "used" || phase === "invalid") {
      autoClaimed.current = true;
      clearPendingPair();
      // Token timed out during login: still open Drive with the car's sound + mode.
      void navigate({ to: "/drive", search: { pair: "expired" } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, phase, cred]);

  const claim = async () => {
    setClaiming(true);
    setError(null);
    try {
      const result = await claimDriveRelayTokenFn({ data: { claimToken: token } });
      if (!result.ok) {
        setError("This link expired or was already used.");
        setPhase("expired");
        void navigate({ to: "/drive", search: { pair: "expired" } });
        return;
      }
      const next = {
        sessionId: result.sessionId,
        joinSecret: result.joinSecret,
        expiresAt: result.expiresAt,
      };
      writeStoredRelayCred(next);
      setCred(next);
    } catch {
      setError("Could not claim this link. Try the code on the car instead.");
    } finally {
      setClaiming(false);
    }
  };

  if (cred) {
    return (
      <PhonePairSession
        sessionId={cred.sessionId}
        joinSecret={cred.joinSecret}
        confirmFirst={false}
        onDisconnect={() => {
          clearStoredRelayCred();
          setCred(null);
        }}
      />
    );
  }

  if (phase === "loading") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-6">
        <ElcamosoMark animate className="h-12 w-auto opacity-80" />
        <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
          Checking link
        </p>
      </main>
    );
  }

  if (phase === "invalid" || phase === "expired" || phase === "used") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10">
        <ElcamosoMark className="mb-8 h-8 w-auto" />
        <h1 className="text-2xl font-light">
          {phase === "used" ? "Already claimed" : "Pairing link expired"}
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Ask the car to show a new QR, or open the pair page and enter the short code.
        </p>
        <Link
          to="/pair"
          className="mt-10 flex h-12 items-center justify-center rounded-full border border-foreground text-[11px] tracking-[0.22em] uppercase"
        >
          Enter code
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10">
      <ElcamosoMark className="mb-8 h-8 w-auto" />
      <h1 className="text-2xl font-light">Connect this phone to your ELCAMOSO drive?</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Your phone will send motion and location to the car. Sound stays on the Tesla display. Do
        this while the car is parked or have a passenger help.
      </p>
      {error ? <p className="mt-4 text-xs text-muted-foreground">{error}</p> : null}
      <button
        type="button"
        disabled={claiming}
        onClick={() => void claim()}
        className="mt-10 h-14 w-full rounded-full bg-primary text-[11px] tracking-[0.22em] text-primary-foreground uppercase disabled:opacity-40"
      >
        {claiming ? "Connecting…" : "Connect"}
      </button>
      <Link
        to="/pair"
        className="mt-4 text-center text-[10px] tracking-[0.24em] text-muted-foreground uppercase"
      >
        Enter code instead
      </Link>
      <AccountSignInDialog open={signInOpen} onOpenChange={setSignInOpen} returnTo={here} />
    </main>
  );
}
