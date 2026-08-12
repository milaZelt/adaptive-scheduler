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

/** Fetches every event Google returns for the [timeMinISO, timeMaxISO)
 *  window on the user's primary calendar, following pagination to
 *  completion - a personal calendar's ~2-week import window is never going
 *  to need more than one page in practice, but silently truncating on that
 *  assumption is worse than the few extra lines pagination takes.
 *  singleEvents=true asks Google to expand recurring events into
 *  individual instances itself, rather than this app parsing RRULEs. */
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

    // Cancelled instances aren't expected back from a plain (non-sync-token)
    // list query, but excluded defensively rather than trusted implicitly.
    for (const item of body.items ?? []) {
      if (item.status !== "cancelled") events.push(item);
    }
    pageToken = body.nextPageToken;
  } while (pageToken);

  return events;
}
