import { test, expect } from "@playwright/test";
import { expectAppHealthy, seedReadySettings } from "./helpers";

test.describe("Demo feel motion", () => {
  test.beforeEach(async ({ page }) => {
    await seedReadySettings(page);
    await page.goto("/demo#feel");
    await expect(page.locator("#app-root")).toBeVisible();
    await page.waitForLoadState("networkidle");
  });

  test("gas pedal auto-starts demo and increases speed", async ({ page }) => {
    await expectAppHealthy(page);
    const gas = page.getByRole("button", { name: /gas pedal/i });
    const speed = page.locator("#feel .tabular-nums").first();
    await gas.scrollIntoViewIfNeeded();
    await gas.click({ delay: 3500 });

    await expect
      .poll(async () => Number(await speed.textContent()), { timeout: 8000 })
      .toBeGreaterThan(0);
    await expect(page.locator("#feel").getByRole("button", { name: /^stop$/i })).toBeVisible();
  });
});
