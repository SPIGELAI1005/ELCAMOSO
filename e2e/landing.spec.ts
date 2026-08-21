import { test, expect } from "@playwright/test";
import { expectAppHealthy, gotoPath, seedReadySettings } from "./helpers";

test.describe("Landing /", () => {
  test.beforeEach(async ({ page }) => {
    await seedReadySettings(page);
    await gotoPath(page, "/");
  });

  test("renders brand, tagline, and Start Drive", async ({ page }) => {
    await expectAppHealthy(page);
    await expect(
      page.getByRole("heading", { name: /Your EV\.\s*Your Sound\.\s*More Emotion\./i }),
    ).toBeVisible();
    await expect(page.getByText(/Electric Car Motion Sound/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /start drive/i })).toBeVisible();
    await expect(page.getByText(/works with your EV/i)).toBeVisible();
  });

  test("Start Drive navigates to /drive", async ({ page }) => {
    await page.getByRole("link", { name: /start drive/i }).click();
    await expect(page).toHaveURL(/\/drive/);
    await expectAppHealthy(page);
  });

  test("Choose your sound lists categories and Browse all", async ({ page }) => {
    await page.getByRole("heading", { name: /choose your sound/i }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "Classic 5" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Playful 3" })).toBeVisible();
    await page.getByRole("link", { name: /browse all/i }).click();
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
