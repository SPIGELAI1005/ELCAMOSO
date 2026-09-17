import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { SOUND_PROFILES, getProfile } from "@/lib/sound/profiles";
import { SoundEngine } from "@/lib/sound/engine";
import type { SynthesisMode } from "@/lib/sound/realism/types";
import type { RealismEngineMode } from "@/lib/sound/realism/v2";
import { isCombustionRealismV2Profile } from "@/lib/sound/realism/v2";
import { DEBUG_SCENARIOS, getDebugScenario } from "@/lib/sound/realism/debug-scenarios";
import { familyForProfile } from "@/lib/sound/realism/families";
import type { DriveState } from "@/lib/drive/model";
import { IDLE_STATE } from "@/lib/drive/model";
import {
  driveStateFromPowertrain,
  PowertrainSimulator,
  powertrainProfileForSound,
  supportsDynamicDrive,
  vehicleMotionFromDrive,
} from "@/lib/powertrain";
import { DynamicDriveLayerPanel } from "@/components/DynamicDriveLayerPanel";
import type { DynamicLayerDebugInfo } from "@/lib/sound/dynamic-drive/types";

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
  const [realismEngine, setRealismEngine] = useState<RealismEngineMode>("current");
  const [dynamicDrive, setDynamicDrive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [layers, setLayers] = useState<{ id: string; muted: boolean; triggerable?: boolean }[]>([]);
  const [dynamicLayers, setDynamicLayers] = useState<DynamicLayerDebugInfo[]>([]);
  const [solo, setSolo] = useState<string | null>(null);
  const [state, setState] = useState<DriveState>(IDLE_STATE);
  const [meter, setMeter] = useState({ peak: 0, rms: 0, headroom: 1 });

  const engineRef = useRef<SoundEngine | null>(null);
  const powertrainRef = useRef<PowertrainSimulator | null>(null);
  const prevDriveRef = useRef<DriveState>(IDLE_STATE);
  const rafRef = useRef<number | null>(null);
  const queueRef = useRef<DriveState[]>([]);
  const indexRef = useRef(0);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPlaying(false);
    void engineRef.current?.stop();
    engineRef.current = null;
    powertrainRef.current = null;
    prevDriveRef.current = IDLE_STATE;
    setLayers([]);
    setDynamicLayers([]);
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
    engine.setRealismEngine(realismEngine);
    const profile = getProfile(profileId);
    await engine.start(profile, { signature: false, seed: 42 });
    engine.setVolume(0.55);
    // Realism V2 owns combustion tonal core; Dynamic Drive remains available for current path.
    engine.setDynamicDriveEnabled(
      realismEngine === "current" && dynamicDrive && supportsDynamicDrive(profile),
    );
    engineRef.current = engine;
    const wantPowertrain =
      supportsDynamicDrive(profile) &&
      (dynamicDrive || (realismEngine === "v2" && isCombustionRealismV2Profile(profile.id)));
    if (wantPowertrain) {
      powertrainRef.current = new PowertrainSimulator({
        profile: powertrainProfileForSound(profile),
      });
    } else {
      powertrainRef.current = null;
    }
    prevDriveRef.current = IDLE_STATE;
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
      const raw = queue[i]!;
      let frame = raw;
      const sim = powertrainRef.current;
      if (sim) {
        const motion = vehicleMotionFromDrive({
          speedMps: raw.speed,
          accelerationMps2: raw.acceleration,
          timestamp: performance.now(),
          throttle: raw.throttle,
          regen: raw.regen,
          source: "simulator",
        });
        const pt = sim.tick(motion, 1 / 60, {
          directThrottle: raw.throttle,
          braking: raw.regen,
        });
        frame = driveStateFromPowertrain(pt, motion, prevDriveRef.current, undefined, 1 / 60);
        prevDriveRef.current = frame;
      }
      eng.update(frame);
      setState(frame);
      setDynamicLayers(eng.getDynamicDriveDebug());
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
  }, [dynamicDrive, mode, realismEngine, profileId, scenarioId, refreshLayers, stop]);

  const profile = getProfile(profileId);
  const vehicleScenarios = DEBUG_SCENARIOS.filter((s) => s.family === "vehicle");
  const motionScenarios = DEBUG_SCENARIOS.filter((s) => s.family === "motion");
  const v2Eligible = isCombustionRealismV2Profile(profileId);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-6 pt-16 pb-28 sm:px-10">
        <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">Dev only</p>
        <h1 className="mt-3 text-3xl font-light">Sound debug</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Repeatable motion scenarios, Original / Improved A/B, and layer solo for tuning ELCAMOSO
          profiles.
        </p>
        <Link
          to="/debug/powertrain"
          className="mt-4 inline-block text-[11px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
        >
          Dynamic Drive powertrain simulator →
        </Link>
        <Link
          to="/debug/calibration"
          className="mt-2 inline-block text-[11px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
        >
          Road-test calibration lab →
        </Link>
        <Link
          to="/debug/billing"
          className="mt-2 inline-block text-[11px] tracking-[0.2em] text-muted-foreground uppercase hover:text-foreground"
        >
          Billing admin diagnostics →
        </Link>

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
            <p className="text-sm text-muted-foreground">Realism engine (dev A/B)</p>
            <div className="mt-2 flex gap-3">
              {(
                [
                  ["current", "Current Engine"],
                  ["v2", "Realism V2"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={realismEngine === id}
                  disabled={id === "v2" && !v2Eligible}
                  onClick={() => setRealismEngine(id)}
                  className={`h-10 rounded-full border px-5 text-[11px] tracking-[0.2em] uppercase disabled:opacity-40 ${
                    realismEngine === id ? "border-foreground bg-secondary" : "border-border"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {v2Eligible
                ? "Same motion trace plays through Current or V2 for combustion profiles."
                : "Realism V2 applies to combustion profiles (GT V8, Flat-Six, etc.)."}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Dynamic Drive audio</p>
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                aria-pressed={!dynamicDrive}
                onClick={() => setDynamicDrive(false)}
                className={`h-10 rounded-full border px-5 text-[11px] tracking-[0.2em] uppercase ${
                  !dynamicDrive ? "border-foreground bg-secondary" : "border-border"
                }`}
              >
                Legacy
              </button>
              <button
                type="button"
                aria-pressed={dynamicDrive}
                onClick={() => setDynamicDrive(true)}
                disabled={!supportsDynamicDrive(profile)}
                className={`h-10 rounded-full border px-5 text-[11px] tracking-[0.2em] uppercase disabled:opacity-40 ${
                  dynamicDrive ? "border-foreground bg-secondary" : "border-border"
                }`}
              >
                Dynamic Drive
              </button>
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
          <MeterRow label="Rev match" value={state.powertrain?.revMatchActive ? "yes" : "no"} />
          <MeterRow label="Overrun" value={state.powertrain?.overrun ? "yes" : "no"} />
          <MeterRow label="Jerk" value={state.jerk.toFixed(2)} />
          <MeterRow label="Peak" value={meter.peak.toFixed(3)} />
          <MeterRow label="RMS" value={meter.rms.toFixed(3)} />
          <MeterRow label="Headroom" value={meter.headroom.toFixed(2)} />
        </section>

        {dynamicDrive && dynamicLayers.length > 0 ? (
          <section className="mt-8 border border-border p-6">
            <h2 className="text-base">Dynamic Drive layers</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Crossfade gains and fundamental Hz per band — not a single playbackRate mapping.
            </p>
            <DynamicDriveLayerPanel layers={dynamicLayers} className="mt-4" />
          </section>
        ) : null}

        {mode === "improved" && layers.length > 0 && !dynamicDrive ? (
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
