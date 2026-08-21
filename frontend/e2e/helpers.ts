import type { Page } from "@playwright/test";

/** Creates a flexible task through the real UI - due in 3 days, 1 hour
 *  estimate, High priority. Shared by every spec that needs a task to
 *  exist, not just the one testing task creation itself. */
export async function createFlexibleTask(page: Page, title: string): Promise<void> {
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByText("Nextly finds the time").click();

  await page.getByPlaceholder("Task title").fill(title);

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 3);
  await page.locator('input[type="date"]').fill(deadline.toISOString().slice(0, 10));

  await page.getByPlaceholder("Hours").fill("1");
  await page.getByText("Select priority").click();
  await page.getByRole("button", { name: "High", exact: true }).click();

  await page.getByRole("button", { name: "Save" }).click();
}
