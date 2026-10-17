// LOCAL ONLY (not committed): baseline drive render for audit.
import { resolvePersonalityId } from "@/lib/drive/drivetrain-resolve";
import { PowertrainSimulator } from "@/lib/powertrain/simulator";
import { SoundEngine } from "@/lib/sound/engine";
import { allProfiles, getProfile } from "@/lib/sound/profiles";

const SR = 48000, STEP = 1 / 60;
export const SEGMENTS = [
  { name: "idle", dur: 5 },
  { name: "pull", dur: 13 },
  { name: "ease", dur: 4 },
  { name: "cruise80", dur: 10 },
  { name: "accel100", dur: 3 },
  { name: "lift", dur: 10 },
  { name: "gentle", dur: 8 },
];
export const DURATION = SEGMENTS.reduce((a, s) => a + s.dur, 0);

export function listProfiles() {
  return allProfiles().filter((p) => p.category !== "Garage")
    .map((p) => ({ id: p.id, name: p.name, category: p.category, mode: p.drivetrainMode }));
}

// returns speed km/h, accel m/s2, throttle, braking
function drive(t: number, v: number) {
  let acc = 0, thr = 0, brk = 0, seg = "";
  let t0 = 0;
  for (const s of SEGMENTS) { if (t < t0 + s.dur) { seg = s.name; break; } t0 += s.dur; }
  const vm = v / 3.6;
  switch (seg) {
    case "idle": acc = 0; thr = 0.03; break;
    case "pull": thr = 1; acc = v >= 130 ? 0 : Math.max(1.8, 4.2 - vm * 0.06); if (v >= 130) thr = 0.25; break;
    case "ease": thr = 0.02; acc = v > 80 ? -3.5 : 0; brk = v > 80 ? 0.3 : 0; break;
    case "cruise80": thr = 0.22; acc = (80 - v) * 0.3; break;
    case "accel100": thr = 0.55; acc = v < 100 ? 2.2 : 0; break;
    case "lift": thr = 0; acc = v > 30 ? -2.0 : 0; break;
    case "gentle": thr = 0.3; acc = v < 60 ? 1.05 : 0; break;
    default: thr = 0.2;
  }
  return { acc, thr, brk, seg };
}

export async function renderBaseline(profileId: string) {
  const profile = getProfile(profileId);
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * DURATION), SR);
  const engine = new SoundEngine();
  engine.setExperienceTuningEnabled(true);
  engine.setSynthesisMode("improved");
  engine.setRealismEngine("v2");
  engine.setVolume(0.7);
  await engine.start(profile, { context: ctx, signature: false, seed: 0x454c4341 } as never);
  const sim = new PowertrainSimulator({ profileId: resolvePersonalityId(profile) });
  let v = 0;
  const log: number[][] = [];
  const segs: string[] = [];
  for (let t = 0; t < DURATION; t += STEP) {
    const d = drive(t, v);
    v = Math.max(0, v + d.acc * STEP * 3.6);
    engine.setRenderTime(t);
    const pt = sim.tick({
      timestamp: Math.round(t * 1000), speedKmh: v, accelerationMs2: d.acc, accelerationFiltered: d.acc,
      decelerationMs2: Math.max(0, -d.acc), inferredThrottle: d.thr, motionConfidence: 1, primarySource: "simulator",
      sourceHealth: { phone: false, browser: false, vehicleTelemetry: true }, fallbackTier: "vehicle-telemetry", transitioning: false,
    } as never, STEP, { directThrottle: d.thr, braking: d.brk, pedalPosition: d.thr } as never);
    const sp = v / 3.6;
    engine.update({
      speed: sp, acceleration: d.acc, throttle: pt.driverDemand, regen: d.brk, rpm: pt.rpm, gear: pt.gear,
      load: pt.engineLoad, timestamp: Math.round(t * 1000), jerk: 0, isShifting: pt.shifting, powertrain: pt,
      powertrainBackend: "dynamic", speedNormalized: Math.min(1, v / 160), accelerationNormalized: Math.min(1, Math.abs(d.acc) / 4.5),
    } as never);
    log.push([+t.toFixed(4), +v.toFixed(2), d.acc, d.thr, +pt.driverDemand.toFixed(3), Math.round(pt.rpm), pt.gear, +pt.engineLoad.toFixed(3), pt.shifting ? 1 : 0]);
    segs.push(d.seg);
  }
  const backend = engine.getActiveBackend();
  const hyb = engine.getHybridCombustionDiagnostics();
  const buf = await ctx.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  const pcm = new Float32Array(L.length * 2);
  for (let i = 0; i < L.length; i++) { pcm[2 * i] = L[i]!; pcm[2 * i + 1] = R[i]!; }
  const bytes = new Uint8Array(pcm.buffer);
  let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { backend, excitationMode: hyb?.excitationMode ?? null, hybridDiag: hyb ? { orderHz: hyb.orderHz, topologyMode: hyb.topologyMode } : null,
    log, segs, pcmB64: btoa(bin) };
}
