import "@/test-utils/install-web-audio";
import { describe, expect, it } from "vitest";

import { SoundEngine } from "@/lib/sound/engine";
import { getProfile } from "@/lib/sound/profiles";
import { renderLabOffline } from "@/lib/sound/lab/render-harness";
import { engineLayerStackFor } from "@/lib/sound/engine-layers";

const PEAK_MAX_DBFS = -0.99;
/** Layered mix should stay near the unlayered V8 (lab approximate LUFS). */
const LOUDNESS_MATCH_DB = 2.5;

describe("American Muscle V8 + Big Twin engine layer", () => {
  it("starts a second hybrid engine under Muscle V8 but not under Big Twin or Police Patrol", async () => {
    const Offline =
      globalThis.OfflineAudioContext ??
      (globalThis as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
        .webkitOfflineAudioContext;
    if (!Offline) {
      expect(true).toBe(true);
      return;
    }

    const engine = new SoundEngine();
    const ctx = new Offline(2, 48000, 48000);
    await engine.start(getProfile("american-muscle-v8"), {
      context: ctx,
      signature: false,
      seed: 11,
    });
    expect(engineLayerStackFor("american-muscle-v8")).toBeTruthy();
    expect(engine.getResourceDiagnostics().engineLayerCount).toBe(1);
    expect(engine.getEngineLayerDiagnostics()[0]?.cylinders).toBe(2);
    await engine.stop();

    const twinCtx = new Offline(2, 48000, 48000);
    const twinEngine = new SoundEngine();
    await twinEngine.start(getProfile("big-twin"), {
      context: twinCtx,
      signature: false,
      seed: 11,
    });
    expect(twinEngine.getResourceDiagnostics().engineLayerCount).toBe(0);
    await twinEngine.stop();

    const patrolCtx = new Offline(2, 48000, 48000);
    const patrolEngine = new SoundEngine();
    await patrolEngine.start(getProfile("police-patrol"), {
      context: patrolCtx,
      signature: false,
      seed: 11,
    });
    expect(patrolEngine.getResourceDiagnostics().engineLayerCount).toBe(0);
    await patrolEngine.stop();
  }, 30_000);

  it("keeps layered Muscle V8 within peak protect and near unlayered loudness (rpm-sweep)", async () => {
    const before = await renderLabOffline({
      profileId: "american-muscle-v8",
      fixtureId: "rpm-sweep",
      includeSpectrum: false,
      environmentId: "open",
      engineLayersEnabled: false,
    });
    const after = await renderLabOffline({
      profileId: "american-muscle-v8",
      fixtureId: "rpm-sweep",
      includeSpectrum: false,
      environmentId: "open",
      engineLayersEnabled: true,
    });

    expect(after.metrics.nanCount).toBe(0);
    expect(after.metrics.infinityCount).toBe(0);
    expect(after.metrics.samplePeakDbfs).toBeLessThanOrEqual(PEAK_MAX_DBFS);
    expect(before.metrics.samplePeakDbfs).toBeLessThanOrEqual(PEAK_MAX_DBFS);

    const delta = Math.abs(
      after.metrics.approximateIntegratedLoudness - before.metrics.approximateIntegratedLoudness,
    );
    expect(delta).toBeLessThanOrEqual(LOUDNESS_MATCH_DB);
  }, 120_000);
});
