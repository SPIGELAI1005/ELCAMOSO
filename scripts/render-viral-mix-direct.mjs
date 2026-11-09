/**
 * Directly render the Viral Mix procedural synthesis to a WAV file.
 * This bypasses the full SoundEngine and directly generates the procedural stems.
 *
 * Usage:
 *   node scripts/render-viral-mix-direct.mjs
 *
 * Output:
 *   artifacts/viral-mix-demo/viral-mix-direct.wav
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const DURATION_SECONDS = 30;
const SAMPLE_RATE = 48000;
const OUTPUT_DIR = "artifacts/viral-mix-demo";

async function main() {
  console.log("Starting direct Viral Mix render...");
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

    console.log("Generating procedural stems and mixing...");
    const result = await page.evaluate(
      async ({ duration, sampleRate }) => {
        const {
          generateViralMixBellBuffer,
          generateViralMixPadBuffer,
          generateViralMixBassBuffer,
          generateViralMixPluckBuffer,
          generateViralMixKickBuffer,
          generateViralMixHihatBuffer,
          generateViralMixRiserBuffer,
        } = await import("/src/lib/symphony/packs/viral-mix-procedural.ts");

        const BPM = 140;
        const BEATS_PER_BAR = 4;
        const BARS_PER_LOOP = 8;
        const clock = { bpm: BPM, beatsPerBar: BEATS_PER_BAR, barsPerLoop: BARS_PER_LOOP };
        const loopDuration = (60 / BPM) * BEATS_PER_BAR * BARS_PER_LOOP;
        const loopSamples = Math.ceil(loopDuration * sampleRate);

        const ctx = new OfflineAudioContext(2, Math.ceil(sampleRate * duration), sampleRate);
        const seed = 0x56495241;

        console.log("Generating stem buffers...");
        const bellBuffer = generateViralMixBellBuffer(ctx, clock, seed);
        const padBuffer = generateViralMixPadBuffer(ctx, clock, seed);
        const bassBuffer = generateViralMixBassBuffer(ctx, clock, seed);
        const pluckBuffer = generateViralMixPluckBuffer(ctx, clock, seed);
        const kickBuffer = generateViralMixKickBuffer(ctx, clock, seed);
        const hihatBuffer = generateViralMixHihatBuffer(ctx, clock, seed);
        const riserBuffer = generateViralMixRiserBuffer(ctx, clock, seed);

        console.log("Creating mixer nodes...");
        const master = ctx.createGain();
        master.gain.value = 0.7;
        master.connect(ctx.destination);

        const bellGain = ctx.createGain();
        const padGain = ctx.createGain();
        const bassGain = ctx.createGain();
        const pluckGain = ctx.createGain();
        const kickGain = ctx.createGain();
        const hihatGain = ctx.createGain();
        const riserGain = ctx.createGain();

        bellGain.connect(master);
        padGain.connect(master);
        bassGain.connect(master);
        pluckGain.connect(master);
        kickGain.connect(master);
        hihatGain.connect(master);
        riserGain.connect(master);

        const numLoops = Math.ceil(duration / loopDuration);
        const scheduledSources = [];

        for (let loopIdx = 0; loopIdx < numLoops; loopIdx++) {
          const startTime = loopIdx * loopDuration;
          const intensity = Math.min(1, startTime / 20);
          
          bellGain.gain.setValueAtTime(0.35 + intensity * 0.25, startTime);
          padGain.gain.setValueAtTime(0.5 - intensity * 0.15, startTime);
          bassGain.gain.setValueAtTime(0.1 + intensity * 0.45, startTime);
          pluckGain.gain.setValueAtTime(intensity > 0.3 ? 0.3 + (intensity - 0.3) * 0.4 : 0, startTime);
          kickGain.gain.setValueAtTime(intensity > 0.6 ? 0.35 + (intensity - 0.6) * 0.5 : 0, startTime);
          hihatGain.gain.setValueAtTime(intensity > 0.7 ? 0.25 + (intensity - 0.7) * 0.5 : 0, startTime);
          riserGain.gain.setValueAtTime(intensity > 0.85 ? 0.15 : 0, startTime);

          const createSource = (buffer, gainNode) => {
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            src.connect(gainNode);
            src.start(startTime);
            scheduledSources.push(src);
          };

          createSource(bellBuffer, bellGain);
          createSource(padBuffer, padGain);
          createSource(bassBuffer, bassGain);
          createSource(pluckBuffer, pluckGain);
          createSource(kickBuffer, kickGain);
          createSource(hihatBuffer, hihatGain);
          createSource(riserBuffer, riserGain);
        }

        console.log(`Scheduled ${scheduledSources.length} sources across ${numLoops} loops`);
        console.log("Rendering audio...");
        const rendered = await ctx.startRendering();
        console.log(`Rendered ${rendered.length} frames`);

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
            profileId: "symphony-viral-mix",
            profileName: "Viral Mix (Direct Procedural)",
            durationSeconds: duration,
            sampleRate,
            frameCount,
            bpm: BPM,
            key: "F minor",
            loopsRendered: numLoops,
            peakL: 20 * Math.log10(peakL || 1e-10),
            peakR: 20 * Math.log10(peakR || 1e-10),
            rmsDb: 10 * Math.log10(rmsSum / frameCount || 1e-10),
            generatedAt: new Date().toISOString(),
            harness: "render-viral-mix-direct.mjs",
            stems: ["bells", "pads", "bass", "plucks", "kick", "hihats", "riser"],
            note: "Procedural FM synthesis - demonstrates ARRANGEMENT matching the reference video structure (glassy bells, ethereal pads, bouncing plucks, sparse drums at climax). Timbre is synthesized, not sampled.",
          },
        };
      },
      { duration: DURATION_SECONDS, sampleRate: SAMPLE_RATE }
    );

    const wav = Buffer.from(result.wavBase64, "base64");
    const wavPath = path.join(OUTPUT_DIR, "viral-mix-direct.wav");
    const metaPath = path.join(OUTPUT_DIR, "metadata-direct.json");

    await writeFile(wavPath, wav);
    await writeFile(metaPath, JSON.stringify(result.metadata, null, 2) + "\n");

    console.log("\n=== Render Complete ===");
    console.log(`WAV file: ${wavPath}`);
    console.log(`Metadata: ${metaPath}`);
    console.log(`Duration: ${result.metadata.durationSeconds}s @ ${result.metadata.bpm} BPM`);
    console.log(`Key: ${result.metadata.key}`);
    console.log(`Loops: ${result.metadata.loopsRendered}`);
    console.log(`Peak L: ${result.metadata.peakL.toFixed(1)} dBFS`);
    console.log(`Peak R: ${result.metadata.peakR.toFixed(1)} dBFS`);
    console.log(`RMS: ${result.metadata.rmsDb.toFixed(1)} dBFS`);
    console.log(`\nStems: ${result.metadata.stems.join(", ")}`);
    console.log("\nNote: This is procedural FM synthesis demonstrating arrangement structure.");

  } finally {
    await browser?.close();
    await server.close();
  }
}

main().catch((err) => {
  console.error("Render failed:", err);
  process.exit(1);
});
