import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { SOUND_PROFILES, getProfile } from "@/lib/sound/profiles";
import { SoundEngine } from "@/lib/sound/engine";
import type { SynthesisMode } from "@/lib/sound/realism/types";
import {
  DEBUG_SCENARIOS,
  getDebugScenario,
} from "@/lib/sound/realism/debug-scenarios";
import { familyForProfile } from "@/lib/sound/realism/families";
import type { DriveState } from "@/lib/drive/model";
import { IDLE_STATE } from "@/lib/drive/model";

export const Route = createFileRoute("/debug")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) {
      throw redirect({ to: "/" });
    }
  },
  component: DebugHarness,
  head: () => ({
    meta: [{ title: "Sound Debug · ELCAMOSO" }],
  }),
});

function DebugHarness() {
  const [profileId, setProfileId] = useState(SOUND_PROFILES[0]!.id);
  const [scenarioId, setScenarioId] = useState("0-30-gentle");
  const [mode, setMode] = useState<SynthesisMode>("improved");
  const [playing, setPlaying] = useState(false);
  const [layers, setLayers] = useState<{ id: string; muted: boolean; triggerable?: boolean }[]>([]);
  const [solo, setSolo] = useState<string | null>(null);
  const [state, setState] = useState<DriveState>(IDLE_STATE);
  const [meter, setMeter] = useState({ peak: 0, rms: 0, headroom: 1 });

  const engineRef = useRef<SoundEngine | null>(null);
  const rafRef = useRef<number | null>(null);
  const queueRef = useRef<DriveState[]>([]);
  const indexRef = useRef(0);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPlaying(false);
    void engineRef.current?.stop();
    engineRef.current = null;
    setLayers([]);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const refreshLayers = useCallback(() => {
    const list = engineRef.current?.listImprovedLayers() ?? [];
    setLayers(list);
  }, []);

  const start = useCallback(async () => {
    stop();
    const engine = new SoundEngine();
    engine.setSynthesisMode(mode);
    const profile = getProfile(profileId);
    await engine.start(profile, { signature: false, seed: 42 });
    engine.setVolume(0.55);
    engineRef.current = engine;
    const scenario = getDebugScenario(scenarioId);
    queueRef.current = scenario.build(profileId);
    indexRef.current = 0;
    setPlaying(true);
    refreshLayers();

    const tick = () => {
      const eng = engineRef.current;
      const queue = queueRef.current;
      if (!eng || !queue.length) return;
      const i = Math.min(indexRef.current, queue.length - 1);
      const frame = queue[i]!;
      eng.update(frame);
      setState(frame);
      const m = eng.getMeter();
      if (m) setMeter({ peak: m.peak, rms: m.rms, headroom: m.headroom });
      indexRef.current += 1;
      if (indexRef.current >= queue.length) {
        // hold last frame
        indexRef.current = queue.length - 1;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [mode, profileId, scenarioId, refreshLayers, stop]);

  const profile = getProfile(profileId);
  const vehicleScenarios = DEBUG_SCENARIOS.filter((s) => s.family === "vehicle");
  const motionScenarios = DEBUG_SCENARIOS.filter((s) => s.family === "motion");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-6 pt-16 pb-28 sm:px-10">
        <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">
          Dev only
        </p>
        <h1 className="mt-3 text-3xl font-light">Sound debug</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Repeatable motion scenarios, Original / Improved A/B, and layer solo for
          tuning ELCAMOSO profiles.
        </p>

        <section className="mt-10 space-y-6 border border-border p-6">
          <label className="block text-sm">
            <span className="text-muted-foreground">Sound Profile</span>
            <select
              className="mt-2 h-11 w-full border border-border bg-background px-3"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
            >
              {SOUND_PROFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <div>
            <p className="text-sm text-muted-foreground">Synthesis</p>
            <div className="mt-2 flex gap-3">
              {(["improved", "original"] as SynthesisMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={`h-10 rounded-full border px-5 text-[11px] tracking-[0.2em] uppercase ${
                    mode === m ? "border-foreground bg-secondary" : "border-border"
                  }`}
                >
                  {m === "improved" ? "Improved" : "Original"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Vehicle scenarios</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {vehicleScenarios.map((s) => (
                <ScenarioChip
                  key={s.id}
                  label={s.label}
                  active={scenarioId === s.id}
                  onClick={() => setScenarioId(s.id)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Motion scenarios</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {motionScenarios.map((s) => (
                <ScenarioChip
                  key={s.id}
                  label={s.label}
                  active={scenarioId === s.id}
                  onClick={() => setScenarioId(s.id)}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void start()}
              className="h-11 rounded-full border border-border px-6 text-[11px] tracking-[0.24em] uppercase hover:bg-secondary"
            >
              {playing ? "Restart" : "Play"}
            </button>
            <button
              type="button"
              onClick={stop}
              disabled={!playing}
              className="h-11 rounded-full border border-border px-6 text-[11px] tracking-[0.24em] uppercase hover:bg-secondary disabled:opacity-40"
            >
              Stop
            </button>
          </div>
        </section>

        <section className="mt-8 grid gap-4 border border-border p-6 text-sm sm:grid-cols-2">
          <MeterRow label="Profile" value={profile.name} />
          <MeterRow label="Family" value={familyForProfile(profile)} />
          <MeterRow label="Mode" value={mode} />
          <MeterRow label="Speed" value={`${(state.speed * 3.6).toFixed(0)} km/h`} />
          <MeterRow label="Throttle" value={state.throttle.toFixed(2)} />
          <MeterRow label="Regen" value={state.regen.toFixed(2)} />
          <MeterRow label="RPM" value={state.rpm.toFixed(0)} />
          <MeterRow label="Gear" value={String(state.gear)} />
          <MeterRow label="Shifting" value={state.isShifting ? "yes" : "no"} />
          <MeterRow label="Jerk" value={state.jerk.toFixed(2)} />
          <MeterRow label="Peak" value={meter.peak.toFixed(3)} />
          <MeterRow label="RMS" value={meter.rms.toFixed(3)} />
          <MeterRow label="Headroom" value={meter.headroom.toFixed(2)} />
        </section>

        {mode === "improved" && layers.length > 0 ? (
          <section className="mt-8 border border-border p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base">Layers</h2>
              <button
                type="button"
                onClick={() => {
                  setSolo(null);
                  engineRef.current?.setImprovedLayerSolo(null);
                }}
                className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase"
              >
                Clear solo
              </button>
            </div>
            <ul className="mt-4 space-y-3">
              {layers.map((layer) => (
                <li
                  key={layer.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3"
                >
                  <span className="font-mono text-xs">{layer.id}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !layer.muted;
                        engineRef.current?.setImprovedLayerMuted(layer.id, next);
                        refreshLayers();
                      }}
                      className="h-9 rounded-full border border-border px-4 text-[10px] tracking-[0.18em] uppercase"
                    >
                      {layer.muted ? "Unmute" : "Mute"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = solo === layer.id ? null : layer.id;
                        setSolo(next);
                        engineRef.current?.setImprovedLayerSolo(next);
                      }}
                      className={`h-9 rounded-full border px-4 text-[10px] tracking-[0.18em] uppercase ${
                        solo === layer.id ? "border-foreground bg-secondary" : "border-border"
                      }`}
                    >
                      Solo
                    </button>
                    {layer.triggerable ? (
                      <button
                        type="button"
                        onClick={() => engineRef.current?.triggerImprovedLayer(layer.id)}
                        className="h-9 rounded-full border border-border px-4 text-[10px] tracking-[0.18em] uppercase"
                      >
                        Trigger
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function ScenarioChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 rounded-full border px-4 text-[10px] tracking-[0.14em] uppercase ${
        active ? "border-foreground bg-secondary" : "border-border"
      }`}
    >
      {label}
    </button>
  );
}

function MeterRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
