import { test, expect } from "@playwright/test";

test("marketing page loads with nav and login CTA", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Nextly" })).toBeVisible();
  await expect(page.getByRole("link", { name: "About" })).toBeVisible();
  await expect(page.getByRole("link", { name: "FAQ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
});
