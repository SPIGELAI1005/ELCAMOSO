// Usage: node scripts/render-carriage-demos.mjs <outDir> <suffix>
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const [outDir = "artifacts/carriage-demos", suffix = "demo"] = process.argv.slice(2);
const profiles = ["wild-west-carriage", "romanian-85-carriage"];
function wav(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 4, 28); h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
const server = await createServer({ server: { host: "127.0.0.1", port: 5300 + Math.floor(Math.random() * 500), strictPort: false } });
let browser;
try {
  await server.listen();
  const { port } = server.httpServer.address();
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "domcontentloaded" });
  await mkdir(outDir, { recursive: true });
  for (const id of profiles) {
    const r = await page.evaluate(async (pid) => {
      const m = await import("/src/lib/sound/validation/carriage-demo.ts");
      return m.renderCarriageDemo(pid);
    }, id);
    const file = path.join(outDir, `${id}_${suffix}.wav`);
    await writeFile(file, wav(Buffer.from(r.pcmBase64, "base64"), r.sampleRate));
    console.log(file);
  }
} finally {
  await browser?.close();
  await server.close();
}
