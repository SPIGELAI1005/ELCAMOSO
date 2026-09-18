import { test, expect } from "@playwright/test";
import { expectAppHealthy, gotoPath, seedReadySettings } from "./helpers";

test.describe("Demo Drive", () => {
  test.beforeEach(async ({ page }) => {
    await seedReadySettings(page);
    await gotoPath(page, "/demo");
  });

  test("page loads with Start control", async ({ page }) => {
    await expectAppHealthy(page);
    await expect(page.getByRole("heading", { name: /Feel the Drive\./i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^start$/i })).toBeVisible();
  });

  test("feel section includes pedals and fine controls", async ({ page }) => {
    await expect(page.getByRole("group", { name: /pedals/i })).toBeVisible();
    await expect(page.getByText(/fine controls/i)).toBeVisible();
  });

  test("Start attempts audio session without crashing", async ({ page }) => {
    const start = page.getByRole("button", { name: /^start$/i });
    await start.scrollIntoViewIfNeeded();
    await start.click();
    // Headless Web Audio may be blocked; either path must leave the app healthy.
    const stop = page.getByRole("button", { name: /^stop$/i });
    await page.waitForTimeout(1200);
    if (await stop.isVisible().catch(() => false)) {
      await stop.click();
      await expect(start).toBeVisible();
    } else {
      await expectAppHealthy(page);
      await expect(start).toBeVisible();
    }
  });

  test("PRND selectors are available", async ({ page }) => {
    await expect(page.getByRole("radio", { name: /park/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /reverse/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /neutral/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /drive/i })).toBeVisible();
  });

  test("selecting a sound profile updates the cockpit label", async ({ page }) => {
    await page.getByRole("button", { name: "GT V8", pressed: true }).waitFor();
    await page.waitForTimeout(1500);
    await page.getByRole("heading", { name: "Sound Profile" }).scrollIntoViewIfNeeded();
    await page.getByRole("tab", { name: "Motorsport" }).click();
    const racingV10 = page.getByRole("button", { name: "Racing V10" });
    await racingV10.click();
    await expect(racingV10).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(500);
    await expect(racingV10).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#feel").getByText("Racing V10")).toBeVisible();
  });
});
