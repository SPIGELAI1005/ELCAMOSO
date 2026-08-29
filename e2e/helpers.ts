import { expect, type Page } from "@playwright/test";

/** Seed ready-to-drive settings (demo motion on: no real GPS required). */
export async function seedReadySettings(page: Page, overrides: Record<string, unknown> = {}) {
  await page.addInitScript((extra) => {
    const base = {
      profileId: "gt-v8",
      volume: 0.7,
      demoMotion: true,
      safetyAcknowledged: true,
      onboarded: true,
      onboardingStep: 2,
      driveCount: 1,
      language: "en",
      units: "metric",
      analyticsEnabled: false,
      cloudEnabled: false,
      ...extra,
    };
    window.localStorage.setItem("elcamoso.settings", JSON.stringify(base));
    // Cookie consent is a raw string, not JSON-encoded.
    window.localStorage.setItem("elcamoso-cookie-consent-v1", "essential");
  }, overrides);
}

export async function dismissCookieBanner(page: Page) {
  const dialog = page.getByRole("dialog", { name: /cookie preferences/i });
  if (await dialog.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: /essential only/i }).click();
    await expect(dialog).toHaveCount(0);
  }
}

export async function gotoPath(page: Page, path: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(path);
  await dismissCookieBanner(page);
  await expect(page.locator("#app-root")).toBeVisible();
}

/** Assert the page did not fall into the root error boundary. */
export async function expectAppHealthy(page: Page) {
  await expect(page.getByRole("heading", { name: /this page didn't load/i })).toHaveCount(0);
  await expect(page.locator("#app-root")).toBeVisible();
}
