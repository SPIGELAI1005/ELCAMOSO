import { test, expect } from "@playwright/test";
import { expectAppHealthy, gotoPath, seedReadySettings } from "./helpers";

test.describe("Tesla purchase shell", () => {
  test.beforeEach(async ({ page }) => {
    await seedReadySettings(page);
  });

  test("invalid upgrade token shows expired link", async ({ page }) => {
    await gotoPath(page, "/upgrade/not-a-valid-token");
    await expectAppHealthy(page);
    await expect(page.getByRole("heading", { name: /link expired/i })).toBeVisible();
    await expect(page.getByText(/scan a fresh code from your car/i)).toBeVisible();
  });

  test("upgrade success return page renders", async ({ page }) => {
    await gotoPath(page, "/upgrade/test-token?billing=success");
    await expectAppHealthy(page);
    await expect(page.getByRole("heading", { name: /payment received/i })).toBeVisible();
    await expect(page.getByText(/your car should show drive\+ is ready/i)).toBeVisible();
  });

  test("drive cockpit with upgrade param loads without error boundary", async ({ page }) => {
    await gotoPath(page, "/drive?cockpit=1&upgrade=drive-plus");
    await expectAppHealthy(page);
    await expect(page.locator("body")).toContainText(/Start Drive|Stop Drive|Sound Active|No motion yet/i);
  });
});
