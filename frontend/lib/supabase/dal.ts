import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./server";

/** Centralizes the session check + redirect so every server-rendered piece
 *  of /app calls one function instead of each re-implementing its own
 *  getUser()-then-redirect (Next.js's own auth guide recommends exactly
 *  this - a layout and its page each checking auth separately is the
 *  anti-pattern it warns against). react's cache() memoizes this per
 *  render pass, so a layout and its page both calling it still costs one
 *  Supabase call, not two. proxy.ts still does its own cookie-only check
 *  first as a fast pre-filter - this is the real check, done as close to
 *  the data as this app's structure allows. */
export const verifySession = cache(async (): Promise<User> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  return user;
});
