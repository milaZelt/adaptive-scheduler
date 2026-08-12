/** Shared by both LoginSection.tsx (client, requests it via signInWithOAuth)
 *  and credentials.ts (server, records what was granted) - kept in its own
 *  dependency-free file so the client component never pulls in
 *  credentials.ts's Supabase/token-refresh code just for this string. */
export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
