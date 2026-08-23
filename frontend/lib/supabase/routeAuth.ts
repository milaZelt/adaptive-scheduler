import type { SupabaseClient, User } from "@supabase/supabase-js";

/** The one auth check shared by every API route. Returns null on failure,
 *  not a response - unlike dal.ts's verifySession (which can just redirect
 *  since it's for pages), each route needs its own error response shape. */
export async function getAuthenticatedUser(supabase: SupabaseClient): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
