import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer } from "vite";

const profiles = [
  "american-muscle-v8",
  "gt-v8",
  "flat-six-sport",
  "turbo-inline-6",
  "racing-v10",
  "electric-hypercar",
  "race-car",
  "rally-car",
  "motorcycle-superbike",
  "big-twin",
  "wiesn-tractor",
];
const variants = ["existing", "tuned"];
const outputDir = path.resolve("artifacts/audio-comparisons/2026-09-26");
const targetLufs = -20;

function applyGainToPcm16(wav, gainDb) {
  const output = Buffer.from(wav);
  const gain = 10 ** (gainDb / 20);
  for (let offset = 44; offset + 1 < output.length; offset += 2) {
    const sample = output.readInt16LE(offset);
    output.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sample * gain))), offset);
  }
  return output;
}

function round(value, places = 2) {
  return Number(value.toFixed(places));
}

const server = await createServer({ server: { host: "127.0.0.1", port: 0 } });
let browser;
try {
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("Vite did not expose a TCP port");
  const origin = `http://127.0.0.1:${address.port}`;
  // Use the installed Chrome channel so the validation does not depend on a
  // separately downloaded Playwright browser binary.
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await mkdir(outputDir, { recursive: true });

  const results = [];
  for (const profileId of profiles) {
    for (const variant of variants) {
      const result = await page.evaluate(
        async ({ profileId: id, variant: mode }) => {
          const module = await import("/src/lib/sound/validation/offline-comparison.ts");
          return module.renderOfflineComparison(id, mode);
        },
        { profileId, variant },
      );
      const wav = Buffer.from(result.wavBase64, "base64");
      delete result.wavBase64;
      const headroomGainDb = -1 - result.stats.peakDbfs;
      const loudnessGainDb = targetLufs - result.stats.approximateIntegratedLufs;
      const matchedGainDb = Math.min(headroomGainDb, loudnessGainDb);
      const stem = `${profileId}-${variant}`;
      await writeFile(path.join(outputDir, `${stem}-untouched.wav`), wav);
      await writeFile(
        path.join(outputDir, `${stem}-loudness-matched.wav`),
        applyGainToPcm16(wav, matchedGainDb),
      );
      results.push({
        ...result,
        matchedGainDb: round(matchedGainDb),
        matchedApproximateLufs: round(result.stats.approximateIntegratedLufs + matchedGainDb),
        matchedPeakDbfs: round(result.stats.peakDbfs + matchedGainDb),
      });
      process.stdout.write(`${stem}: ${result.backend}, ${round(result.renderElapsedMs)} ms\n`);
    }
  }

  const heap = await page.evaluate(() => {
    const memory = performance.memory;
    return memory
      ? {
          usedJsHeapBytes: memory.usedJSHeapSize,
          totalJsHeapBytes: memory.totalJSHeapSize,
          jsHeapLimitBytes: memory.jsHeapSizeLimit,
        }
      : null;
  });
  const report = {
    generatedAt: new Date().toISOString(),
    renderer: {
      browser: await browser.version(),
      offlineContext: "Chromium OfflineAudioContext at 48 kHz, stereo, 16.5 seconds",
      replay: "manual deterministic speed/throttle/brake inputs feeding production PowertrainSimulator",
      loudnessMatching:
        "Approximate BS.1770 K-weighted gated integration; target -20 LUFS, sample-peak capped at -1 dBFS. Not a certified LUFS or true-peak meter.",
    },
    hardware: {
      platform: `${os.platform()} ${os.release()} ${os.arch()}`,
      cpu: os.cpus()[0]?.model ?? "unknown",
      logicalCpuCount: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
      browserHeapAfterRenders: heap,
    },
    segments: [
      { label: "start / idle", start: 0, end: 1 },
      { label: "gentle pull-away", start: 1, end: 3 },
      { label: "sustained acceleration / shifts", start: 3, end: 5 },
      { label: "steady cruise", start: 5, end: 7 },
      { label: "lift-off / overrun", start: 7, end: 8 },
      { label: "braking / regen", start: 8, end: 9 },
      { label: "renewed acceleration / shifts", start: 9, end: 11 },
      { label: "cruise", start: 11, end: 12.5 },
      { label: "return to stop", start: 12.5, end: 16 },
      { label: "stopped", start: 16, end: 16.5 },
    ],
    results,
  };
  await writeFile(path.join(outputDir, "analysis.json"), `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser?.close();
  await server.close();
}
