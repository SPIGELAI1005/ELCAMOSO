import { useState } from "react";
import {
  clearStoredSettings,
  readRawStored,
  resetOnboarding,
  type ElcamosoSettings,
  type LoadReport,
} from "@/lib/drive/settings";

const OUTCOME_LABEL: Record<LoadReport["outcome"], string> = {
  ok: "Loaded cleanly",
  repaired: "Loaded with repairs",
  corrupt: "Corrupted, reset to defaults",
  empty: "Nothing stored yet",
  unavailable: "Storage blocked",
  server: "Server render, defaults",
};

/**
 * Diagnostics: the last storage load result and the flags that decide whether
 * onboarding or Drive is shown. Hidden until switched on in Settings.
 */
export function DiagnosticsPanel({
  settings,
  loadReport,
  loaded,
}: {
  settings: ElcamosoSettings;
  loadReport: LoadReport;
  loaded: boolean;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const raw = showRaw ? readRawStored() : null;

  return (
    <section className="mt-12 border border-border p-6 sm:p-8">
      <h2 className="text-base">Diagnostics</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        What ELCAMOSO read from this device the last time settings were loaded.
      </p>

      <dl className="mt-8 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
        <Row label="Last storage load" value={OUTCOME_LABEL[loadReport.outcome]} />
        <Row label="Detail" value={loadReport.message} />
        <Row
          label="Read at"
          value={loadReport.at ? new Date(loadReport.at).toLocaleTimeString() : "Not yet"}
        />
        <Row label="Stored size" value={`${loadReport.size} bytes`} />
        <Row label="Settings hydrated" value={loaded ? "Yes" : "No"} />
        <Row label="Onboarded" value={String(settings.onboarded)} />
        <Row label="Safety acknowledged" value={String(settings.safetyAcknowledged)} />
        <Row label="Onboarding step" value={String(settings.onboardingStep + 1)} />
        <Row label="Drives" value={String(settings.driveCount)} />
        <Row label="Active profile" value={settings.profileId} />
        <Row label="Studio sounds" value={String(settings.customSounds.length)} />
        <Row label="Motion sensitivity" value={`${settings.motionSensitivity.toFixed(2)}x`} />
      </dl>

      {loadReport.issues.length ? (
        <div className="mt-8 border-t border-border pt-6">
          <p className="text-sm">Repairs applied</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {loadReport.issues.map((issue, i) => (
              <li key={`${issue.field}-${i}`}>
                <span className="text-foreground">{issue.field}</span>: {issue.detail}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-4">
        <button
          onClick={() => setShowRaw((v) => !v)}
          className="h-11 rounded-full border border-border px-6 text-[11px] tracking-[0.24em] uppercase hover:bg-secondary"
        >
          {showRaw ? "Hide raw data" : "Show raw data"}
        </button>
        <button
          onClick={() => resetOnboarding()}
          className="h-11 rounded-full border border-border px-6 text-[11px] tracking-[0.24em] uppercase hover:bg-secondary"
        >
          Reset onboarding
        </button>
        <button
          onClick={() => clearStoredSettings()}
          className="h-11 rounded-full border border-border px-6 text-[11px] tracking-[0.24em] uppercase hover:bg-secondary"
        >
          Clear all saved data
        </button>
      </div>

      {showRaw ? (
        <pre className="mt-6 max-h-64 overflow-auto border border-border p-4 text-[11px] leading-relaxed text-muted-foreground">
          {raw ?? "Nothing stored."}
        </pre>
      ) : null}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right tabular-nums">{value}</dd>
    </div>
  );
}
