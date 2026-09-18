import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSession } from "@/lib/drive/session";
import { useSettings } from "@/lib/drive/useSettings";
import type { SymphonyDiagnostics } from "@/lib/symphony";

export const Route = createFileRoute("/debug/symphony")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/" });
  },
  component: SymphonyDebugPage,
});

function SymphonyDebugPage() {
  const { update } = useSettings();
  const [diag, setDiag] = useState<SymphonyDiagnostics | null>(null);

  useEffect(() => {
    update({ profileId: "symphony-cinematic-rock" });
    void getSession().listenProfile("symphony-cinematic-rock", 70);
    const id = window.setInterval(() => {
      const d = getSession().getSymphonyDiagnostics();
      setDiag(d);
    }, 200);
    return () => {
      window.clearInterval(id);
      getSession().stop();
    };
  }, [update]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">Debug</p>
      <h1 className="mt-2 text-2xl font-light">Drive Symphony</h1>
      <Link to="/debug" className="mt-4 inline-block text-xs text-muted-foreground">
        ← Debug home
      </Link>
      <pre className="mt-8 overflow-auto rounded border border-border bg-surface-1/40 p-4 text-xs">
        {diag ? JSON.stringify(diag, null, 2) : "Start audition… (select Cinematic Rock)"}
      </pre>
      <p className="mt-4 text-sm text-muted-foreground">
        BPM, bar/beat, Drive Energy, stems, seed. Use Drive with a Symphony profile for live
        telemetry via SoundEngine.getSymphonyDiagnostics.
      </p>
    </main>
  );
}
