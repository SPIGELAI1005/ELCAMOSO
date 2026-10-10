import { expect, test } from "@playwright/test";
import { expectAppHealthy, gotoPath, seedReadySettings } from "./helpers";

test.describe("developer audio diagnostics", () => {
  test.beforeEach(async ({ page }) => {
    await seedReadySettings(page, { profileId: "american-muscle-v8" });
  });

  test("starts the production profile and exposes role isolation", async ({ page }) => {
    await gotoPath(page, "/debug");
    await expectAppHealthy(page);

    await page.getByLabel("Sound Profile").selectOption("american-muscle-v8");
    await expect(page.getByRole("button", { name: "Realism V2" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: "Play", exact: true }).click();

    const isolation = page.getByLabel("Layer role isolation");
    await expect(isolation).toBeVisible();
    const combustion = isolation.getByRole("button", { name: "Mute combustion" });
    await expect(combustion).toBeVisible();
    await combustion.click();
    await expect(isolation.getByRole("button", { name: "Enable combustion" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.getByRole("button", { name: "Stop", exact: true }).click();
  });
});
