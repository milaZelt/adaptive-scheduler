export interface GoogleCalendarEventTime {
  date?: string;
  dateTime?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  status?: string;
  summary?: string;
  start: GoogleCalendarEventTime;
  end: GoogleCalendarEventTime;
}

const EVENTS_LIST_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const PAGE_SIZE = 250;

/** Fetches every event Google has in the [timeMinISO, timeMaxISO) window,
 *  paging through all results. A 2-week import probably fits in one page,
 *  but paginating is safer than guessing and silently missing events. Also
 *  uses singleEvents=true, so Google expands recurring events for us
 *  instead of us parsing RRULEs. */
export async function fetchGoogleCalendarEvents(
  accessToken: string,
  timeMinISO: string,
  timeMaxISO: string,
): Promise<GoogleCalendarEvent[]> {
  const events: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(EVENTS_LIST_URL);
    url.searchParams.set("timeMin", timeMinISO);
    url.searchParams.set("timeMax", timeMaxISO);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", String(PAGE_SIZE));
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Google Calendar events.list failed with status ${response.status}`);
    }

    const body = (await response.json()) as {
      items?: GoogleCalendarEvent[];
      nextPageToken?: string;
    };

    // Google shouldn't send cancelled events here, but we skip them anyway
    // just in case.
    for (const item of body.items ?? []) {
      if (item.status !== "cancelled") events.push(item);
    }
    pageToken = body.nextPageToken;
  } while (pageToken);

  return events;
}
