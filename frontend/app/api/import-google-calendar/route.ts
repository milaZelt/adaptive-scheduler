import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/routeAuth";
import { getValidGoogleAccessToken } from "@/lib/google/credentials";
import { fetchGoogleCalendarEvents } from "@/lib/google/calendar";
import { convertGoogleEvent } from "@/lib/google/eventConversion";
import { getPlanningHorizon, parseRequestToday, type PlanningHorizon } from "@/lib/calendar/horizon";
import { addDays, toISODate } from "@/lib/calendar/dateUtils";
import { eventFromRow, eventToRowPatch, type EventRow } from "@/lib/calendar/supabaseMappers";
import type { CalendarEvent, ImportGoogleCalendarResponse } from "@/lib/calendar/types";

const IMPORT_CATEGORY_NAME = "Google Calendar";
const IMPORT_CATEGORY_COLOR = "#BCD4E6";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { status: "error", message } satisfies ImportGoogleCalendarResponse,
    { status },
  );
}

// Same pattern as update-schedule's step functions: each one returns either
// the data the next step needs, or a ready NextResponse. That keeps POST a
// simple top-to-bottom list of steps.

async function parseToday(request: Request): Promise<NextResponse | Date> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Malformed request body.", 400);
  }
  const todayDate = parseRequestToday(body);
  if (!todayDate) return errorResponse("Missing or malformed 'today'.", 400);
  return todayDate;
}

/** Finds the category imports go into, creating it the first time. We look
 *  it up by its is_google_import flag, not by name - so if the user renames
 *  "Google Calendar", imports still land there instead of creating a
 *  duplicate. FlexibleEventForm.tsx uses the same flag to hide this
 *  category from new task creation. */
async function resolveImportCategoryId(
  supabase: SupabaseClient,
  userId: string,
): Promise<NextResponse | string> {
  const { data: existing, error: existingError } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("is_google_import", true)
    .maybeSingle();

  if (existingError) return errorResponse("Couldn't read your calendars.", 500);
  if (existing) return existing.id as string;

  const { data: created, error: createError } = await supabase
    .from("categories")
    .insert({
      user_id: userId,
      name: IMPORT_CATEGORY_NAME,
      color: IMPORT_CATEGORY_COLOR,
      checked: true,
      is_google_import: true,
    })
    .select("id")
    .single();

  if (createError || !created) {
    return errorResponse("Couldn't set up a category for imported events.", 500);
  }

  return created.id as string;
}

/** Deletes this user's old imported events in the horizon, then inserts the
 *  fresh ones. It's a full replace, not a diff - a plain list query can't
 *  tell "deleted on Google" apart from "just not on this page", so Google's
 *  current list is always treated as the full truth. */
async function replaceGoogleEvents(
  supabase: SupabaseClient,
  userId: string,
  horizon: PlanningHorizon,
  eventsToInsert: Omit<CalendarEvent, "id">[],
): Promise<NextResponse | null> {
  const { error: deleteError } = await supabase
    .from("events")
    .delete()
    .eq("user_id", userId)
    .eq("source", "google")
    .gte("date", horizon.startISO)
    .lte("date", horizon.endISO);

  if (deleteError) return errorResponse("Couldn't refresh your imported events.", 500);
  if (eventsToInsert.length === 0) return null;

  const rows = eventsToInsert.map((e) => ({ ...eventToRowPatch(e), user_id: userId }));
  const { error: insertError } = await supabase.from("events").insert(rows);
  if (insertError) return errorResponse("Couldn't save your imported events.", 500);

  return null;
}

async function fetchFreshEvents(
  supabase: SupabaseClient,
  userId: string,
): Promise<NextResponse | CalendarEvent[]> {
  const { data, error } = await supabase.from("events").select("*").eq("user_id", userId);
  if (error) return errorResponse("Import succeeded, but couldn't reload your events.", 500);
  return ((data ?? []) as EventRow[]).map(eventFromRow);
}

// Paginated Google API calls plus a possible token refresh can run past
// Vercel's default 10s function timeout (Hobby plan) for a large calendar.
export const maxDuration = 30;

export async function POST(request: Request) {
  const todayDate = await parseToday(request);
  if (todayDate instanceof NextResponse) return todayDate;

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) return errorResponse("Not authenticated.", 401);

  const accessToken = await getValidGoogleAccessToken(supabase, user.id);
  if (!accessToken) {
    return NextResponse.json({ status: "not_connected" } satisfies ImportGoogleCalendarResponse);
  }

  const categoryId = await resolveImportCategoryId(supabase, user.id);
  if (categoryId instanceof NextResponse) return categoryId;

  const horizon = getPlanningHorizon(todayDate);
  // Padded one day on each side, so a timezone mismatch between the server
  // and the event can't cut off a real event. eventConversion.ts re-clips to
  // the real horizon afterward, so this padding can only pull in a bit of
  // extra data, never lose real data.
  const timeMinISO = `${toISODate(addDays(horizon.days[0], -1))}T00:00:00Z`;
  const timeMaxISO = `${toISODate(addDays(horizon.days[horizon.days.length - 1], 2))}T00:00:00Z`;

  let googleEvents;
  try {
    googleEvents = await fetchGoogleCalendarEvents(accessToken, timeMinISO, timeMaxISO);
  } catch {
    return errorResponse("Couldn't reach Google Calendar. Please try again.", 502);
  }

  const eventsToInsert = googleEvents.flatMap((ge) =>
    convertGoogleEvent(ge, categoryId, horizon.startISO, horizon.endISO),
  );

  const replaceError = await replaceGoogleEvents(supabase, user.id, horizon, eventsToInsert);
  if (replaceError) return replaceError;

  const freshEvents = await fetchFreshEvents(supabase, user.id);
  if (freshEvents instanceof NextResponse) return freshEvents;

  return NextResponse.json({ status: "ok", events: freshEvents } satisfies ImportGoogleCalendarResponse);
}
