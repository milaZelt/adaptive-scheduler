import { test, expect } from "@playwright/test";
import { createFlexibleTask } from "./helpers";

test("clicking Update Schedule places a task via a real solver call", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByText("Nextly")).toBeVisible();

  const title = `E2E schedule ${Date.now()}`;
  await createFlexibleTask(page, title);
  await expect(page.getByText(title)).toBeVisible();

  await page.getByRole("button", { name: "Update Schedule" }).click();

  // Real CP-SAT solve, not mocked - give it real time rather than the
  // default 5s (see backend/benchmarks: a handful of tasks can take
  // several seconds).
  await expect(page.getByText("Scheduled", { exact: true })).toBeVisible({ timeout: 30_000 });
  // A placed task's title shows twice: the session block on the grid, and
  // its row in the status list's Scheduled section - checking the count
  // confirms both halves of the round trip landed, not just one.
  await expect(page.getByText(title)).toHaveCount(2);
});
