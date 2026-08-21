import { defineConfig, devices } from "@playwright/test";

/**
 * Prefer an already-running `npm run dev` (port 5173).
 * If none is up, start Vite on 5175 so we never fight a stuck 5173 binder.
 */
const REUSE = process.env.E2E_REUSE !== "0";
const PORT = Number(process.env.E2E_PORT ?? (REUSE ? 5173 : 5175));
const HOST = process.env.E2E_HOST ?? "localhost";
const BASE_URL = `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    geolocation: { latitude: 48.137, longitude: 11.575 },
    permissions: ["geolocation"],
    launchOptions: {
      // Headless Chromium otherwise blocks AudioContext → Demo/Drive Start never flips to Stop.
      args: ["--autoplay-policy=no-user-gesture-required"],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: `npx vite --host ${HOST} --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: REUSE,
    timeout: 120_000,
  },
  outputDir: "test-results",
});
