import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SOUND_PROFILES } from "@/lib/sound/profiles";
import {
  DIAGNOSTIC_FIXTURE_IDS,
  LAB_FIXTURES,
  SPEED_DRIVEN_FIXTURE_IDS,
  levelMatchGainDb,
  renderLabCapture,
  type LabCaptureResult,
} from "@/lib/sound/lab";
import {
  getAudioLabAccessConfiguredFn,
  verifyAudioLabAccessFn,
} from "@/lib/sound/lab/server-fns";
import { SoundEngine } from "@/lib/sound/engine";
import { getProfile } from "@/lib/sound/profiles";
import type { AudioLayerRole } from "@/lib/sound/profile-experience-config";

const LAB_SECRET_KEY = "elcamoso.audioLabSecret";

export const Route = createFileRoute("/debug/audio-lab")({
  component: AudioLabPage,
  head: () => ({
    meta: [
      { title: "Audio Lab · ELCAMOSO Debug" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type AbSide = "A" | "B";

function AudioLabPage() {
  const isDev = import.meta.env.DEV;
  const [secretConfigured, setSecretConfigured] = useState<boolean | null>(null);
  const [labSecret, setLabSecret] = useState("");
  const [authorized, setAuthorized] = useState(isDev);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (isDev) {
      setAuthorized(true);
      return;
    }
    const stored = sessionStorage.getItem(LAB_SECRET_KEY);
    if (stored) setLabSecret(stored);
    void getAudioLabAccessConfiguredFn()
      .then((result) => setSecretConfigured(result.configured))
      .catch(() => setSecretConfigured(false));
  }, [isDev]);

  const unlock = useCallback(async () => {
    setAuthError(null);
    try {
      await verifyAudioLabAccessFn({ data: { labSecret: labSecret.trim() } });
      sessionStorage.setItem(LAB_SECRET_KEY, labSecret.trim());
      setAuthorized(true);
    } catch {
      setAuthError("Access denied. Deployed lab requires a configured server secret.");
      setAuthorized(false);
    }
  }, [labSecret]);

  if (!isDev && !authorized) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-sm">
        <p className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
          Debug · Audio Lab
        </p>
        <h1 className="mt-3 text-2xl font-light">Authorized access required</h1>
        <p className="mt-3 text-muted-foreground">
          This lab is not in product navigation. On deployed hosts it needs{" "}
          <code className="text-foreground">ELCAMOSO_AUDIO_LAB_SECRET</code> or{" "}
          <code className="text-foreground">ELCAMOSO_BILLING_ADMIN_SECRET</code> — not a hidden URL
          alone.
        </p>
        {secretConfigured === false ? (
          <p className="mt-4 text-[#e53935]">Lab secret is not configured on this server.</p>
        ) : (
          <div className="mt-6 space-y-3">
            <input
              type="password"
              value={labSecret}
              onChange={(event) => setLabSecret(event.target.value)}
              placeholder="Lab / admin secret"
              className="h-11 w-full rounded-full border border-border bg-transparent px-4"
            />
            <button
              type="button"
              onClick={() => void unlock()}
              className="h-11 rounded-full bg-primary px-6 text-xs tracking-[0.18em] text-primary-foreground uppercase"
            >
              Unlock
            </button>
            {authError ? <p className="text-[#e53935]">{authError}</p> : null}
          </div>
        )}
        <Link to="/" className="mt-8 inline-block text-muted-foreground hover:text-foreground">
          Back home
        </Link>
      </main>
    );
  }

  return <AudioLabWorkbench />;
}

function AudioLabWorkbench() {
  const [profileId, setProfileId] = useState(SOUND_PROFILES[0]!.id);
  const [profileIdB, setProfileIdB] = useState("cyber-pulse");
  const [fixtureId, setFixtureId] = useState("gentle-0-80");
  const [captureA, setCaptureA] = useState<LabCaptureResult | null>(null);
  const [captureB, setCaptureB] = useState<LabCaptureResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<AbSide | null>(null);
  const [matchLevels, setMatchLevels] = useState(true);
  const [layers, setLayers] = useState<{ id: string; muted: boolean; role?: AudioLayerRole }[]>(
    [],
  );
  const [solo, setSolo] = useState<string | null>(null);

  const engineRef = useRef<SoundEngine | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const fixture = useMemo(
    () => LAB_FIXTURES.find((entry) => entry.id === fixtureId) ?? LAB_FIXTURES[0]!,
    [fixtureId],
  );

  const stopPlayback = useCallback(() => {
    void engineRef.current?.stop();
    engineRef.current = null;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPlaying(null);
    setLayers([]);
    setSolo(null);
  }, []);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const runCapture = useCallback(
    async (side: AbSide) => {
      setBusy(true);
      setError(null);
      stopPlayback();
      try {
        const result = await renderLabCapture({
          profileId: side === "A" ? profileId : profileIdB,
          ...(fixture.abruptProfileSwitch ? { profileIdB } : {}),
          fixtureId,
          includeSpectrum: true,
          capturePath: "offline-audio-context",
        });
        if (side === "A") setCaptureA(result);
        else setCaptureB(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Capture failed");
      } finally {
        setBusy(false);
      }
    },
    [fixture.abruptProfileSwitch, fixtureId, profileId, profileIdB, stopPlayback],
  );

  const playSide = useCallback(
    async (side: AbSide) => {
      // Never play A and B simultaneously.
      stopPlayback();
      const capture = side === "A" ? captureA : captureB;
      if (!capture) return;
      const binary = atob(capture.wavBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      let gain = 1;
      if (matchLevels && captureA && captureB) {
        const ref = side === "A" ? captureB : captureA;
        const gainDb = levelMatchGainDb(
          ref.metrics.approximateIntegratedLoudness,
          capture.metrics.approximateIntegratedLoudness,
          capture.metrics.samplePeakDbfs,
        );
        gain = 10 ** (gainDb / 20);
      }
      const blob = new Blob([bytes], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audio.volume = Math.min(1, Math.max(0.05, 0.7 * gain));
      setPlaying(side);
      audio.onended = () => setPlaying(null);
      await audio.play();

      // Layer mute/solo uses a live engine for the selected profile (inspection), not dual A/B.
      const engine = new SoundEngine();
      engineRef.current = engine;
      await engine.start(getProfile(capture.metadata.profileId), { signature: false });
      setLayers(engine.listImprovedLayers());
    },
    [captureA, captureB, matchLevels, stopPlayback],
  );

  const download = useCallback((side: AbSide) => {
    const capture = side === "A" ? captureA : captureB;
    if (!capture) return;
    const binary = atob(capture.wavBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${capture.metadata.profileId}-${capture.metadata.fixtureId}-${side}.wav`;
    anchor.click();
    URL.revokeObjectURL(url);
    const metaBlob = new Blob([JSON.stringify(capture.metadata, null, 2)], {
      type: "application/json",
    });
    const metaUrl = URL.createObjectURL(metaBlob);
    const metaAnchor = document.createElement("a");
    metaAnchor.href = metaUrl;
    metaAnchor.download = `${capture.metadata.profileId}-${capture.metadata.fixtureId}-${side}.meta.json`;
    metaAnchor.click();
    URL.revokeObjectURL(metaUrl);
  }, [captureA, captureB]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            Debug · Audio Lab
          </p>
          <h1 className="mt-2 text-2xl font-light">Production engine comparison lab</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Exercises the real SoundEngine graph with synthetic telemetry. Lower centroid or more
            bass is not proven realism. Recording stays off unless you capture here.
          </p>
        </div>
        <Link to="/debug" className="text-muted-foreground hover:text-foreground">
          Sound debug
        </Link>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            Profile A
          </span>
          <select
            value={profileId}
            onChange={(event) => setProfileId(event.target.value)}
            className="h-11 w-full rounded-full border border-border bg-transparent px-4"
          >
            {SOUND_PROFILES.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} ({profile.id})
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2">
          <span className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            Profile B / switch target
          </span>
          <select
            value={profileIdB}
            onChange={(event) => setProfileIdB(event.target.value)}
            className="h-11 w-full rounded-full border border-border bg-transparent px-4"
          >
            {SOUND_PROFILES.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} ({profile.id})
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="mt-6">
        <p className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          Speed-driven fixtures
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SPEED_DRIVEN_FIXTURE_IDS.map((id) => (
            <FixtureChip
              key={id}
              id={id}
              active={fixtureId === id}
              onClick={() => setFixtureId(id)}
            />
          ))}
        </div>
        <p className="mt-5 text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          Diagnosis-only RPM / load sweeps
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DIAGNOSTIC_FIXTURE_IDS.map((id) => (
            <FixtureChip
              key={id}
              id={id}
              active={fixtureId === id}
              onClick={() => setFixtureId(id)}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{fixture.description}</p>
      </section>

      <section className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void runCapture("A")}
          className="h-11 rounded-full bg-primary px-6 text-xs tracking-[0.18em] text-primary-foreground uppercase disabled:opacity-50"
        >
          Capture A
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void runCapture("B")}
          className="h-11 rounded-full border border-border px-6 text-xs tracking-[0.18em] uppercase disabled:opacity-50"
        >
          Capture B
        </button>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={matchLevels}
            onChange={(event) => setMatchLevels(event.target.checked)}
          />
          Level-match A/B playback
        </label>
        {busy ? <span className="text-muted-foreground">Rendering…</span> : null}
        {error ? <span className="text-[#e53935]">{error}</span> : null}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <CaptureCard
          side="A"
          capture={captureA}
          playing={playing === "A"}
          onPlay={() => void playSide("A")}
          onStop={stopPlayback}
          onDownload={() => download("A")}
        />
        <CaptureCard
          side="B"
          capture={captureB}
          playing={playing === "B"}
          onPlay={() => void playSide("B")}
          onStop={stopPlayback}
          onDownload={() => download("B")}
        />
      </section>

      {layers.length ? (
        <section className="mt-8 border-t border-border pt-6">
          <h2 className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
            Layer mute / solo (live engine for active profile — not dual A/B)
          </h2>
          <ul className="mt-4 space-y-3">
            {layers.map((layer) => (
              <li key={layer.id} className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-xs">
                  {layer.id}
                  {layer.role ? ` · ${layer.role}` : ""}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="h-9 rounded-full border border-border px-4 text-[10px] tracking-[0.16em] uppercase"
                    onClick={() => {
                      const next = !layer.muted;
                      engineRef.current?.setImprovedLayerMuted(layer.id, next);
                      setLayers(engineRef.current?.listImprovedLayers() ?? []);
                    }}
                  >
                    {layer.muted ? "Unmute" : "Mute"}
                  </button>
                  <button
                    type="button"
                    className={`h-9 rounded-full border px-4 text-[10px] tracking-[0.16em] uppercase ${
                      solo === layer.id ? "border-foreground bg-secondary" : "border-border"
                    }`}
                    onClick={() => {
                      const next = solo === layer.id ? null : layer.id;
                      setSolo(next);
                      engineRef.current?.setImprovedLayerSolo(next);
                    }}
                  >
                    Solo
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-10 text-xs text-muted-foreground">
        CLI: <code className="text-foreground">npm run audio:lab</code> · Docs:{" "}
        <code className="text-foreground">docs/audio/AUDIO_LAB.md</code>
      </p>
    </main>
  );
}

function FixtureChip({
  id,
  active,
  onClick,
}: {
  id: string;
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
      {id}
    </button>
  );
}

function CaptureCard({
  side,
  capture,
  playing,
  onPlay,
  onStop,
  onDownload,
}: {
  side: AbSide;
  capture: LabCaptureResult | null;
  playing: boolean;
  onPlay: () => void;
  onStop: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs tracking-[0.18em] uppercase">Capture {side}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!capture}
            onClick={playing ? onStop : onPlay}
            className="h-9 rounded-full border border-border px-4 text-[10px] tracking-[0.16em] uppercase disabled:opacity-40"
          >
            {playing ? "Stop" : "Play"}
          </button>
          <button
            type="button"
            disabled={!capture}
            onClick={onDownload}
            className="h-9 rounded-full border border-border px-4 text-[10px] tracking-[0.16em] uppercase disabled:opacity-40"
          >
            WAV + meta
          </button>
        </div>
      </div>
      {!capture ? (
        <p className="mt-4 text-muted-foreground">No capture yet.</p>
      ) : (
        <dl className="mt-4 space-y-2 text-xs">
          <Row label="Profile" value={capture.metadata.profileId} />
          <Row label="Fixture" value={capture.metadata.fixtureId} />
          <Row label="Backend" value={capture.metadata.rendererBackend} />
          <Row label="Excitation" value={capture.metadata.excitationMode ?? "n/a"} />
          <Row label="Path" value={capture.metadata.capturePath} />
          <Row label="Peak dBFS" value={capture.metrics.samplePeakDbfs.toFixed(2)} />
          <Row label="RMS dBFS" value={capture.metrics.rmsDbfs.toFixed(2)} />
          <Row label="Crest dB" value={capture.metrics.crestFactorDb.toFixed(2)} />
          <Row
            label="Approx loudness"
            value={`${capture.metrics.approximateIntegratedLoudness.toFixed(2)} (not certified LUFS)`}
          />
          <Row label="Centroid Hz" value={capture.metrics.spectralCentroidHz.toFixed(0)} />
          <Row label="DC" value={capture.metrics.dcOffset.toExponential(2)} />
          <Row
            label="NaN / Inf / clip"
            value={`${capture.metrics.nanCount} / ${capture.metrics.infinityCount} / ${capture.metrics.clippedSamples}`}
          />
          {capture.spectrum?.length ? (
            <div className="pt-2">
              <p className="text-muted-foreground">Spectrum (diagnostic)</p>
              <SpectrumBars spectrum={capture.spectrum} />
            </div>
          ) : null}
          <div className="pt-2">
            <p className="text-muted-foreground">Band energy vs mix (dB)</p>
            <ul className="mt-1 space-y-1">
              {capture.metrics.bandEnergy.map((band) => (
                <li key={`${band.lowHz}-${band.highHz}`} className="flex justify-between gap-3">
                  <span>
                    {band.lowHz}–{band.highHz} Hz
                  </span>
                  <span className="tabular-nums">{band.relativeToMixDb.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          </div>
        </dl>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 pb-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}

function SpectrumBars({ spectrum }: { spectrum: { hz: number; db: number }[] }) {
  const step = Math.max(1, Math.floor(spectrum.length / 48));
  const points = spectrum.filter((_, index) => index % step === 0).slice(0, 48);
  const min = Math.min(...points.map((point) => point.db));
  const max = Math.max(...points.map((point) => point.db));
  const span = Math.max(1, max - min);
  return (
    <div className="mt-2 flex h-16 items-end gap-px">
      {points.map((point) => (
        <div
          key={point.hz}
          title={`${point.hz.toFixed(0)} Hz · ${point.db.toFixed(1)} dB`}
          className="min-w-[2px] flex-1 bg-foreground/70"
          style={{ height: `${((point.db - min) / span) * 100}%` }}
        />
      ))}
    </div>
  );
}
