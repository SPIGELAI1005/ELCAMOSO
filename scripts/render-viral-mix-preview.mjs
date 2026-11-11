/**
 * Render Viral Mix through the production SoundEngine + SymphonySynth path.
 *
 * Usage:
 *   node scripts/render-viral-mix-preview.mjs
 *
 * Output (default /workspace/viral-ref/):
 *   viral-mix-drive-buildup.wav          (~60 s, 0→180 km/h, surges, slow-down)
 *   viral-mix-preview-idle-0.wav         (15 s held)
 *   viral-mix-preview-roll-20.wav
 *   viral-mix-preview-build-45.wav
 *   viral-mix-preview-cruise-90.wav
 *   viral-mix-preview-highway-160.wav
 *   viral-mix-preview-metadata.json
 *
 * Listening is not claimed.
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer as createNetServer } from "node:net";
import { createServer } from "vite";

const SAMPLE_RATE = 48_000;
const HOLD_SECONDS = 15;
const BUILD_SECONDS = 72;
const OUTPUT_DIR = process.env.VIRAL_MIX_PREVIEW_OUT ?? "/workspace/viral-ref";
const LAB_STEP = 1 / 60;
const SEED = 0x454c4341;

async function main() {
  console.log("=== Viral Mix lab preview (production SoundEngine path) ===");
  const port = await new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const addr = probe.address();
      const p = typeof addr === "object" && addr ? addr.port : 0;
      probe.close((err) => (err ? reject(err) : resolve(p)));
    });
  });
  const server = await createServer({ server: { host: "127.0.0.1", port, strictPort: true } });
  let browser;
  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("Vite did not expose a TCP port");
    const origin = `http://127.0.0.1:${address.port}`;
    console.log(`Vite at ${origin}`);

    browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage();
    page.setDefaultTimeout(12 * 60 * 1000);
    await page.goto(origin, { waitUntil: "domcontentloaded" });

    const result = await page.evaluate(
      async ({ sampleRate, holdSeconds, buildSeconds, step, seed }) => {
        localStorage.setItem("elcamoso.music.genre", "classic");

        const { SoundEngine } = await import("/src/lib/sound/engine.ts");
        const { getProfile } = await import("/src/lib/sound/profiles.ts");
        const { resolveGenre, hasSignatureGenre } =
          await import("/src/lib/symphony/adaptive/genre-store.ts");
        const { makeupDbForProfile } = await import("/src/lib/sound/realism/loudness.ts");

        const wavB64 = (left, right, sampleRate, startSec, durationSec) => {
          const a = Math.floor(startSec * sampleRate);
          const b = Math.min(left.length, a + Math.floor(durationSec * sampleRate));
          const frames = b - a;
          const bytes = new Uint8Array(44 + frames * 4);
          const view = new DataView(bytes.buffer);
          const text = (off, s) => {
            for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
          };
          text(0, "RIFF");
          view.setUint32(4, bytes.length - 8, true);
          text(8, "WAVEfmt ");
          view.setUint32(16, 16, true);
          view.setUint16(20, 1, true);
          view.setUint16(22, 2, true);
          view.setUint32(24, sampleRate, true);
          view.setUint32(28, sampleRate * 4, true);
          view.setUint16(32, 4, true);
          view.setUint16(34, 16, true);
          text(36, "data");
          view.setUint32(40, frames * 4, true);
          let peak = 0,
            sum = 0,
            offset = 44;
          for (let i = 0; i < frames; i++) {
            const l = Math.max(-1, Math.min(1, left[a + i] ?? 0));
            const r = Math.max(-1, Math.min(1, right[a + i] ?? 0));
            peak = Math.max(peak, Math.abs(l), Math.abs(r));
            const m = (l + r) / 2;
            sum += m * m;
            view.setInt16(offset, l < 0 ? l * 32768 : l * 32767, true);
            view.setInt16(offset + 2, r < 0 ? r * 32768 : r * 32767, true);
            offset += 4;
          }
          let binary = "";
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + chunk)));
          }
          return {
            wavBase64: btoa(binary),
            frames,
            peakDbfs: 20 * Math.log10(peak || 1e-10),
            rmsDbfs: 10 * Math.log10(sum / frames || 1e-10),
          };
        };

        const driveTo = (t, curve) => ({
          speed: curve.kmh / 3.6,
          acceleration: curve.accel,
          throttle: curve.throttle,
          regen: curve.regen ?? 0,
          rpm: 0,
          gear: curve.gear ?? 0,
          load: curve.throttle,
          timestamp: Math.round(t * 1000),
          jerk: 0,
          isShifting: Boolean(curve.shifting),
          powertrainBackend: "legacy",
          speedNormalized: Math.min(1, curve.kmh / 160),
          accelerationNormalized: Math.min(1, Math.abs(curve.accel) / 4.5),
        });

        const render = async (seconds, curve, snapshotAt = []) => {
          const ctx = new OfflineAudioContext(2, Math.ceil(sampleRate * seconds), sampleRate);
          const engine = new SoundEngine();
          engine.setVolume(1);
          engine.setExperienceTuningEnabled(true);
          const profile = getProfile("symphony-viral-mix");
          await engine.start(profile, {
            context: ctx,
            signature: false,
            seed,
            environmentId: "open",
          });
          await engine.whenSamplesReady();
          const snapshots = [];
          for (let time = 0; time < seconds; time += step) {
            engine.setRenderTime(time);
            engine.update(driveTo(time, curve(time)));
            if (snapshotAt.some((t) => Math.abs(time - t) < step / 2)) {
              const diag = engine.getSymphonyDiagnostics(time);
              snapshots.push({
                time,
                ...curve(time),
                backend: engine.getActiveBackend(),
                movementState: diag?.movementState ?? null,
                packId: diag?.packId ?? null,
                activeStems: diag?.activeStems ?? [],
                energy: diag?.energy ?? null,
                techno: diag?.techno ?? null,
              });
            }
          }
          const rendered = await ctx.startRendering();
          const left = rendered.getChannelData(0);
          const right = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : left;
          return {
            backend: engine.getActiveBackend(),
            diag: engine.getSymphonyDiagnostics(0),
            snapshots,
            segment: wavB64(left, right, sampleRate, 0, seconds),
          };
        };

        const hold =
          (kmh, throttle, accel = 0) =>
          () => ({ kmh, throttle, accel });

        const buildupCurve = (t) => {
          if (t < 6) return { kmh: 0, throttle: 0, accel: 0 };
          if (t < 50) {
            const u = (t - 6) / 44;
            const kmh = 180 * u;
            const surge = (t >= 22 && t < 23.8) || (t >= 38 && t < 39.8);
            return {
              kmh,
              throttle: surge ? 0.92 : 0.2 + 0.5 * u,
              accel: surge ? 2.2 : 0.35,
            };
          }
          if (t < 56) return { kmh: 180, throttle: 0.75, accel: 0.15 };
          const u = (t - 56) / 16;
          return {
            kmh: 180 * (1 - u) + 15 * u,
            throttle: 0,
            accel: -1.6,
            regen: 0.5,
          };
        };

        const genre = resolveGenre("symphony-viral-mix", "classic");
        const signature = hasSignatureGenre("symphony-viral-mix");
        const makeupDb = makeupDbForProfile("symphony-viral-mix");

        const buildup = await render(
          buildSeconds,
          buildupCurve,
          [3, 9, 15, 22, 28, 36, 44, 52, 60, 68],
        );
        const idle = await render(holdSeconds, hold(0, 0), [4, 12]);
        const roll = await render(holdSeconds, hold(20, 0.2), [4, 12]);
        const build = await render(holdSeconds, hold(45, 0.3), [4, 12]);
        const cruise = await render(holdSeconds, hold(90, 0.4), [4, 12]);
        const highway = await render(holdSeconds, hold(160, 0.7, 0.2), [4, 12]);

        return {
          genre,
          signature,
          makeupDb,
          profileName: "Viral Mix",
          backendAtStart: buildup.backend,
          diagAtStart: buildup.diag,
          segments: {
            buildup: { ...buildup.segment, snapshots: buildup.snapshots },
            idle: { ...idle.segment, snapshots: idle.snapshots },
            roll: { ...roll.segment, snapshots: roll.snapshots },
            build: { ...build.segment, snapshots: build.snapshots },
            cruise: { ...cruise.segment, snapshots: cruise.snapshots },
            highway: { ...highway.segment, snapshots: highway.snapshots },
          },
        };
      },
      {
        sampleRate: SAMPLE_RATE,
        holdSeconds: HOLD_SECONDS,
        buildSeconds: BUILD_SECONDS,
        step: LAB_STEP,
        seed: SEED,
      },
    );

    await mkdir(OUTPUT_DIR, { recursive: true });
    const jobs = [
      [
        "viral-mix-drive-buildup.wav",
        result.segments.buildup,
        "0→180 km/h build-up with surges and slow-down",
      ],
      ["viral-mix-preview-idle-0.wav", result.segments.idle, "0 km/h stadium beat"],
      ["viral-mix-preview-roll-20.wav", result.segments.roll, "20 km/h accordion hook"],
      ["viral-mix-preview-build-45.wav", result.segments.build, "45 km/h chant + Q&A melody"],
      ["viral-mix-preview-cruise-90.wav", result.segments.cruise, "90 km/h bass + brass stabs"],
      [
        "viral-mix-preview-highway-160.wav",
        result.segments.highway,
        "160 km/h supersaw + Hey + full stadium",
      ],
    ];
    const metaSegments = [];
    for (const [name, seg, label] of jobs) {
      const out = path.join(OUTPUT_DIR, name);
      await writeFile(out, Buffer.from(seg.wavBase64, "base64"));
      metaSegments.push({
        file: out,
        label,
        durationSeconds: seg.frames / SAMPLE_RATE,
        peakDbfs: seg.peakDbfs,
        rmsDbfs: seg.rmsDbfs,
        frames: seg.frames,
        snapshots: seg.snapshots,
      });
      console.log(
        `${name}: peak ${seg.peakDbfs.toFixed(2)} dBFS  rms ${seg.rmsDbfs.toFixed(2)} dBFS  frames ${seg.frames}`,
      );
    }

    const metadata = {
      generatedAt: new Date().toISOString(),
      profileId: "symphony-viral-mix",
      profileName: result.profileName,
      usesRealEnginePath: true,
      enginePath:
        "Chrome OfflineAudioContext + production SoundEngine.start/update + SymphonySynth original stadium pack. Not a full-mix or AdaptiveMusicSynth render.",
      volume: 1,
      pickerForcedTo: "classic",
      resolvedGenreWithClassicPicker: result.genre,
      hasSignatureGenre: result.signature,
      backendAtStart: result.backendAtStart,
      diagAtStart: result.diagAtStart,
      makeupDb: result.makeupDb,
      sampleRate: SAMPLE_RATE,
      seed: SEED,
      listening: "not claimed — not verified by ear",
      copyright:
        "Original ELCAMOSO stadium-anthem production (120 BPM, C# minor). Synthesized stems + local Piper TTS chant. Not verified by ear.",
      segments: metaSegments,
    };
    const metaPath = path.join(OUTPUT_DIR, "viral-mix-preview-metadata.json");
    await writeFile(metaPath, `${JSON.stringify(metadata, null, 2)}\n`);
    console.log(`metadata: ${metaPath}`);
    console.log(
      `resolved genre (picker=classic): ${result.genre}; backend=${result.backendAtStart}; pack=${result.diagAtStart?.packId}; signature=${result.signature}`,
    );
  } finally {
    await browser?.close();
    await server.close();
  }
}

main().catch((err) => {
  console.error("Render failed:", err);
  process.exit(1);
});
