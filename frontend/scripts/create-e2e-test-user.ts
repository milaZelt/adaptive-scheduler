/**
 * One-time admin script: creates the dedicated Supabase user Playwright E2E
 * tests sign in as (via signInWithPassword in e2e/auth.setup.ts) - real
 * Google OAuth can't be scripted reliably, so tests bypass it entirely with
 * this separate, unprivileged, password-based account.
 *
 * Run manually, exactly once, never as part of the automated test suite or
 * CI. Needs the Supabase SERVICE ROLE KEY - a far more sensitive credential
 * than anything else this app uses, since it bypasses RLS entirely. Only
 * needed for this one invocation; never put it in .env.local or any
 * committed file.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   NEXT_PUBLIC_SUPABASE_URL=... \
 *   E2E_TEST_EMAIL=... \
 *   E2E_TEST_PASSWORD=... \
 *   npm run create-e2e-test-user
 *
 * NEXT_PUBLIC_SUPABASE_URL is the same public value already in .env.local.
 * After this runs once, add E2E_TEST_EMAIL/E2E_TEST_PASSWORD (not the
 * service role key) to .env.local - that's what actual test runs sign in
 * with, using only the unprivileged anon key.
 */
import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = requireEnv("E2E_TEST_EMAIL");
  const password = requireEnv("E2E_TEST_PASSWORD");

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      console.log(`Test user ${email} already exists - nothing to do.`);
      return;
    }
    throw error;
  }

  console.log(`Created E2E test user ${email} (id: ${data.user.id}).`);
  console.log("Now add E2E_TEST_EMAIL/E2E_TEST_PASSWORD to .env.local - never the service role key.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
