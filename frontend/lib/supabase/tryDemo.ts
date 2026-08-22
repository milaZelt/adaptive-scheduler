import { createClient } from "@/lib/supabase/client";

/** Signs in anonymously and seeds demo content (Ticket 10) - shared by the
 *  navbar and marketing login section's "Try Demo" entry points. Caller
 *  handles the redirect to /app itself, so this stays framework-agnostic. */
export async function startDemo(): Promise<{ error: string | null }> {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    return { error: error?.message ?? "Couldn't start the demo. Please try again." };
  }

  const { error: seedError } = await supabase.rpc("seed_demo_content", { p_user_id: data.user.id });
  if (seedError) {
    return { error: "Couldn't set up the demo. Please try again." };
  }

  return { error: null };
}
