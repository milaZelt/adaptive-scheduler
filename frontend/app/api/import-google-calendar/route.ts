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

// Same shape as update-schedule's own step functions: each either returns
// the data the next step needs, or a ready-to-return NextResponse, so POST
// itself stays a single top-to-bottom sequence of named steps.

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

/** Finds the category imports should land in, creating it the first time
 *  and remembering its id on google_credentials so that if the user later
 *  renames it, the next import still lands there instead of a second
 *  "Google Calendar" category getting silently recreated. */
async function resolveImportCategoryId(
  supabase: SupabaseClient,
  userId: string,
): Promise<NextResponse | string> {
  const { data: creds, error: credsError } = await supabase
    .from("google_credentials")
    .select("import_category_id")
    .eq("user_id", userId)
    .maybeSingle<{ import_category_id: string | null }>();

  if (credsError) return errorResponse("Couldn't read your Google connection.", 500);

  if (creds?.import_category_id) {
    const { data: existing } = await supabase
      .from("categories")
      .select("id")
      .eq("id", creds.import_category_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return creds.import_category_id;
    // Category was deleted since it was linked - fall through and create a
    // fresh one below rather than failing the import over it.
  }

  const { data: created, error: createError } = await supabase
    .from("categories")
    .insert({ user_id: userId, name: IMPORT_CATEGORY_NAME, color: IMPORT_CATEGORY_COLOR, checked: true })
    .select("id")
    .single();

  if (createError || !created) {
    return errorResponse("Couldn't set up a category for imported events.", 500);
  }

  const { error: linkError } = await supabase
    .from("google_credentials")
    .update({ import_category_id: created.id })
    .eq("user_id", userId);
  if (linkError) return errorResponse("Couldn't save your import category.", 500);

  return created.id as string;
}

/** Wipes this user's previously-imported events within the horizon and
 *  inserts the freshly-fetched set - a full replace, not a diff, since
 *  Google is always the source of truth for its own events and a plain
 *  (non-sync-token) list query can't tell "deleted on Google" apart from
 *  "just outside this page" any other way. */
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
  // Padded a day on each side so no in-window event is lost to a
  // timezone-boundary mismatch between this server's own clock and the
  // event's local time - eventConversion.ts re-clips to the real horizon
  // using each event's own literal date, so padding can only pull in a
  // little extra raw data, never lose real data.
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
