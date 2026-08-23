import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Test-only sign-in, used by Playwright's e2e/auth.setup.ts. Real Google
 * OAuth can't be scripted, so tests need a password login instead. This uses
 * the app's real server-side Supabase client, so it can't drift out of sync
 * with how Supabase actually builds a session.
 *
 * Safety: this 404s outside development, and only ever signs in as the one
 * account in E2E_TEST_EMAIL - never credentials from the request. So even if
 * this leaked into production, it could only grant that one throwaway test
 * account.
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
