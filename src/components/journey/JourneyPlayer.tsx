import { useState } from "react";
import { MotionSignature } from "@/components/MotionSignature";
import { energySamplesFromJourneyTrace } from "@/lib/journey-trace";
import { listRemixOptions, REMIX_FAMILIES } from "@/lib/journey-trace/remix-catalog";
import { useJourneyPlayer } from "@/lib/journey-trace/use-journey-player";
import type { ExperienceKind } from "@/lib/experiences";

function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function JourneyPlayer({ journeyId }: { journeyId: string }) {
  const p = useJourneyPlayer(journeyId);
  const options = listRemixOptions(p.family);
  const energy = p.trace ? energySamplesFromJourneyTrace(p.trace, 32) : [];
  const progress = p.durationMs > 0 ? Math.min(1, p.playheadMs / p.durationMs) : 0;
  const isDev = import.meta.env.DEV;
  const [keepPosition, setKeepPosition] = useState(true);
  const activeOption = options.find((option) => option.profileId === p.profileId);

  if (!p.trace) {
    return (
      <p className="mt-8 text-center text-sm text-muted-foreground">
        No motion trace for this journey. Finish a Silent Capture or Live + Capture drive to replay.
      </p>
    );
  }

  if (!p.trace.samples.length) {
    return (
      <p className="mt-8 text-center text-sm text-muted-foreground">
        This journey has no motion samples.
      </p>
    );
  }

  return (
    <section className="mt-4">
      <div className="border border-foreground/10 px-4 py-6">
        <p className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
          Motion Signature
        </p>
        <div className="relative mt-4">
          <MotionSignature
            seed={p.trace.journeyId}
            energy={energy}
            family="drive-song"
            ribbons={4}
            width={360}
            height={160}
            className="mx-auto h-36 w-full text-foreground"
            accent="rgba(180,210,255,0.75)"
            label="Motion Signature"
          />
          <div
            className="pointer-events-none absolute inset-y-2 w-px bg-foreground/70"
            style={{ left: `${progress * 100}%` }}
            aria-hidden
          />
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {formatClock(p.playheadMs)} / {formatClock(p.durationMs)}
          {p.trace.startedAt ? ` · ${new Date(p.trace.startedAt).toLocaleDateString()}` : ""}
        </p>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3 text-center text-sm">
        <div>
          <p className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Speed</p>
          <p className="mt-1 font-light tabular-nums">{Math.round(p.state.speed * 3.6)} km/h</p>
        </div>
        <div>
          <p className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Gear</p>
          <p className="mt-1 font-light tabular-nums">{p.state.gear || "-"}</p>
        </div>
        <div>
          <p className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">RPM</p>
          <p className="mt-1 font-light tabular-nums">
            {p.state.rpm ? Math.round(p.state.rpm) : "-"}
          </p>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(1, p.durationMs)}
        value={p.playheadMs}
        onChange={(e) => p.seek(Number(e.target.value))}
        className="mt-6 w-full accent-foreground"
        aria-label="Seek journey"
      />

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => void (p.playing ? p.pause() : p.play())}
          className="h-12 min-w-[7rem] rounded-full bg-primary px-6 text-[10px] tracking-[0.2em] text-primary-foreground uppercase"
        >
          {p.playing ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={() => p.restart()}
          className="h-12 rounded-full border border-border px-5 text-[10px] tracking-[0.2em] uppercase"
        >
          Restart
        </button>
        <button
          type="button"
          onClick={() => p.stop(keepPosition)}
          className="h-12 rounded-full border border-border px-5 text-[10px] tracking-[0.2em] uppercase text-muted-foreground"
        >
          Stop
        </button>
      </div>

      {isDev ? (
        <div className="mt-4 flex justify-center gap-2">
          {[0.5, 1, 2].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => p.setRate(r)}
              className="border border-border/60 px-3 py-1 text-[10px] tracking-[0.16em] uppercase text-muted-foreground"
            >
              {r}×
            </button>
          ))}
        </div>
      ) : null}

      <label className="mt-5 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
        <input
          type="checkbox"
          checked={keepPosition}
          onChange={(event) => setKeepPosition(event.target.checked)}
          className="accent-foreground"
        />
        Keep position when I stop
      </label>

      <p className="mt-12 text-center text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
        Hear this drive as
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {REMIX_FAMILIES.map((f) => (
          <button
            key={f.kind}
            type="button"
            onClick={() => void p.selectFamily(f.kind)}
            className={
              p.family === f.kind
                ? "border border-foreground px-4 py-2 text-[10px] tracking-[0.18em] uppercase"
                : "border border-border px-4 py-2 text-[10px] tracking-[0.18em] uppercase text-muted-foreground"
            }
          >
            {f.title}
          </button>
        ))}
      </div>

      <div className="mt-6 text-center">
        <p className="text-xl font-light">{activeOption?.label ?? p.profileId}</p>
        <p className="mt-1 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          {p.family} interpretation
        </p>
      </div>

      <p className="mt-7 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
        Try another sound.
      </p>
      <div className="mt-3 max-h-48 overflow-y-auto border border-border/50">
        {options.map((o) => (
          <button
            key={o.profileId}
            type="button"
            onClick={() => void p.tryAnother(o.profileId)}
            className={
              p.profileId === o.profileId
                ? "flex w-full items-center justify-between border-b border-border/40 bg-foreground/[0.04] px-4 py-3 text-left text-sm"
                : "flex w-full items-center justify-between border-b border-border/40 px-4 py-3 text-left text-sm text-muted-foreground"
            }
          >
            <span className="font-light">{o.label}</span>
            {p.profileId === o.profileId ? (
              <span className="text-[10px] tracking-[0.16em] uppercase">Active</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="mt-10 space-y-3 border-t border-border/60 pt-8">
        <div className="mb-5 text-center">
          <p className="text-[10px] tracking-[0.28em] text-muted-foreground uppercase">
            Remix drive
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Save this interpretation. The original journey stays unchanged.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void p.saveRemix()}
          className="h-12 w-full border border-foreground/30 text-[10px] tracking-[0.22em] uppercase"
        >
          Save remix
        </button>
        {isDev && p.family === "engine" && options.length >= 2 ? (
          <button
            type="button"
            onClick={() => void p.startAb(options[0]!.profileId, options[1]!.profileId)}
            className="h-12 w-full border border-border text-[10px] tracking-[0.22em] uppercase text-muted-foreground"
          >
            A/B same drive · {options[0]!.label} / {options[1]!.label}
          </button>
        ) : null}
        {p.ab ? (
          <button
            type="button"
            onClick={() => p.flipAb()}
            className="h-12 w-full border border-border text-[10px] tracking-[0.22em] uppercase"
          >
            Flip A/B · active {p.ab.active.toUpperCase()}
          </button>
        ) : null}
      </div>

      {p.interpretations.length > 0 ? (
        <div className="mt-10">
          <p className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            Saved remixes
          </p>
          <ul className="mt-3 space-y-2">
            {p.interpretations.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    p.setFamily(i.experienceKind as ExperienceKind);
                    void p.tryAnother(i.experienceId, i.seed);
                  }}
                >
                  {i.label || i.experienceId} · {i.experienceKind}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {p.note ? <p className="mt-6 text-center text-sm text-muted-foreground">{p.note}</p> : null}
    </section>
  );
}
