import { test, expect } from "@playwright/test";
import { expectAppHealthy, gotoPath } from "./helpers";

test.describe("Cookie consent", () => {
  test("banner appears for new visitors and can be dismissed", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem("elcamoso-cookie-consent-v1");
    });
    await page.goto("/");
    await expect(page.getByRole("dialog", { name: /cookie preferences/i })).toBeVisible();
    await page.getByRole("button", { name: /essential only/i }).click();
    await expect(page.getByRole("dialog", { name: /cookie preferences/i })).toHaveCount(0);
    await expectAppHealthy(page);
  });

  test("does not reappear after essential choice", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("elcamoso-cookie-consent-v1", "essential");
    });
    await gotoPath(page, "/");
    await expect(page.getByRole("dialog", { name: /cookie preferences/i })).toHaveCount(0);
  });
});

test.describe("Navigation", () => {
  test("desktop primary nav reaches Demo and Sounds", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("elcamoso-cookie-consent-v1", "essential");
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoPath(page, "/");
    await page.getByRole("navigation", { name: /primary/i }).getByRole("link", { name: /^demo$/i }).click();
    await expect(page).toHaveURL(/\/demo/);
    await page.getByRole("navigation", { name: /primary/i }).getByRole("link", { name: /^sounds$/i }).click();
    await expect(page).toHaveURL(/\/sounds/);
  });

  test("mobile menu opens and links work", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chrome",
      "Uses the Pixel project viewport (sheet trigger is md:hidden)",
    );
    await page.addInitScript(() => {
      window.localStorage.setItem("elcamoso-cookie-consent-v1", "essential");
    });
    await gotoPath(page, "/");
    const trigger = page.getByTestId("nav-menu");
    await expect(trigger).toBeVisible();
    // Wait for client hydration so the React onClick is attached.
    await page.waitForFunction(() => {
      const el = document.querySelector("[data-testid=nav-menu]");
      return !!el && Object.keys(el).some((key) => key.startsWith("__reactFiber"));
    });
    await trigger.dispatchEvent("click");
    const sheet = page.getByTestId("nav-sheet");
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    await sheet.getByRole("navigation", { name: /mobile/i }).getByRole("link", { name: /^demo$/i }).click();
    await expect(page).toHaveURL(/\/demo/);
    await expectAppHealthy(page);
  });
});
