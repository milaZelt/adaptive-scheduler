import { test, expect } from "@playwright/test";
import { createFlexibleTask } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByText("Nextly")).toBeVisible();
});

test("creating a flexible task shows it under Not yet scheduled", async ({ page }) => {
  const title = `E2E task ${Date.now()}`;

  await createFlexibleTask(page, title);

  await expect(page.getByText("Not yet scheduled")).toBeVisible();
  await expect(page.getByText(title)).toBeVisible();
});

test("creating a fixed event shows it on the grid", async ({ page }) => {
  const title = `E2E event ${Date.now()}`;

  await page.getByRole("button", { name: "Create" }).click();
  await page.getByText("You choose when").click();

  await page.getByPlaceholder("Event title").fill(title);
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText(title)).toBeVisible();
});
