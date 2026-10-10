import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createServer } from "vite";

const outputDir = path.resolve("artifacts/audio-portfolio/2026-09-26");
const server = await createServer({ server: { host: "127.0.0.1", port: 0 } });
let browser;
try {
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("Vite did not expose a TCP port");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: "domcontentloaded" });
  const profileIds = await page.evaluate(async () => {
    const module = await import("/src/lib/sound/profiles.ts");
    return module.SOUND_PROFILES.map((profile) => profile.id);
  });
  await mkdir(outputDir, { recursive: true });
  const results = [];
  for (const profileId of profileIds) {
    const result = await page.evaluate(async (id) => {
      const module = await import("/src/lib/sound/validation/offline-comparison.ts");
      return module.renderOfflineComparison(id, "tuned");
    }, profileId);
    const wav = Buffer.from(result.wavBase64, "base64");
    delete result.wavBase64;
    await writeFile(path.join(outputDir, `${profileId}-tuned-untouched.wav`), wav);
    results.push(result);
    process.stdout.write(`${results.length}/${profileIds.length} ${profileId}: ${Math.round(result.renderElapsedMs)} ms\n`);
  }
  await writeFile(
    path.join(outputDir, "analysis.json"),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      renderer: "Installed Chrome OfflineAudioContext, production SoundEngine graph, tuned variant",
      limitations: [
        "Chrome OfflineAudioContext exposes no AudioWorklet here, so Realism V2 uses its production fallback excitation.",
        "Meters are sample peak/RMS and an approximate BS.1770 integrated value; no value is true peak or certified LUFS.",
        "Automated capture is not human listening verification.",
      ],
      hardware: {
        platform: `${os.platform()} ${os.release()} ${os.arch()}`,
        cpu: os.cpus()[0]?.model ?? "unknown",
        logicalCpuCount: os.cpus().length,
        totalMemoryBytes: os.totalmem(),
      },
      profileCount: profileIds.length,
      results,
    }, null, 2)}\n`,
  );
} finally {
  await browser?.close();
  await server.close();
}
