/**
 * Phone-size screenshots of RUMOSO with simulated run data.
 * Uses a standalone Vite app (no TanStack Start SSR) so shots don't depend
 * on the hosting app's server-fn typings.
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.resolve(process.env.RUMOSO_SHOTS ?? "/workspace/rumoso/screenshots");
await mkdir(outDir, { recursive: true });

const server = await createServer({
  configFile: path.join(repo, "scripts/rumoso-shots/vite.config.ts"),
});
let browser;
try {
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("Vite did not expose a TCP port");
  const origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"],
  });
  const views = [
    ["ready", "rumoso-ready.png"],
    ["running", "rumoso-running.png"],
    ["summary", "rumoso-summary.png"],
    ["diagnostics", "rumoso-diagnostics.png"],
  ];
  for (const [demo, file] of views) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    });
    page.setDefaultTimeout(60_000);
    const url = `${origin}/scripts/rumoso-shots/index.html?demo=${demo}`;
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='rumoso-app']", { timeout: 30_000 });
    await page.waitForTimeout(4000);
    if (demo === "diagnostics") {
      await page.locator("[data-testid='rumoso-diagnostics']").scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(500);
    }
    const dest = path.join(outDir, file);
    await page.screenshot({ path: dest, fullPage: false });
    console.log("wrote", dest, errors.length ? `pageerrors=${errors.length}` : "ok");
    if (errors.length) console.log(errors.slice(0, 3).join("\n"));
    await page.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
