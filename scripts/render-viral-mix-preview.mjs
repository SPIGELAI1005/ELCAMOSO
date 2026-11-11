/**
 * Render Viral Mix (~30 s at a few speeds) through the production SoundEngine
 * + AdaptiveMusicSynth path (the same path Drive uses for symphony profiles).
 *
 * Usage:
 *   node scripts/render-viral-mix-preview.mjs
 *
 * Output (default /workspace/viral-ref/):
 *   viral-mix-preview-idle-0.wav
 *   viral-mix-preview-cruise-90.wav
 *   viral-mix-preview-highway-180.wav
 *   viral-mix-preview-metadata.json
 *
 * The global genre picker is forced to "classic" first, to show the signature bind
 * still plays viralmix. Listening is not claimed.
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer as createNetServer } from "node:net";
import { createServer } from "vite";

const SAMPLE_RATE = 48_000;
const SEGMENT_SECONDS = 30;
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
      async ({ sampleRate, segmentSeconds, step, seed }) => {
        localStorage.setItem("elcamoso.music.genre", "classic");

        const { SoundEngine } = await import("/src/lib/sound/engine.ts");
        const { getProfile } = await import("/src/lib/sound/profiles.ts");
        const { resolveGenre, hasSignatureGenre } =
          await import("/src/lib/symphony/adaptive/genre-store.ts");
        const { preloadMusicBank, isMusicBankReady } =
          await import("/src/lib/symphony/adaptive/adaptive-synth.ts");

        const total = segmentSeconds * 3;
        const ctx = new OfflineAudioContext(2, Math.ceil(sampleRate * total), sampleRate);
        const engine = new SoundEngine();
        engine.setVolume(0.7);
        engine.setExperienceTuningEnabled(true);
        const profile = getProfile("symphony-viral-mix");
        await engine.start(profile, {
          context: ctx,
          signature: false,
          seed,
          environmentId: "open",
        });
        await preloadMusicBank(ctx);
        const bankReady = isMusicBankReady();
        const genre = resolveGenre("symphony-viral-mix", "classic");
        const signature = hasSignatureGenre("symphony-viral-mix");

        const curve = (t) => {
          if (t < segmentSeconds) return { kmh: 0, throttle: 0, accel: 0 };
          if (t < segmentSeconds * 2) return { kmh: 90, throttle: 0.4, accel: 0 };
          return { kmh: 180, throttle: 0.75, accel: 0.2 };
        };

        for (let time = 0; time < total; time += step) {
          engine.setRenderTime(time);
          const { kmh, throttle, accel } = curve(time);
          const speed = kmh / 3.6;
          engine.update({
            speed,
            acceleration: accel,
            throttle,
            regen: 0,
            rpm: 0,
            gear: 0,
            load: throttle,
            timestamp: Math.round(time * 1000),
            jerk: 0,
            isShifting: false,
            powertrainBackend: "legacy",
            speedNormalized: Math.min(1, kmh / 160),
            accelerationNormalized: Math.min(1, Math.abs(accel) / 4.5),
          });
        }

        const rendered = await ctx.startRendering();
        const left = rendered.getChannelData(0);
        const right = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : left;

        const wavB64 = (startSec) => {
          const a = Math.floor(startSec * sampleRate);
          const b = Math.min(left.length, a + Math.floor(segmentSeconds * sampleRate));
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

        return {
          bankReady,
          genre,
          signature,
          profileName: profile.name,
          sampleRate: rendered.sampleRate,
          frames: left.length,
          segments: {
            idle: wavB64(0),
            cruise: wavB64(segmentSeconds),
            highway: wavB64(segmentSeconds * 2),
          },
        };
      },
      { sampleRate: SAMPLE_RATE, segmentSeconds: SEGMENT_SECONDS, step: LAB_STEP, seed: SEED },
    );

    await mkdir(OUTPUT_DIR, { recursive: true });
    const jobs = [
      ["viral-mix-preview-idle-0.wav", result.segments.idle, "0 km/h idle / stopped layers"],
      ["viral-mix-preview-cruise-90.wav", result.segments.cruise, "90 km/h cruise"],
      [
        "viral-mix-preview-highway-180.wav",
        result.segments.highway,
        "180 km/h highway / open hats and lead",
      ],
    ];
    const metaSegments = [];
    for (const [name, seg, label] of jobs) {
      const out = path.join(OUTPUT_DIR, name);
      await writeFile(out, Buffer.from(seg.wavBase64, "base64"));
      metaSegments.push({
        file: out,
        label,
        durationSeconds: seg.frames / result.sampleRate,
        peakDbfs: seg.peakDbfs,
        rmsDbfs: seg.rmsDbfs,
        frames: seg.frames,
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
        "Chrome OfflineAudioContext + production SoundEngine.start/update + AdaptiveMusicSynth (isSymphonyProfileId early return). Music bank preloaded via preloadMusicBank. Not a standalone oscillator demo.",
      pickerForcedTo: "classic",
      resolvedGenreWithClassicPicker: result.genre,
      hasSignatureGenre: result.signature,
      musicBankReady: result.bankReady,
      sampleRate: result.sampleRate,
      segmentSeconds: SEGMENT_SECONDS,
      seed: SEED,
      listening: "not claimed — not verified by ear",
      copyright:
        "Original procedural arrangement. Reference recording and its samples/vocals were not shipped.",
      segments: metaSegments,
    };
    const metaPath = path.join(OUTPUT_DIR, "viral-mix-preview-metadata.json");
    await writeFile(metaPath, `${JSON.stringify(metadata, null, 2)}\n`);
    console.log(`metadata: ${metaPath}`);
    console.log(
      `resolved genre (picker=classic): ${result.genre}; bankReady=${result.bankReady}; signature=${result.signature}`,
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
