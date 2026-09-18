import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { ElcamosoMark } from "@/components/ElcamosoLogo";
import {
  clearStoredRelayCred,
  PhonePairSession,
  readStoredRelayCred,
  writeStoredRelayCred,
} from "@/components/PhonePairSession";
import { joinDriveRelayByCodeFn } from "@/lib/drive-relay/server-fns";
import { createSeoHeadFromPath } from "@/lib/seo";

export const Route = createFileRoute("/pair")({
  component: PairManualScreen,
  head: () => createSeoHeadFromPath("/pair"),
});

function PairManualScreen() {
  const [pairingInput, setPairingInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [cred, setCred] = useState(() => readStoredRelayCred());

  const canJoin = useMemo(() => pairingInput.replace(/\s/g, "").length === 6, [pairingInput]);

  const submit = async () => {
    setJoining(true);
    setError(null);
    try {
      const result = await joinDriveRelayByCodeFn({
        data: { pairingCode: pairingInput.replace(/\s/g, "") },
      });
      if (!result.ok) {
        setError("Invalid or expired code. Check the car display and try again.");
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
      setError("Could not pair. Try again in a moment.");
    } finally {
      setJoining(false);
    }
  };

  if (cred) {
    return (
      <PhonePairSession
        sessionId={cred.sessionId}
        joinSecret={cred.joinSecret}
        onDisconnect={() => {
          clearStoredRelayCred();
          setCred(null);
        }}
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <ElcamosoMark className="h-8 w-auto" />
        <Link to="/drive" className="text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
          Drive
        </Link>
      </div>
      <div className="flex flex-1 flex-col gap-8">
        <div>
          <h1 className="text-2xl font-light">Connect this phone</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Enter the six-digit code shown on the car. This phone sends motion only - sound plays in
            the car.
          </p>
        </div>
        <div className="space-y-4">
          <label className="block">
            <span className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
              Code
            </span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={pairingInput}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                setPairingInput(
                  digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits,
                );
              }}
              className="mt-2 w-full border-b border-border bg-transparent py-3 text-center font-mono text-3xl tracking-[0.2em] outline-none"
              placeholder="000 000"
            />
          </label>
          {error ? <p className="text-xs text-muted-foreground">{error}</p> : null}
          <button
            type="button"
            disabled={!canJoin || joining}
            onClick={() => void submit()}
            className="h-12 w-full rounded-full bg-primary text-[11px] tracking-[0.22em] text-primary-foreground uppercase disabled:opacity-40"
          >
            {joining ? "Connecting…" : "Connect"}
          </button>
        </div>
      </div>
    </main>
  );
}
