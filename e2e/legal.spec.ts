import { test, expect } from "@playwright/test";
import { expectAppHealthy, gotoPath, seedReadySettings } from "./helpers";

test.describe("Legal pages", () => {
  test.beforeEach(async ({ page }) => {
    await seedReadySettings(page);
  });

  test("Impressum shows operator and support email", async ({ page }) => {
    await gotoPath(page, "/legal/impressum");
    await expectAppHealthy(page);
    const main = page.locator("main");
    await expect(main.getByRole("heading", { name: /legal notice/i })).toBeVisible();
    await expect(main.getByText("ELCAMOSO", { exact: true })).toBeVisible();
    await expect(main.getByText(/George-Mugurel Neacsu/i)).toBeVisible();
    await expect(main.getByRole("link", { name: /support@elcamoso\.com/i })).toBeVisible();
    await expect(main.getByText(/consumer dispute resolution/i)).toBeVisible();
  });

  test("Privacy names the controller email", async ({ page }) => {
    await gotoPath(page, "/legal/privacy");
    await expect(page.locator("main").getByRole("heading", { name: /privacy/i })).toBeVisible();
    await expect(page.locator("main").getByText(/support@elcamoso\.com/i).first()).toBeVisible();
  });

  test("legal hub lists all notices", async ({ page }) => {
    await gotoPath(page, "/legal");
    const main = page.locator("main");
    for (const label of ["Impressum", "Privacy", "Cookies", "Terms", "Accessibility"]) {
      await expect(main.getByRole("link", { name: label }).first()).toBeVisible();
    }
  });
});
