/** Used by both LoginSection.tsx (client) and credentials.ts (server). Kept
 *  in its own file so the client doesn't have to import credentials.ts's
 *  Supabase code just to get this string. */
export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
