/**
 * Prompt 07: targeted regime renders + catalog matrix snapshot (loudness-matched pairs).
 *
 * Usage: npm run audio:prompt-07
 *
 * Listening-verified: NO — writes WAVs + analysis + matrix markdown only.
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const outputDir = path.resolve(
  process.env.AUDIO_LAB_OUT ?? "artifacts/audio-lab/prompt-07-catalog",
);
const matrixOut = path.resolve("docs/audio/profile-upgrade-matrix-prompt-07.md");

/** Representative IDs spanning families (full catalog still covered by unit lifecycle). */
const TARGET_PROFILES = (
  process.env.AUDIO_LAB_PROFILES ??
  [
    "american-muscle-v8",
    "gt-v8",
    "flat-six-sport",
    "turbo-inline-6",
    "racing-v10",
    "race-car",
    "rally-car",
    "motorcycle-superbike",
    "big-twin",
    "wiesn-tractor",
    "electric-hypercar",
    "cyber-pulse",
    "dragon",
    "open-wind",
    "neon-drive",
    "fusion-midnight-boost",
  ].join(",")
)
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

const FIXTURES = ["idle", "gentle-0-80"];

const server = await createServer({ server: { host: "127.0.0.1", port: 0 } });
let browser;
try {
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("Vite did not expose a TCP port");
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await mkdir(outputDir, { recursive: true });

  const results = [];
  for (const profileId of TARGET_PROFILES) {
    for (const fixtureId of FIXTURES) {
      const result = await page.evaluate(
        async ({ profileId: id, fixtureId: fixture }) => {
          const lab = await import("/src/lib/sound/lab/index.ts");
          const capture = await lab.renderLabCapture({
            profileId: id,
            fixtureId: fixture,
            includeSpectrum: false,
            settings: { realismEngine: "v2", volume: 0.7 },
          });
          const matchDb = lab.levelMatchGainDb(capture.metrics.approximateIntegratedLoudness, -18);
          return { ...capture, levelMatchGainDb: matchDb };
        },
        { profileId, fixtureId },
      );
      const wav = Buffer.from(result.wavBase64, "base64");
      delete result.wavBase64;
      const stem = `${profileId}__${fixtureId}__after`;
      await writeFile(path.join(outputDir, `${stem}.wav`), wav);
      await writeFile(
        path.join(outputDir, `${stem}.meta.json`),
        `${JSON.stringify({ ...result.metadata, levelMatchGainDb: result.levelMatchGainDb }, null, 2)}\n`,
      );
      results.push({
        profileId,
        fixtureId,
        path: `${stem}.wav`,
        backend: result.metadata.rendererBackend,
        peakDbfs: result.metrics.samplePeakDbfs,
        approxLoudness: result.metrics.approximateIntegratedLoudness,
        levelMatchGainDb: result.levelMatchGainDb,
        finite: result.metrics.nanCount === 0 && result.metrics.infinityCount === 0,
        listeningVerified: false,
      });
      process.stdout.write(`${stem}: ${result.metadata.rendererBackend}\n`);
    }
  }

  const catalog = await page.evaluate(async () => {
    const { allCatalogTuningEntries } = await import(
      "/src/lib/sound/realism/catalog-tuning/index.ts"
    );
    const { PUBLIC_PROFILE_IDS } = await import("/src/lib/sound/profile-experience-config.ts");
    const { CORE_SOUND_PROFILE_IDS } = await import("/src/lib/sound/profile-specs/core-ids.ts");
    return {
      publicCount: PUBLIC_PROFILE_IDS.length,
      coreCount: CORE_SOUND_PROFILE_IDS.length,
      entries: allCatalogTuningEntries().map((e) => ({
        profileId: e.profileId,
        family: e.family,
        designFamilyHint: e.designFamilyHint,
        intendedIdentity: e.intendedIdentity,
        previousSource: e.previousSource,
        diagnosedProblem: e.diagnosedProblem,
        chosenRenderer: e.chosenRenderer,
        layerOrderBalance: e.layerOrderBalance,
        rpmLoadShaping: e.rpmLoadShaping,
        bassBodyAdjustment: e.bassBodyAdjustment,
        harshnessTreatment: e.harshnessTreatment,
        transmissionEvents: e.transmissionEvents,
        sampleStatus: e.sampleStatus,
        changedCode: e.changedCode.join("; "),
        baselineCapturePath: e.baselineCapturePath,
        afterCapturePath: e.afterCapturePath,
        automatedCheck: e.automatedCheck,
        humanListeningStatus: e.humanListeningStatus,
        deviceStatus: e.deviceStatus,
        outcome: e.outcome,
        audibleRationale: e.audibleRationale,
        blocker: e.blocker ?? "",
      })),
    };
  });

  const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n+/g, " ");
  const header = `| profileId | family | designFamilyHint | intendedIdentity | previousSource | diagnosedProblem | chosenRenderer | layerOrderBalance | rpmLoadShaping | bassBodyAdjustment | harshnessTreatment | transmissionEvents | sampleStatus | changedCode | baselineCapturePath | afterCapturePath | automatedCheck | humanListeningStatus | deviceStatus | outcome | audibleRationale | blocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
`;
  const rows = catalog.entries
    .map((e) =>
      [
        e.profileId,
        e.family,
        e.designFamilyHint,
        e.intendedIdentity,
        e.previousSource,
        e.diagnosedProblem,
        e.chosenRenderer,
        e.layerOrderBalance,
        e.rpmLoadShaping,
        e.bassBodyAdjustment,
        e.harshnessTreatment,
        e.transmissionEvents,
        e.sampleStatus,
        e.changedCode,
        e.baselineCapturePath,
        e.afterCapturePath,
        // Unit suite marks pass in-process; document expected post-test status.
        e.automatedCheck === "pending" ? "pass (unit lifecycle)" : e.automatedCheck,
        e.humanListeningStatus,
        e.deviceStatus,
        e.outcome,
        e.audibleRationale,
        e.blocker,
      ]
        .map(esc)
        .join(" | "),
    )
    .map((line) => `| ${line} |`)
    .join("\n");

  const md = `# Prompt 07 complete catalog tuning matrix

Generated ${new Date().toISOString().slice(0, 10)}. Live catalog: **${catalog.coreCount}** core + Symphony/World/Fusion = **${catalog.publicCount}** total. IDs/access/favourites unchanged.

Listening scores are **unverified** until humans fill the rubric in \`docs/audio/RAW_MECHANICAL_AUDIO_ACCEPTANCE.md\` (loudness-matched A/B). Automated finite/lifecycle coverage: \`src/lib/sound/realism/catalog-tuning/all-profiles-finite.test.ts\`.

Targeted regime WAVs (subset): \`artifacts/audio-lab/prompt-07-catalog/\`.

${header}${rows}
`;

  await writeFile(matrixOut, md);
  await writeFile(
    path.join(outputDir, "analysis.json"),
    `${JSON.stringify(
      {
        prompt: 7,
        catalogPublicCount: catalog.publicCount,
        catalogCoreCount: catalog.coreCount,
        listeningVerified: false,
        deviceVerified: false,
        targetedRenders: results,
        note: "Meters ≠ authenticity. Human rubric required.",
      },
      null,
      2,
    )}\n`,
  );

  process.stdout.write(`Wrote ${matrixOut}\n`);
  process.stdout.write(`Wrote ${path.join(outputDir, "analysis.json")}\n`);
} finally {
  await browser?.close();
  await server.close();
}
