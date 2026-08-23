import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./server";

/** One shared session check + redirect for every server-rendered part of
 *  /app, instead of each place reimplementing its own getUser()-then-redirect.
 *  This matches what Next.js's own auth guide recommends.
 *
 *  react's cache() means a layout and its page can both call this for the
 *  cost of one Supabase call, not two. proxy.ts still does its own fast
 *  cookie-only check first - this function is the real check. */
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
