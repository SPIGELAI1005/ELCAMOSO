import { test, expect } from "@playwright/test";
import { expectAppHealthy, gotoPath, seedReadySettings } from "./helpers";

test.describe("Landing /", () => {
  test.beforeEach(async ({ page }) => {
    await seedReadySettings(page);
    await gotoPath(page, "/");
  });

  test("renders brand, tagline, and Start Drive", async ({ page }) => {
    await expectAppHealthy(page);
    await expect(page.getByText(/Turn motion into sound/i).first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Your EV\.\s*Your Sound\.\s*More Emotion\./i }),
    ).toBeVisible();
    await expect(page.getByText(/Engines\. Music\. Worlds\./i).first()).toBeVisible();
    await expect(
      page.getByText(/Feel the e-motion in your electrical motion\./i).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /start drive/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /explore experiences/i })).toBeVisible();
  });

  test("Start Drive navigates to /drive", async ({ page }) => {
    await page.getByRole("link", { name: /start drive/i }).click();
    await expect(page).toHaveURL(/\/drive/);
    await expectAppHealthy(page);
  });

  test("Explore Experiences opens the experience family page", async ({ page }) => {
    await page.getByRole("link", { name: /explore experiences/i }).click();
    await expect(page).toHaveURL(/\/explore/);
    await expect(page.getByRole("heading", { name: /Choose what motion becomes/i })).toBeVisible();
  });

  test("experience families are present", async ({ page }) => {
    await page.getByRole("heading", { name: /Choose your experience/i }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("link", { name: /Engine Feel a machine/i })).toBeVisible();
    await page.getByRole("link", { name: /Engine Feel a machine/i }).click();
    await expect(page).toHaveURL(/\/sounds/);
  });

  test("footer legal links are present", async ({ page }) => {
    const footer = page.locator("#site-footer");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer.getByRole("link", { name: "Impressum" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Privacy" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Cookies" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Terms" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Accessibility" })).toBeVisible();
  });
});
