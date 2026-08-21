import { test, expect } from "@playwright/test";

/**
 * Checks the real OAuth redirect carries the right scope/consent params.
 * Listens for the request instead of intercepting it - page.route() proved
 * unreliable for this specific cross-origin, HTTP-redirect-driven
 * navigation (Supabase 302s to Google, which itself redirects again before
 * rendering); page.on("request") sees every hop of that same chain
 * without needing to intercept it, which is all this test needs. The
 * click still starts a real navigation toward Google in the background,
 * but the test doesn't wait for it - it stops as soon as the URL it wants
 * has been observed.
 */
test("Sign in with Google redirects to a correctly-scoped Google OAuth URL", async ({ page }) => {
  await page.goto("/");

  const seen = new Promise<string>((resolve) => {
    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith("https://accounts.google.com/") && url.includes("access_type=")) {
        resolve(url);
      }
    });
  });

  await page.getByRole("button", { name: "Sign in with Google" }).click();
  const capturedUrl = await Promise.race([
    seen,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Never saw a Google OAuth request with access_type=")), 10_000),
    ),
  ]);

  const url = new URL(capturedUrl);
  expect(url.hostname).toBe("accounts.google.com");
  expect(url.searchParams.get("access_type")).toBe("offline");
  expect(url.searchParams.get("prompt")).toBe("consent");
  expect(url.searchParams.get("scope") ?? "").toContain("calendar.readonly");
});
