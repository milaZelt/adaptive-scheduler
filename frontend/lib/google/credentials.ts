import type { SupabaseClient } from "@supabase/supabase-js";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
// Refresh a bit before the real expiry so a request never races a token
// that's about to expire mid-flight.
const EXPIRY_SAFETY_MARGIN_MS = 60_000;

interface StoredCredentialsRow {
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
}

/** Saves the Google refresh token when the user signs in. This is the only
 *  time Supabase gives us this token, so we have to save it now or lose it.
 *
 *  We don't save the access token here - Supabase doesn't tell us its real
 *  expiry time, so we'd have to guess. Leaving it unset just means the next
 *  getValidGoogleAccessToken call will refresh for a real one, which always
 *  works.
 *
 *  On a re-login, this won't erase an already-cached access token, since
 *  upsert only touches the columns listed here. */
export async function saveGoogleCredentials(
  supabase: SupabaseClient,
  userId: string,
  grant: { refreshToken: string; scope: string },
): Promise<void> {
  const { error } = await supabase.from("google_credentials").upsert({
    user_id: userId,
    refresh_token: grant.refreshToken,
    scope: grant.scope,
  });
  if (error) throw error;
}

/** Returns a ready-to-use Google access token, refreshing it first if it's
 *  missing or close to expiry. Supabase only refreshes its own session
 *  token, not Google's, so this function fills that gap. Returns null if
 *  the user never connected Google or Google rejected the refresh token -
 *  either way, the caller should ask them to reconnect, not retry. */
export async function getValidGoogleAccessToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: row } = await supabase
    .from("google_credentials")
    .select("refresh_token, access_token, access_token_expires_at")
    .eq("user_id", userId)
    .maybeSingle<StoredCredentialsRow>();

  if (!row) return null;

  const expiresAt = row.access_token_expires_at ? new Date(row.access_token_expires_at).getTime() : 0;
  if (row.access_token && expiresAt - Date.now() > EXPIRY_SAFETY_MARGIN_MS) {
    return row.access_token;
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET are not configured.");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  // Covers a revoked/expired token (Google's invalid_grant) and any other
  // failure. None of these are fixable by retrying, so we just return null
  // either way.
  if (!response.ok) return null;

  const refreshed = (await response.json()) as { access_token: string; expires_in: number };

  await supabase
    .from("google_credentials")
    .update({
      access_token: refreshed.access_token,
      access_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    })
    .eq("user_id", userId);

  return refreshed.access_token;
}
