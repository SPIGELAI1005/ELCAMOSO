import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { DriveDiagnosticsPanel } from "@/components/DriveDiagnosticsPanel";
import { DrivePipelineMetrics } from "@/components/DrivePipelineMetrics";
import { useSessionStore } from "@/lib/store/session-store";
import { IDLE_PIPELINE_METRICS } from "@/lib/motion/pipeline-metrics";

export const Route = createFileRoute("/debug/diagnostics")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: "/" });
  },
  component: DebugDiagnosticsScreen,
  head: () => ({
    meta: [{ title: "Diagnostics - ELCAMOSO Debug" }],
  }),
});

function DebugDiagnosticsScreen() {
  const snap = useSessionStore();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">Debug</p>
        <h1 className="mt-2 text-2xl font-light">Drive diagnostics</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Live motion, fusion, powertrain, audio and network telemetry. Enable{" "}
          <strong className="font-normal text-foreground">Drive debug diagnostics</strong> in
          Settings, then start a drive. Session: {snap.kind} / {snap.status}.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          <Link to="/drive" search={{ debug: true }} className="underline underline-offset-4">
            Open Drive with debug
          </Link>
          {" · "}
          <Link to="/debug" className="underline underline-offset-4">
            Sound harness
          </Link>
        </p>
      </div>

      <DrivePipelineMetrics metrics={snap.pipeline ?? IDLE_PIPELINE_METRICS} />
      <DriveDiagnosticsPanel />
    </main>
  );
}
