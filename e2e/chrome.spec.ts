import { test, expect } from "@playwright/test";
import { expectAppHealthy, gotoPath } from "./helpers";

test.describe("Cookie consent", () => {
  test("banner appears for new visitors and can be dismissed", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem("elcamoso-cookie-consent-v1");
    });
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator("#app-root")).toBeVisible();
    const dialog = page.getByRole("dialog", { name: /cookie preferences/i });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
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
  test("desktop primary nav reaches Drive and Sounds", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("elcamoso-cookie-consent-v1", "essential");
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoPath(page, "/");
    await page
      .getByRole("navigation", { name: /primary/i })
      .getByRole("link", { name: /^drive$/i })
      .click();
    await expect(page).toHaveURL(/\/drive/);
    await page
      .getByRole("navigation", { name: /primary/i })
      .getByRole("link", { name: /^sounds$/i })
      .click();
    await expect(page).toHaveURL(/\/sounds/);
  });

  test("mobile bottom nav reaches Sounds", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chrome",
      "Uses the Pixel project viewport (bottom nav is md:hidden)",
    );
    await page.addInitScript(() => {
      window.localStorage.setItem("elcamoso-cookie-consent-v1", "essential");
    });
    await gotoPath(page, "/");
    await page
      .locator("nav")
      .filter({ has: page.getByRole("link", { name: /^sounds$/i }) })
      .getByRole("link", { name: /^sounds$/i })
      .click();
    await expect(page).toHaveURL(/\/sounds/);
    await expectAppHealthy(page);
  });

  test("mobile menu opens and links work", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chrome",
      "Uses the Pixel project viewport (sheet trigger is md:hidden)",
    );
    await page.addInitScript(() => {
      window.localStorage.setItem("elcamoso-cookie-consent-v1", "essential");
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator("#app-root")).toBeVisible();
    const trigger = page.getByTestId("nav-menu");
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
    await page
      .getByRole("navigation", { name: /mobile/i })
      .getByRole("link", { name: /^demo$/i })
      .click();
    await expect(page).toHaveURL(/\/demo/);
    await expectAppHealthy(page);
  });
});
