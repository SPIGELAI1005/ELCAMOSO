/**
 * Render the Viral Mix profile to a WAV file using headless Chrome + production SoundEngine.
 * This bypasses entitlement gates by directly rendering the audio through the same
 * code paths used in the app, without any auth/account/billing involvement.
 *
 * Usage:
 *   node scripts/render-viral-mix-demo.mjs
 *
 * Output:
 *   artifacts/viral-mix-demo/viral-mix-demo.wav
 *   artifacts/viral-mix-demo/metadata.json
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const PROFILE_ID = "symphony-viral-mix";
const DURATION_SECONDS = 30;
const SAMPLE_RATE = 48000;
const OUTPUT_DIR = "artifacts/viral-mix-demo";

async function main() {
  console.log("Starting Viral Mix demo render...");
  console.log(`Profile: ${PROFILE_ID}`);
  console.log(`Duration: ${DURATION_SECONDS}s`);

  const server = await createServer({ server: { host: "127.0.0.1", port: 0 } });
  let browser;

  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") {
      throw new Error("Vite did not expose a TCP port");
    }
    const origin = `http://127.0.0.1:${address.port}`;
    console.log(`Vite server running at ${origin}`);

    browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage();
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    console.log("Browser page loaded");

    await mkdir(OUTPUT_DIR, { recursive: true });

    console.log("Rendering audio...");
    const result = await page.evaluate(
      async ({ profileId, duration, sampleRate }) => {
        const { SoundEngine } = await import("/src/lib/sound/engine.ts");
        const { getProfile } = await import("/src/lib/sound/profiles.ts");

        const profile = getProfile(profileId);
        if (!profile) {
          throw new Error(`Profile not found: ${profileId}`);
        }

        const context = new OfflineAudioContext(2, Math.ceil(sampleRate * duration), sampleRate);
        const engine = new SoundEngine();

        engine.setVolume(0.75);
        engine.setSynthesisMode("improved");
        engine.setExperienceTuningEnabled(true);

        await engine.start(profile, {
          context,
          signature: false,
          seed: 0x56495241, // "VIRA"
          environmentId: "open",
        });

        const stepSeconds = 1 / 60;
        for (let t = 0; t < duration; t += stepSeconds) {
          engine.setRenderTime(t);
          const intensity = Math.min(1, t / 15);
          const speedKmh = 30 + intensity * 70;
          engine.update({
            speed: speedKmh / 3.6,
            acceleration: intensity * 1.5,
            throttle: 0.2 + intensity * 0.5,
            regen: 0,
            rpm: 1500 + intensity * 3500,
            gear: Math.min(5, 1 + Math.floor(intensity * 4)),
            load: 0.3 + intensity * 0.5,
            timestamp: Math.round(t * 1000),
            jerk: 0,
            isShifting: false,
            powertrainBackend: "dynamic",
            speedNormalized: Math.min(1, speedKmh / 160),
            accelerationNormalized: intensity,
          });
        }

        console.log("Starting audio render...");
        const rendered = await context.startRendering();
        console.log("Audio rendered, encoding WAV...");

        const left = rendered.getChannelData(0);
        const right = rendered.getChannelData(1);
        const frameCount = left.length;
        const bytes = new Uint8Array(44 + frameCount * 4);
        const view = new DataView(bytes.buffer);

        const text = (offset, value) => {
          for (let i = 0; i < value.length; i++) {
            view.setUint8(offset + i, value.charCodeAt(i));
          }
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
        view.setUint32(40, frameCount * 4, true);

        let offset = 44;
        for (let i = 0; i < frameCount; i++) {
          const l = Math.max(-1, Math.min(1, left[i] ?? 0));
          const r = Math.max(-1, Math.min(1, right[i] ?? 0));
          view.setInt16(offset, l < 0 ? l * 32768 : l * 32767, true);
          view.setInt16(offset + 2, r < 0 ? r * 32768 : r * 32767, true);
          offset += 4;
        }

        let binary = "";
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + chunk)));
        }

        let peakL = 0, peakR = 0, rmsSum = 0;
        for (let i = 0; i < frameCount; i++) {
          peakL = Math.max(peakL, Math.abs(left[i] ?? 0));
          peakR = Math.max(peakR, Math.abs(right[i] ?? 0));
          const mono = ((left[i] ?? 0) + (right[i] ?? 0)) / 2;
          rmsSum += mono * mono;
        }

        return {
          wavBase64: btoa(binary),
          metadata: {
            profileId,
            profileName: profile.name,
            durationSeconds: duration,
            sampleRate,
            frameCount,
            peakL: 20 * Math.log10(peakL || 1e-10),
            peakR: 20 * Math.log10(peakR || 1e-10),
            rmsDb: 10 * Math.log10(rmsSum / frameCount || 1e-10),
            generatedAt: new Date().toISOString(),
            harness: "render-viral-mix-demo.mjs",
            note: "Procedural FM synthesis - demonstrates ARRANGEMENT structure, not production timbre quality",
          },
        };
      },
      { profileId: PROFILE_ID, duration: DURATION_SECONDS, sampleRate: SAMPLE_RATE }
    );

    const wav = Buffer.from(result.wavBase64, "base64");
    const wavPath = path.join(OUTPUT_DIR, "viral-mix-demo.wav");
    const metaPath = path.join(OUTPUT_DIR, "metadata.json");

    await writeFile(wavPath, wav);
    await writeFile(metaPath, JSON.stringify(result.metadata, null, 2) + "\n");

    console.log("\n=== Render Complete ===");
    console.log(`WAV file: ${wavPath}`);
    console.log(`Metadata: ${metaPath}`);
    console.log(`Duration: ${result.metadata.durationSeconds}s`);
    console.log(`Peak L: ${result.metadata.peakL.toFixed(1)} dBFS`);
    console.log(`Peak R: ${result.metadata.peakR.toFixed(1)} dBFS`);
    console.log(`RMS: ${result.metadata.rmsDb.toFixed(1)} dBFS`);
    console.log("\nNote: This is procedural synthesis demonstrating arrangement structure.");

  } finally {
    await browser?.close();
    await server.close();
  }
}

main().catch((err) => {
  console.error("Render failed:", err);
  process.exit(1);
});
