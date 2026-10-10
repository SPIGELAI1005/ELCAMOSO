import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer } from "vite";

const allProfiles = [
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
const allVariants = ["existing", "tuned"];
// Narrow a calibration pass: AUDIO_COMPARE_PROFILES=gt-v8,big-twin AUDIO_COMPARE_VARIANTS=tuned
const envList = (name) =>
  (process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
const requestedProfiles = envList("AUDIO_COMPARE_PROFILES");
const requestedVariants = envList("AUDIO_COMPARE_VARIANTS");
const profiles = requestedProfiles.length
  ? allProfiles.filter((id) => requestedProfiles.includes(id))
  : allProfiles;
const variants = requestedVariants.length
  ? allVariants.filter((id) => requestedVariants.includes(id))
  : allVariants;
const isPartialPass =
  profiles.length < allProfiles.length || variants.length < allVariants.length;
// Override with AUDIO_COMPARE_OUT=artifacts/audio-comparisons/<date> for a fresh pass.
const outputDir = path.resolve(
  process.env.AUDIO_COMPARE_OUT ?? "artifacts/audio-comparisons/2026-09-26",
);
const targetLufs = -20;

function resultKey(row) {
  return `${row.profileId}::${row.variant}`;
}

/** Partial passes merge into an existing analysis.json so calibration does not wipe siblings. */
async function loadPriorResults() {
  if (!isPartialPass) return [];
  try {
    const prior = JSON.parse(await readFile(path.join(outputDir, "analysis.json"), "utf8"));
    return Array.isArray(prior.results) ? prior.results : [];
  } catch {
    return [];
  }
}

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

  const priorResults = await loadPriorResults();
  const resultsByKey = new Map(priorResults.map((row) => [resultKey(row), row]));
  if (isPartialPass && priorResults.length) {
    process.stdout.write(
      `Merging ${profiles.length}×${variants.length} renders into ${priorResults.length} prior results\n`,
    );
  }
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
      resultsByKey.set(resultKey(result), {
        ...result,
        matchedGainDb: round(matchedGainDb),
        matchedApproximateLufs: round(result.stats.approximateIntegratedLufs + matchedGainDb),
        matchedPeakDbfs: round(result.stats.peakDbfs + matchedGainDb),
      });
      process.stdout.write(`${stem}: ${result.backend}, ${round(result.renderElapsedMs)} ms\n`);
    }
  }
  // Keep catalog order for full passes; preserve prior order then append unknowns for merges.
  const catalogOrder = allProfiles.flatMap((profileId) =>
    allVariants.map((variant) => resultKey({ profileId, variant })),
  );
  const results = [
    ...catalogOrder.map((key) => resultsByKey.get(key)).filter(Boolean),
    ...[...resultsByKey.entries()]
      .filter(([key]) => !catalogOrder.includes(key))
      .map(([, row]) => row),
  ];

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
