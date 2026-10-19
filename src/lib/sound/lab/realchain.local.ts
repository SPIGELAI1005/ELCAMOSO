// LOCAL ONLY: renders through the same chain as DriveSession "drive": Tesla-browser GPS (1 Hz,
// noisy, late) → sensor fusion → PowertrainSimulator → driveStateFromPowertrain → SoundEngine
// configured exactly like DriveSession.begin() with DEFAULT_SETTINGS.
import { intensityCeiling } from "@/lib/drive/safety";
import { DEFAULT_SETTINGS, getProfileGain } from "@/lib/drive/settings";
import { createSensorFusion, pushMotionSample, tickSensorFusion, browserGpsMotionSample } from "@/lib/motion/sensor-fusion";
import { driveStateFromPowertrain } from "@/lib/powertrain/adapters/drive-state";
import { powertrainProfileForSound } from "@/lib/powertrain/adapters/profile-map";
import { PowertrainSimulator } from "@/lib/powertrain/simulator";
import { SoundEngine } from "@/lib/sound/engine";
import { IDLE_STATE } from "@/lib/drive/model";
import { normalizeMix } from "@/lib/sound/environments";
import { getProfile } from "@/lib/sound/profiles";

const SR = 48000, STEP = 1 / 60;
// km/h targets at piecewise times (true vehicle speed); GPS samples it at 1 Hz with noise.
const PLANS: Record<string, [number, number][]> = {
  std: [[0,0],[6,0],[14,50],[30,50],[38,100],[52,100],[62,60],[72,60],[80,20],[86,0],[90,0]],
  // gentle: slow build-ups, long steady cruises
  gentle: [[0,0],[6,0],[26,30],[40,30],[60,60],[72,60],[82,40],[88,0],[90,0]],
  // hard: launch 0-100 in ~8 s, lift-off, hard 50-110, brake
  // idle: parked, engine idling for the whole render (idle liveliness checks)
  idle: [[0,0],[90,0]],
  hard: [[0,0],[6,0],[9,50],[14,100],[20,100],[28,50],[34,50],[40,110],[50,110],[62,30],[70,30],[74,90],[80,90],[88,0],[90,0]],
};
let PLAN = PLANS.std!;
export const DURATION = 90;
function trueSpeed(t: number) {
  for (let i = 1; i < PLAN.length; i++) { const [t1, v1] = PLAN[i]!, [t0, v0] = PLAN[i - 1]!; if (t <= t1) return v0 + (v1 - v0) * (t - t0) / (t1 - t0); }
  return 0;
}
export async function renderRealChain(profileId: string, extras: boolean, plan = "std") {
  const [planPart, presetOverride] = plan.split("#");
  const [pn, force] = planPart!.split("@");
  PLAN = PLANS[pn!] ?? PLANS.std!;
  (globalThis as any).__ELC_REC_FORCE = force === undefined ? undefined : Number(force);
  const profile = getProfile(profileId);
  const s = DEFAULT_SETTINGS;
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * DURATION), SR);
  const engine = new SoundEngine();
  await engine.start(profile, { context: ctx, signature: false, environmentId: s.environmentId, mix: normalizeMix(s.layerMix), snippets: s.snippets } as never);
  engine.setCabinEq(s.cabinEq);
  engine.setIntensityCeiling(intensityCeiling(profile));
  engine.setProfileGain(getProfileGain(s, profileId));
  engine.setOutputBoostDb(s.outputBoostDb);
  engine.setCharacterFeel(s.bodyCharacter, s.mechanicalCharacter);
  engine.setVolume(s.volume);
  engine.setDynamicDriveEnabled(true);
  engine.setAdvancedTransientsEnabled(extras);
  engine.setShiftIntensity(s.shiftFeel.shiftIntensity ?? 0.72);
  await (engine as any).whenSamplesReady?.();
  const fusion = createSensorFusion();
  fusion.options.sensitivity = s.motionSensitivity; fusion.options.noiseFloor = s.motionNoiseFloor;
  const sim = new PowertrainSimulator({ profile: powertrainProfileForSound(profile), shiftMapPreset: presetOverride ?? s.shiftMapPreset ?? "legacy" } as never);
  let state: any = IDLE_STATE; let rng = 12345; const rnd = () => ((rng = (rng * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const log: number[][] = []; let nextGps = 0.3;
  for (let t = 0; t < DURATION; t += STEP) {
    const ms = 100000 + t * 1000;
    if (t >= nextGps) {
      // Tesla browser GPS: ~1 Hz, ~0.8 s late, ±0.6 km/h noise.
      const v = Math.max(0, trueSpeed(t - 0.8) + (rnd() - 0.5) * 1.2);
      pushMotionSample(fusion, browserGpsMotionSample({ speedMs: v / 3.6, accuracyM: 5, timestamp: ms }), ms);
      nextGps += 0.9 + rnd() * 0.25;
    }
    engine.setRenderTime(t);
    const motion = tickSensorFusion(fusion, { now: ms, dt: STEP });
    const pt = sim.tick(motion, STEP, {});
    state = driveStateFromPowertrain(pt, motion, state, s.tuning, STEP);
    engine.update(state);
    log.push([+t.toFixed(3), +(motion.speedKmh).toFixed(2), +trueSpeed(t).toFixed(1), +state.throttle.toFixed(3), Math.round(pt.rpm), pt.gear, +pt.engineLoad.toFixed(3), +(pt.boost ?? 0).toFixed(3), pt.overrun ? 1 : 0]);
  }
  const buf = await ctx.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  const pcm = new Float32Array(L.length * 2);
  for (let i = 0; i < L.length; i++) { pcm[2 * i] = L[i]!; pcm[2 * i + 1] = R[i]!; }
  const bytes = new Uint8Array(pcm.buffer); let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { backend: engine.getActiveBackend() + ' rec=' + JSON.stringify({ n: (engine as any).hybrid?.recordedBuffers?.size, ids: (engine as any).hybrid?.getDiagnostics?.().activeSampleIds }), log, pcmB64: btoa(bin) };
}
