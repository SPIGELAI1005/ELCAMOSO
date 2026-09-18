import { ElcamosoMark } from "@/components/ElcamosoLogo";

function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function SilentCaptureHud({
  elapsedMs,
  distanceM,
  sensorLabel,
  sensorConnected,
  capturePausedByBrowser,
  suggestFinish,
  backgroundCapable,
  quality,
  sampleCount,
  onStop,
  onContinue,
  onFinishSuggested,
}: {
  elapsedMs: number;
  distanceM: number;
  sensorLabel: string;
  sensorConnected: boolean;
  capturePausedByBrowser: boolean;
  suggestFinish: boolean;
  backgroundCapable: boolean;
  quality: "balanced" | "high-detail";
  sampleCount: number;
  onStop: () => void;
  onContinue: () => void;
  onFinishSuggested: () => void;
}) {
  const km = distanceM / 1000;
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center text-center">
      <ElcamosoMark intensity={0.35} waveResponse={0.5} className="h-10 w-auto opacity-80" />
      <p className="mt-10 text-[10px] tracking-[0.34em] text-muted-foreground uppercase">
        {backgroundCapable ? "Capture active" : "ELCAMOSO"}
      </p>
      <div className="mt-8 flex items-center gap-3">
        <span className="h-2 w-2 rounded-full bg-foreground/70" aria-hidden />
        <h1 className="text-[11px] tracking-[0.28em] uppercase">Recording motion</h1>
      </div>
      <p className="mt-10 font-light tracking-tight tabular-nums text-5xl sm:text-6xl">
        {formatElapsed(elapsedMs)}
      </p>
      <p className="mt-4 text-lg font-light text-muted-foreground tabular-nums">
        {km < 10 ? km.toFixed(1) : Math.round(km)} km
      </p>
      <p className="mt-8 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
        {sensorLabel}{" "}
        <span className={sensorConnected ? "text-foreground/80" : "text-muted-foreground"}>
          ● {sensorConnected ? "Connected" : "Waiting"}
        </span>
      </p>
      <p className="mt-3 text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
        {quality === "high-detail" ? "High detail" : "Balanced"} · {sampleCount} samples
      </p>
      {backgroundCapable ? (
        <p className="mt-4 max-w-xs text-sm text-muted-foreground">
          Capture continues while the screen is locked.
        </p>
      ) : null}
      {capturePausedByBrowser ? (
        <p className="mt-6 max-w-xs text-sm text-muted-foreground">
          Capture was paused by the browser for part of this drive.
        </p>
      ) : null}
      {suggestFinish ? (
        <div className="mt-8 w-full border border-foreground/20 px-5 py-5">
          <p className="text-sm font-light">Still driving?</p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={onContinue}
              className="flex-1 border border-foreground/30 py-3 text-[10px] tracking-[0.2em] uppercase"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={onFinishSuggested}
              className="flex-1 bg-primary py-3 text-[10px] tracking-[0.2em] text-primary-foreground uppercase"
            >
              Finish journey
            </button>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={onStop}
        className="mt-14 h-14 w-full max-w-xs rounded-full border border-foreground/40 text-[11px] tracking-[0.22em] uppercase"
      >
        Stop &amp; Create Journey
      </button>
    </div>
  );
}
