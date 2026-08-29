import { test, expect } from "@playwright/test";
import { expectAppHealthy, gotoPath, seedReadySettings } from "./helpers";

test.describe("Landing /", () => {
  test.beforeEach(async ({ page }) => {
    await seedReadySettings(page);
    await gotoPath(page, "/");
  });

  test("renders brand, tagline, and Start Drive", async ({ page }) => {
    await expectAppHealthy(page);
    await expect(page.getByRole("heading", { name: /Your EV\.\s*Your Sound\./i })).toBeVisible();
    await expect(page.getByText(/Electric motion\. More e-motion\./i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /start drive/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /hear it/i })).toBeVisible();
  });

  test("Start Drive navigates to /drive", async ({ page }) => {
    await page
      .getByRole("link", { name: /start drive/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/drive/);
    await expectAppHealthy(page);
  });

  test("Hear it links to demo feel section", async ({ page }) => {
    await expect(page.getByRole("link", { name: /hear it/i })).toHaveAttribute("href", /\/demo#feel/);
    await page.getByRole("link", { name: /hear it/i }).click();
    await expect(page).toHaveURL(/\/demo#feel/);
    await expect(page.getByRole("heading", { name: /Feel the Drive\./i })).toBeVisible();
    await expect(page.getByRole("button", { name: /gas pedal/i })).toBeVisible();
  });

  test("curated sounds are present", async ({ page }) => {
    await page.getByRole("heading", { name: /Choose how motion feels/i }).scrollIntoViewIfNeeded();
    await expect(page.getByText("GT V8").first()).toBeVisible();
    await page.getByRole("link", { name: /browse all sounds/i }).click();
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
