import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { ElcamosoMark } from "@/components/ElcamosoLogo";
import {
  clearStoredRelayCred,
  PhonePairSession,
  writeStoredRelayCred,
  readStoredRelayCred,
} from "@/components/PhonePairSession";
import { claimDriveRelayTokenFn, peekDriveRelayClaimFn } from "@/lib/drive-relay/server-fns";
import { createSeoHeadFromPath } from "@/lib/seo";

export const Route = createFileRoute("/pair_/$token")({
  component: PairTokenScreen,
  head: () => createSeoHeadFromPath("/pair"),
});

function PairTokenScreen() {
  const { token } = Route.useParams();
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

  const claim = async () => {
    setClaiming(true);
    setError(null);
    try {
      const result = await claimDriveRelayTokenFn({ data: { claimToken: token } });
      if (!result.ok) {
        setError("This link expired or was already used.");
        setPhase("expired");
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
    </main>
  );
}
