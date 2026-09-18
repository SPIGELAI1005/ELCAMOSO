import { createFileRoute, Link } from "@tanstack/react-router";
import { auditSymphonyAssets, listSymphonyPacks } from "@/lib/symphony";
import { beatDurationSec, barDurationSec, loopDurationSec } from "@/lib/symphony/music-clock";

export const Route = createFileRoute("/debug/symphony-assets")({
  component: SymphonyAssetsDebug,
  head: () => ({
    meta: [{ title: "Symphony assets (dev) | ELCAMOSO" }],
  }),
});

function SymphonyAssetsDebug() {
  if (!import.meta.env.DEV) {
    return (
      <main className="p-10 text-center text-muted-foreground">
        Dev only. <Link to="/">Home</Link>
      </main>
    );
  }

  const audits = listSymphonyPacks().map((pack) => ({
    pack,
    audit: auditSymphonyAssets(pack),
    beatSec: beatDurationSec(pack.bpm),
    barSec: barDurationSec(pack.bpm, pack.beatsPerBar),
    loopSec: loopDurationSec(pack),
  }));

  return (
    <main className="mx-auto max-w-4xl px-6 pt-10 pb-24">
      <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">Debug</p>
      <h1 className="mt-3 text-3xl font-light">Symphony assets</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Required 48 kHz, bar-aligned loops, complete analysis, and approved provenance. See
        docs/MUSIC_ASSET_GOVERNANCE.md.
      </p>

      <ul className="mt-12 space-y-10">
        {audits.map(({ pack, audit, beatSec, barSec, loopSec }) => (
          <li key={pack.id} className="border border-border px-5 py-6 font-mono text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-sans font-light tracking-normal">{pack.name}</p>
              <p className={audit.productionReady ? "text-emerald-300" : "text-red-300"}>
                {audit.productionReady ? "PRODUCTION READY" : "PRODUCTION BLOCKED"}
              </p>
            </div>
            <p className="mt-2 text-muted-foreground">{pack.id}</p>
            <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">BPM</dt>
                <dd>{pack.bpm}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Key</dt>
                <dd>{pack.key}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Bars / loop</dt>
                <dd>{pack.barsPerLoop}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Beat</dt>
                <dd>{beatSec.toFixed(3)}s</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Bar</dt>
                <dd>{barSec.toFixed(3)}s</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Loop</dt>
                <dd>{loopSec.toFixed(3)}s</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Stems</dt>
                <dd>{pack.stems.length}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Pack gain</dt>
                <dd>{pack.packGain}</dd>
              </div>
            </dl>
            <p className="mt-4 text-muted-foreground">
              {pack.licensing.source} / v{pack.licensing.version} / {pack.licensing.notes}
            </p>
            <p className="mt-5 uppercase tracking-wider text-muted-foreground">
              Per-asset manifest
            </p>
            <ul className="mt-2 space-y-2">
              {audit.entries.map((asset) => (
                <li key={asset.assetId}>
                  {asset.assetId} / {asset.instrument} / {asset.variation} /{" "}
                  {asset.assetPath ?? "no production path"} / {asset.sampleRate ?? "no sample rate"}{" "}
                  Hz / peak {asset.peakDb ?? "n/a"} dB / RMS {asset.rmsDb ?? "n/a"} dB /{" "}
                  {asset.commercialUseStatus}
                </li>
              ))}
            </ul>
            {audit.errors.length ? (
              <p className="mt-4 text-red-300">Blocked: {audit.errors.join("; ")}</p>
            ) : (
              <p className="mt-4 text-emerald-300">All production asset gates pass.</p>
            )}
            {audit.warnings.length ? (
              <p className="mt-2 text-amber-200/80">Warnings: {audit.warnings.join("; ")}</p>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="mt-12 text-center text-[10px] tracking-[0.24em] uppercase">
        <Link to="/debug">Back to debug</Link>
      </p>
    </main>
  );
}
