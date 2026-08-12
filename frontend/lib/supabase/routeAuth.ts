import type { SupabaseClient, User } from "@supabase/supabase-js";

/** The one auth check shared by every Route Handler under app/api/. Returns
 *  null rather than a response on failure - unlike dal.ts's verifySession
 *  (for Server Components, where redirect() makes sense), a POST/GET route
 *  needs its own typed error response, which differs per route, so building
 *  one here would just get thrown away by callers with their own shape. */
export async function getAuthenticatedUser(supabase: SupabaseClient): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
