import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Playwright's own Node process doesn't auto-load .env.local the way
// Next.js's dev server does for itself - needed here for auth.setup.ts's
// Supabase calls and E2E_TEST_EMAIL/PASSWORD.
dotenv.config({ path: ".env.local" });

const AUTH_FILE = "e2e/.auth/user.json";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    // Marketing/sign-in specs need no session, so they never depend on
    // setup - a broken test account shouldn't block these from running.
    {
      name: "public",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /(marketing|sign-in)\.spec\.ts/,
    },
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "authenticated",
      use: { ...devices["Desktop Chrome"], storageState: AUTH_FILE },
      testMatch: /(tasks-and-events|update-schedule)\.spec\.ts/,
      dependencies: ["setup"],
    },
  ],
});
