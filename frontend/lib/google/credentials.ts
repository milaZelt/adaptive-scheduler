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

/** Captures the Google refresh token at sign-in time (auth/callback) - the
 *  only moment Supabase's session carries it, so it must be saved now or
 *  it's gone for good. Doesn't store the short-lived access token issued
 *  alongside it: Supabase's session doesn't expose that token's real
 *  expiry (expires_in/expires_at describe Supabase's own JWT, not
 *  Google's), so caching it here would mean guessing a TTL. Leaving
 *  access_token unset means the next getValidGoogleAccessToken call just
 *  refreshes for real, which is always correct. On a re-login, an
 *  already-cached access token is left untouched, since upsert only
 *  overwrites the columns listed here. */
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

/** Returns a Google Calendar access token ready to use, refreshing it
 *  against Google's token endpoint first if the cached one is missing or
 *  close to expiry. Supabase only ever refreshes its own session JWT,
 *  never the provider's token - this fills that gap. Returns null if this
 *  user never connected a Google account, or if Google rejects the
 *  refresh token (revoked or expired). Either way, the caller should
 *  prompt reconnection, not retry. */
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

  // Covers a revoked/expired refresh token (Google responds invalid_grant)
  // alongside any other failure - none of it is retryable without the user
  // reconnecting, so the caller just sees "no token available" either way.
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
