/**
 * Prompt 04: loudness-matched before/after fixtures for raw-mechanical pilots.
 *
 * Captures V2 (before) and V3 (after) for american-muscle-v8 + flat-six-sport,
 * applies approximate loudness match toward V2, writes WAV + analysis.
 *
 * Listening-verified: NO — meters do not prove authentic engine sound.
 *
 * Usage:
 *   npm run audio:prompt-04
 *   AUDIO_LAB_FIXTURES=gentle-0-80 npm run audio:prompt-04
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer } from "vite";

process.env.VITE_DRIVE_AUDIO_V3 = "1";
process.env.ELCAMOSO_DRIVE_AUDIO_V3 = "1";

const pilots = ["american-muscle-v8", "flat-six-sport"];
const fixtures = (process.env.AUDIO_LAB_FIXTURES ?? "gentle-0-80,idle")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
const outputDir = path.resolve(
  process.env.AUDIO_LAB_OUT ?? "artifacts/audio-lab/prompt-04-raw-mechanical",
);

function applyGainDb(pcm, gainDb) {
  const g = Math.pow(10, gainDb / 20);
  const out = Buffer.alloc(pcm.length);
  for (let i = 44; i + 1 < pcm.length; i += 2) {
    const sample = pcm.readInt16LE(i);
    const scaled = Math.max(-32768, Math.min(32767, Math.round(sample * g)));
    out.writeInt16LE(scaled, i);
  }
  pcm.copy(out, 0, 0, 44);
  return out;
}

const server = await createServer({
  server: { host: "127.0.0.1", port: 0 },
  define: {
    "import.meta.env.VITE_DRIVE_AUDIO_V3": JSON.stringify("1"),
  },
});
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

  const pairs = [];
  for (const profileId of pilots) {
    for (const fixtureId of fixtures) {
      const capture = async (realismEngine) =>
        page.evaluate(
          async ({ profileId: id, fixtureId: fixture, realismEngine: engine }) => {
            const lab = await import("/src/lib/sound/lab/index.ts");
            return lab.renderLabCapture({
              profileId: id,
              fixtureId: fixture,
              includeSpectrum: false,
              settings: { realismEngine: engine },
            });
          },
          { profileId, fixtureId, realismEngine },
        );

      const before = await capture("v2");
      const after = await capture("v3");
      const beforeWav = Buffer.from(before.wavBase64, "base64");
      const afterWav = Buffer.from(after.wavBase64, "base64");
      const matchDb = await page.evaluate(
        ({ refLoud, candLoud, peakDbfs }) =>
          import("/src/lib/sound/lab/index.ts").then((lab) =>
            lab.levelMatchGainDb(refLoud, candLoud, peakDbfs),
          ),
        {
          refLoud: before.metrics.approximateIntegratedLoudness,
          candLoud: after.metrics.approximateIntegratedLoudness,
          peakDbfs: after.metrics.samplePeakDbfs,
        },
      );
      const matchedWav = applyGainDb(afterWav, matchDb);

      const stem = `${profileId}__${fixtureId}`;
      await writeFile(path.join(outputDir, `${stem}__v2-before.wav`), beforeWav);
      await writeFile(path.join(outputDir, `${stem}__v3-after.wav`), afterWav);
      await writeFile(path.join(outputDir, `${stem}__v3-after-loudness-matched.wav`), matchedWav);
      delete before.wavBase64;
      delete after.wavBase64;
      await writeFile(
        path.join(outputDir, `${stem}__v2-before.meta.json`),
        `${JSON.stringify(before.metadata, null, 2)}\n`,
      );
      await writeFile(
        path.join(outputDir, `${stem}__v3-after.meta.json`),
        `${JSON.stringify(after.metadata, null, 2)}\n`,
      );
      pairs.push({
        profileId,
        fixtureId,
        beforeBackend: before.metadata.rendererBackend,
        afterBackend: after.metadata.rendererBackend,
        beforeExcitation: before.metadata.excitationMode,
        afterExcitation: after.metadata.excitationMode,
        beforeLoudness: before.metrics.approximateIntegratedLoudness,
        afterLoudness: after.metrics.approximateIntegratedLoudness,
        afterPeakDbfs: after.metrics.samplePeakDbfs,
        levelMatchGainDb: matchDb,
        beforeFinite:
          before.metrics.nanCount === 0 && before.metrics.infinityCount === 0,
        afterFinite: after.metrics.nanCount === 0 && after.metrics.infinityCount === 0,
        listeningVerified: false,
        note: "Code metrics do not prove authentic engine sound. Human listening pending.",
      });
      process.stdout.write(
        `${stem}: v2=${before.metadata.rendererBackend} → v3=${after.metadata.rendererBackend} match=${matchDb.toFixed(2)} dB\n`,
      );
    }
  }

  await writeFile(
    path.join(outputDir, "analysis.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        prompt: "04-raw-mechanical",
        flag: "VITE_DRIVE_AUDIO_V3=1",
        hardware: {
          platform: `${os.platform()} ${os.release()} ${os.arch()}`,
          cpu: os.cpus()[0]?.model ?? "unknown",
          logicalCpuCount: os.cpus().length,
        },
        listeningVerified: false,
        pairs,
      },
      null,
      2,
    )}\n`,
  );

  await writeFile(
    path.join(outputDir, "README.md"),
    `# Prompt 04 raw-mechanical fixtures

Loudness-matched **before (V2)** / **after (V3)** captures for pilot profiles:

- \`american-muscle-v8\`
- \`flat-six-sport\`

## Honesty

- Metrics are sample peak/RMS and approximate integrated loudness — **not** certified LUFS or true peak.
- **Listening-verified: no.** Do not treat spectral/loudness numbers as proof of authentic engine sound.
- Perceived realism remains **pending** until auditioned on the intended playback system.

## Files

Per pilot × fixture:

- \`*__v2-before.wav\` — Realism V2 baseline
- \`*__v3-after.wav\` — Drive Audio V3 raw mechanical (unmatched level)
- \`*__v3-after-loudness-matched.wav\` — V3 gain-matched toward V2 approx loudness
- matching \`*.meta.json\` + \`analysis.json\`
`,
  );
} finally {
  await browser?.close();
  await server.close();
}
