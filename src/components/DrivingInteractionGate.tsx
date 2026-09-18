import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useSessionSelector } from "@/lib/store/session-store";

/**
 * Blocks complex Studio / Explore interaction while the vehicle is moving.
 * Safety mode from DriveSession remains authoritative for live drive chrome.
 */
export function DrivingInteractionGate({
  children,
  surface,
}: {
  children: ReactNode;
  surface: "studio" | "explore";
}) {
  const { safetyMode, status } = useSessionSelector((s) => ({
    safetyMode: s.safetyMode,
    status: s.status,
  }));
  const live = status === "running" || status === "suspended";

  if (!live || !safetyMode) return <>{children}</>;

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-6 text-center">
      <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
        {surface === "studio" ? "Studio" : "Explore"}
      </p>
      <h1 className="mt-4 text-3xl font-light tracking-tight">Parked setup only</h1>
      <p className="mt-4 text-base text-muted-foreground">
        Complex setup is unavailable while moving. Pair while parked or let a passenger connect.
        ELCAMOSO does not control the vehicle.
      </p>
      <Link
        to="/drive"
        className="mt-10 inline-flex h-12 items-center rounded-full bg-primary px-8 text-[10px] tracking-[0.22em] text-primary-foreground uppercase"
      >
        Back to Drive
      </Link>
    </main>
  );
}
