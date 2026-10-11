/**
 * Prompt 06: isolated shift + city fixture listening renders (loudness-matched).
 *
 * Usage: npm run audio:prompt-06
 *
 * Listening-verified: NO — writes WAVs + analysis only.
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer } from "vite";

const outputDir = path.resolve(
  process.env.AUDIO_LAB_OUT ?? "artifacts/audio-lab/prompt-06-shift-events",
);
const profiles = (process.env.AUDIO_LAB_PROFILES ?? "american-muscle-v8,flat-six-sport,gt-v8")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

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
  for (const profileId of profiles) {
    for (const fixtureId of ["gentle-0-80", "idle"]) {
      const result = await page.evaluate(
        async ({ profileId: id, fixtureId: fixture }) => {
          const lab = await import("/src/lib/sound/lab/index.ts");
          return lab.renderLabCapture({
            profileId: id,
            fixtureId: fixture,
            includeSpectrum: false,
            settings: { realismEngine: "v2", volume: 0.7 },
          });
        },
        { profileId, fixtureId },
      );
      const wav = Buffer.from(result.wavBase64, "base64");
      delete result.wavBase64;
      const stem = `${profileId}__${fixtureId}`;
      await writeFile(path.join(outputDir, `${stem}.wav`), wav);
      await writeFile(
        path.join(outputDir, `${stem}.meta.json`),
        `${JSON.stringify(result.metadata, null, 2)}\n`,
      );
      results.push({
        profileId,
        fixtureId,
        backend: result.metadata.rendererBackend,
        peakDbfs: result.metrics.samplePeakDbfs,
        approxLoudness: result.metrics.approximateIntegratedLoudness,
        finite: result.metrics.nanCount === 0 && result.metrics.infinityCount === 0,
        listeningVerified: false,
      });
      process.stdout.write(`${stem}: ${result.metadata.rendererBackend}\n`);
    }
  }

  // City VT fixture summary (no audio — event chronology for listening prep).
  const city = await page.evaluate(async () => {
    const { getPowertrainScenario, runPowertrainScenario } = await import(
      "/src/lib/powertrain/scenarios.ts"
    );
    const { getPowertrainProfile } = await import("/src/lib/powertrain/profiles.ts");
    const scenario = getPowertrainScenario("city-0-80-0");
    if (!scenario) throw new Error("city-0-80-0 scenario missing");
    return runPowertrainScenario(scenario, getPowertrainProfile("gt-v8"), {
      shiftMapPreset: "city",
    });
  });

  await writeFile(
    path.join(outputDir, "city-0-80-0-events.json"),
    `${JSON.stringify(
      {
        profileId: "gt-v8",
        shiftMapPreset: "city",
        shiftEventCount: city.shiftEvents?.length ?? 0,
        shiftEvents: (city.shiftEvents ?? []).map((e) => ({
          sequenceId: e.sequenceId,
          atMs: e.atMs,
          fromGear: e.fromGear,
          toGear: e.toGear,
          direction: e.direction,
        })),
        note: "Simulated audio events only — not vehicle actuation.",
      },
      null,
      2,
    )}\n`,
  );

  await writeFile(
    path.join(outputDir, "analysis.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        prompt: "06-shift-events",
        hardware: {
          platform: `${os.platform()} ${os.release()} ${os.arch()}`,
          cpu: os.cpus()[0]?.model ?? "unknown",
        },
        listeningVerified: false,
        results,
      },
      null,
      2,
    )}\n`,
  );

  await writeFile(
    path.join(outputDir, "README.md"),
    `# Prompt 06 shift-event fixtures

Loudness uses lab measurement volume (0.7). Match A/B by ear before judging shift believability.

- Isolated / drive fixtures: \`*__gentle-0-80.wav\`, \`*__idle.wav\`
- City chronology: \`city-0-80-0-events.json\` (unique sequenceIds)

**Listening-verified: no.** Simulated audio only — no speed jumps or vehicle actuation claims.
`,
  );
} finally {
  await browser?.close();
  await server.close();
}
