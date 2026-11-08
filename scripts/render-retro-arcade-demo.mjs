/**
 * Render Retro Arcade speed-responsive demo to WAV file.
 * Demonstrates the approved sound design with speed-based energy mapping.
 *
 * Scenario: Acceleration from 0 to 220 km/h over 45 seconds, then hold.
 *
 * Speed checkpoints:
 * - 0-5s: Idle (0 km/h) - bells + pads only
 * - 5-15s: Accelerate to 50 km/h - bass enters
 * - 15-25s: Accelerate to 120 km/h - plucks enter
 * - 25-35s: Accelerate to 180 km/h - kick enters
 * - 35-45s: Accelerate to 220 km/h - hihats enter
 * - 45-60s: Hold at 220 km/h - full intensity
 *
 * Usage:
 *   node scripts/render-retro-arcade-demo.mjs
 *
 * Output:
 *   artifacts/retro-arcade-demo/retro-arcade-speed-demo.wav
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const DURATION_SECONDS = 60;
const SAMPLE_RATE = 48000;
const OUTPUT_DIR = "artifacts/retro-arcade-demo";

function speedCurve(t) {
  if (t < 5) return 0;
  if (t < 15) return ((t - 5) / 10) * 50;
  if (t < 25) return 50 + ((t - 15) / 10) * 70;
  if (t < 35) return 120 + ((t - 25) / 10) * 60;
  if (t < 45) return 180 + ((t - 35) / 10) * 40;
  return 220;
}

async function main() {
  console.log("=== Retro Arcade Speed-Responsive Demo ===");
  console.log(`Duration: ${DURATION_SECONDS}s`);
  console.log("Speed progression:");
  console.log("  0-5s:   0 km/h (idle)");
  console.log("  5-15s:  0→50 km/h (bass enters)");
  console.log("  15-25s: 50→120 km/h (plucks enter)");
  console.log("  25-35s: 120→180 km/h (kick enters)");
  console.log("  35-45s: 180→220 km/h (hihats enter)");
  console.log("  45-60s: 220 km/h (full intensity)");

  const server = await createServer({ server: { host: "127.0.0.1", port: 0 } });
  let browser;

  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") {
      throw new Error("Vite did not expose a TCP port");
    }
    const origin = `http://127.0.0.1:${address.port}`;
    console.log(`\nVite server running at ${origin}`);

    browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage();
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    console.log("Browser page loaded");

    await mkdir(OUTPUT_DIR, { recursive: true });

    console.log("\nRendering audio with speed-responsive stems...");
    const result = await page.evaluate(
      async ({ duration, sampleRate }) => {
        const {
          generateRetroArcadeBellBuffer,
          generateRetroArcadePadBuffer,
          generateRetroArcadeBassBuffer,
          generateRetroArcadePluckBuffer,
          generateRetroArcadeKickBuffer,
          generateRetroArcadeHihatBuffer,
        } = await import("/src/lib/sound/retro-arcade/procedural-stems.ts");

        const speedCurve = (t) => {
          if (t < 5) return 0;
          if (t < 15) return ((t - 5) / 10) * 50;
          if (t < 25) return 50 + ((t - 15) / 10) * 70;
          if (t < 35) return 120 + ((t - 25) / 10) * 60;
          if (t < 45) return 180 + ((t - 35) / 10) * 40;
          return 220;
        };

        const BPM = 140;
        const BEATS_PER_BAR = 4;
        const BARS_PER_LOOP = 8;
        const MAX_SPEED_KMH = 220;
        const clock = { bpm: BPM, beatsPerBar: BEATS_PER_BAR, barsPerLoop: BARS_PER_LOOP };

        const ctx = new OfflineAudioContext(2, Math.ceil(sampleRate * duration), sampleRate);
        const seed = 0x52455452;

        console.log("Generating stem buffers...");
        const bellBuffer = generateRetroArcadeBellBuffer(ctx, clock, seed);
        const padBuffer = generateRetroArcadePadBuffer(ctx, clock, seed);
        const bassBuffer = generateRetroArcadeBassBuffer(ctx, clock, seed);
        const pluckBuffer = generateRetroArcadePluckBuffer(ctx, clock, seed);
        const kickBuffer = generateRetroArcadeKickBuffer(ctx, clock, seed);
        const hihatBuffer = generateRetroArcadeHihatBuffer(ctx, clock, seed);

        const master = ctx.createGain();
        master.gain.value = 0.65;
        master.connect(ctx.destination);

        const bellGain = ctx.createGain();
        const padGain = ctx.createGain();
        const bassGain = ctx.createGain();
        const pluckGain = ctx.createGain();
        const kickGain = ctx.createGain();
        const hihatGain = ctx.createGain();

        bellGain.connect(master);
        padGain.connect(master);
        bassGain.connect(master);
        pluckGain.connect(master);
        kickGain.connect(master);
        hihatGain.connect(master);

        const clamp01 = (v) => Math.max(0, Math.min(1, v));

        const energyToStemGains = (energy) => {
          const e = clamp01(energy);
          const bellsBase = 0.35;
          const bellsRange = 0.3;
          const bells = bellsBase + e * bellsRange;
          const padsBase = 0.55;
          const padsRange = -0.25;
          const pads = padsBase + e * padsRange;
          const bassThreshold = 0.15;
          const bass = e > bassThreshold ? clamp01((e - bassThreshold) / 0.4) * 0.55 : 0;
          const pluckThreshold = 0.35;
          const plucks = e > pluckThreshold ? clamp01((e - pluckThreshold) / 0.35) * 0.6 : 0;
          const kickThreshold = 0.55;
          const kick = e > kickThreshold ? clamp01((e - kickThreshold) / 0.3) * 0.5 : 0;
          const hihatThreshold = 0.7;
          const hihats = e > hihatThreshold ? clamp01((e - hihatThreshold) / 0.25) * 0.45 : 0;
          return { bells, pads, bass, plucks, kick, hihats };
        };

        const loopDuration = (60 / BPM) * BEATS_PER_BAR * BARS_PER_LOOP;
        const numLoops = Math.ceil(duration / loopDuration);

        for (let loopIdx = 0; loopIdx < numLoops; loopIdx++) {
          const startTime = loopIdx * loopDuration;
          if (startTime >= duration) break;

          const createSource = (buffer, gain) => {
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            src.connect(gain);
            src.start(startTime);
          };

          createSource(bellBuffer, bellGain);
          createSource(padBuffer, padGain);
          createSource(bassBuffer, bassGain);
          createSource(pluckBuffer, pluckGain);
          createSource(kickBuffer, kickGain);
          createSource(hihatBuffer, hihatGain);
        }

        const STEP_SECONDS = 0.1;
        let currentEnergy = 0;
        const energyLog = [];

        for (let t = 0; t < duration; t += STEP_SECONDS) {
          const speedKmh = speedCurve(t);
          const targetEnergy = clamp01(speedKmh / MAX_SPEED_KMH);
          const tau = 0.5;
          const alpha = 1 - Math.exp(-STEP_SECONDS / tau);
          currentEnergy = currentEnergy + (targetEnergy - currentEnergy) * alpha;

          const gains = energyToStemGains(currentEnergy);
          const smoothTime = 0.08;

          bellGain.gain.setTargetAtTime(gains.bells, t, smoothTime);
          padGain.gain.setTargetAtTime(gains.pads, t, smoothTime);
          bassGain.gain.setTargetAtTime(gains.bass, t, smoothTime);
          pluckGain.gain.setTargetAtTime(gains.plucks, t, smoothTime);
          kickGain.gain.setTargetAtTime(gains.kick, t, smoothTime);
          hihatGain.gain.setTargetAtTime(gains.hihats, t, smoothTime);

          if (t % 5 < STEP_SECONDS) {
            energyLog.push({
              time: Math.round(t),
              speedKmh: Math.round(speedKmh),
              energy: currentEnergy.toFixed(2),
              bells: gains.bells.toFixed(2),
              bass: gains.bass.toFixed(2),
              plucks: gains.plucks.toFixed(2),
              kick: gains.kick.toFixed(2),
              hihats: gains.hihats.toFixed(2),
            });
          }
        }

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
            profileId: "retro-arcade",
            profileName: "Retro Arcade (Speed-Responsive)",
            durationSeconds: duration,
            sampleRate,
            frameCount,
            bpm: BPM,
            key: "F minor",
            maxSpeedKmh: MAX_SPEED_KMH,
            peakL: 20 * Math.log10(peakL || 1e-10),
            peakR: 20 * Math.log10(peakR || 1e-10),
            rmsDb: 10 * Math.log10(rmsSum / frameCount || 1e-10),
            generatedAt: new Date().toISOString(),
            harness: "render-retro-arcade-demo.mjs",
            stems: ["bells", "pads", "bass", "plucks", "kick", "hihats"],
            speedProgression: [
              { time: "0-5s", speed: "0 km/h", stems: "bells + pads" },
              { time: "5-15s", speed: "0→50 km/h", stems: "+ bass" },
              { time: "15-25s", speed: "50→120 km/h", stems: "+ plucks" },
              { time: "25-35s", speed: "120→180 km/h", stems: "+ kick" },
              { time: "35-45s", speed: "180→220 km/h", stems: "+ hihats" },
              { time: "45-60s", speed: "220 km/h", stems: "all at max" },
            ],
            energyLog,
          },
        };
      },
      {
        duration: DURATION_SECONDS,
        sampleRate: SAMPLE_RATE,
      }
    );

    const wav = Buffer.from(result.wavBase64, "base64");
    const wavPath = path.join(OUTPUT_DIR, "retro-arcade-speed-demo.wav");
    const metaPath = path.join(OUTPUT_DIR, "metadata.json");

    await writeFile(wavPath, wav);
    await writeFile(metaPath, JSON.stringify(result.metadata, null, 2) + "\n");

    console.log("\n=== Render Complete ===");
    console.log(`WAV file: ${wavPath}`);
    console.log(`Metadata: ${metaPath}`);
    console.log(`Duration: ${result.metadata.durationSeconds}s @ ${result.metadata.bpm} BPM`);
    console.log(`Key: ${result.metadata.key}`);
    console.log(`Max Speed: ${result.metadata.maxSpeedKmh} km/h`);
    console.log(`Peak L: ${result.metadata.peakL.toFixed(1)} dBFS`);
    console.log(`Peak R: ${result.metadata.peakR.toFixed(1)} dBFS`);
    console.log(`RMS: ${result.metadata.rmsDb.toFixed(1)} dBFS`);

    console.log("\n=== Speed-Response Map ===");
    console.log("| Time | Speed | Energy | Bells | Bass | Plucks | Kick | Hihats |");
    console.log("|------|-------|--------|-------|------|--------|------|--------|");
    for (const log of result.metadata.energyLog) {
      console.log(
        `| ${log.time.toString().padStart(4)}s | ${log.speedKmh.toString().padStart(3)} km/h | ${log.energy} | ${log.bells} | ${log.bass} | ${log.plucks} | ${log.kick} | ${log.hihats} |`
      );
    }

  } finally {
    await browser?.close();
    await server.close();
  }
}

main().catch((err) => {
  console.error("Render failed:", err);
  process.exit(1);
});
