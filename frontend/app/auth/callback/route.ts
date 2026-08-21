import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveGoogleCredentials } from "@/lib/google/credentials";
import { GOOGLE_CALENDAR_SCOPE } from "@/lib/google/constants";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const refreshToken = data.session.provider_refresh_token;
      if (refreshToken) {
        // Best-effort: Google Calendar access is an enhancement, not a
        // login requirement, so a storage failure here shouldn't block
        // the user from getting into the app at all.
        try {
          await saveGoogleCredentials(supabase, data.session.user.id, {
            refreshToken,
            scope: GOOGLE_CALENDAR_SCOPE,
          });
        } catch (err) {
          console.error("Failed to save Google credentials:", err);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
