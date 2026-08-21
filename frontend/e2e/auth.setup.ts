import { test as setup, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const AUTH_FILE = "e2e/.auth/user.json";

/**
 * Wipes the E2E test user's own rows before the suite runs, so repeated
 * runs don't accumulate tasks/events/sessions across invocations. Uses the
 * anon key plus a real password sign-in (not the service role key) - RLS,
 * not elevated access, is what scopes every delete to this one account's
 * own rows. Deletes scheduled_sessions before flexible_tasks on purpose,
 * even though a DB cascade also handles it, so this doesn't rely on that.
 */
async function cleanUpTestData(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!url || !anonKey || !email || !password) {
    const required = {
      NEXT_PUBLIC_SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
      E2E_TEST_EMAIL: email,
      E2E_TEST_PASSWORD: password,
    };
    const missing = Object.entries(required)
      .filter(([, value]) => !value)
      .map(([name]) => name);
    throw new Error(
      `Missing env var(s) in frontend/.env.local: ${missing.join(", ")}. ` +
        "See frontend/.env.example.",
    );
  }

  const supabase = createClient(url, anonKey);
  const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError || !data.user) {
    throw new Error(
      `Couldn't sign in as the E2E test user to clean up its data: ${signInError?.message}. ` +
        "Has scripts/create-e2e-test-user.ts been run yet?",
    );
  }

  const userId = data.user.id;
  for (const table of ["scheduled_sessions", "flexible_tasks", "events"] as const) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (error) throw new Error(`Couldn't clean up ${table} for the E2E test user: ${error.message}`);
  }
}

/**
 * Signs in as the dedicated E2E test user (see scripts/create-e2e-test-user.ts)
 * via the /api/e2e-test-signin bypass route, then saves the resulting
 * session as storageState for every "authenticated" project test to reuse -
 * so only this one setup pays the sign-in cost, not every spec file.
 *
 * page.request shares its cookie jar with the page's own browser context,
 * so the Set-Cookie headers from this POST are already present by the time
 * /app is loaded below.
 */
setup("authenticate", async ({ page }) => {
  await cleanUpTestData();

  const response = await page.request.post("/api/e2e-test-signin");
  expect(
    response.ok(),
    `E2E sign-in failed (${response.status()}): ${await response.text()}`,
  ).toBeTruthy();

  await page.goto("/app");
  await expect(page).toHaveURL("/app");
  await page.context().storageState({ path: AUTH_FILE });
});
