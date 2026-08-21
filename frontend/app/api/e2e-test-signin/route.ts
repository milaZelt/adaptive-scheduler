import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Test-only sign-in bypass for Playwright's e2e/auth.setup.ts. Real Google
 * OAuth can't be scripted reliably, so E2E tests need a password-based way
 * in - this reuses the app's real server-side Supabase client (same cookie
 * code path as every other auth flow) instead of hand-building session
 * cookies, so there's nothing here that can drift out of sync with how
 * Supabase actually encodes a session.
 *
 * Gated hard: 404s outside development, and only ever signs in as the one
 * account named by this server's own E2E_TEST_EMAIL - never credentials
 * from the request - so even if this were somehow reachable in a real
 * deployment, the only account it could grant is that one throwaway,
 * RLS-scoped test user.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production." }, { status: 404 });
  }

  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    return NextResponse.json({ error: "E2E_TEST_EMAIL/E2E_TEST_PASSWORD not configured." }, { status: 500 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return NextResponse.json({ status: "ok" });
}
