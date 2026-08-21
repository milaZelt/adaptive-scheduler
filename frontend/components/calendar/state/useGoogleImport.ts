"use client";

import { useCallback, useState } from "react";
import type { CalendarEvent, ImportGoogleCalendarResponse } from "@/lib/calendar/types";
import { toISODate } from "@/lib/calendar/dateUtils";

interface UseGoogleImportParams {
  today: Date;
  setEvents: (events: CalendarEvent[]) => void;
  showToast: (msg: string) => void;
  /** Persisted in the Status area until dismissed - both failure cases,
   *  same convention as useUpdateSchedule. */
  reportSystemError: (text: string) => void;
}

export interface UseGoogleImportResult {
  importingGoogleCalendar: boolean;
  /** True once a Google Calendar import has succeeded this session - shown
   *  as a persistent Status-area line (StatusList.tsx), not a toast, since
   *  the toast disappears before the user might even notice it. */
  googleCalendarImported: boolean;
  importGoogleCalendar: () => Promise<void>;
}

export function useGoogleImport({
  today,
  setEvents,
  showToast,
  reportSystemError,
}: UseGoogleImportParams): UseGoogleImportResult {
  const [importingGoogleCalendar, setImportingGoogleCalendar] = useState(false);
  const [googleCalendarImported, setGoogleCalendarImported] = useState(false);

  const importGoogleCalendar = useCallback(async () => {
    if (importingGoogleCalendar) return;
    setImportingGoogleCalendar(true);

    let response: ImportGoogleCalendarResponse;
    try {
      const res = await fetch("/api/import-google-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ today: toISODate(today) }),
      });
      response = (await res.json()) as ImportGoogleCalendarResponse;
    } catch {
      setImportingGoogleCalendar(false);
      reportSystemError("Couldn't import your Google Calendar. Please try again.");
      return;
    }

    setImportingGoogleCalendar(false);

    if (response.status === "not_connected") {
      reportSystemError("Connect Google Calendar by signing out and back in with Google.");
      return;
    }
    if (response.status === "error") {
      reportSystemError(response.message || "Couldn't import your Google Calendar. Please try again.");
      return;
    }

    setEvents(response.events);
    setGoogleCalendarImported(true);
    showToast("Google Calendar was imported successfully");
  }, [importingGoogleCalendar, today, setEvents, showToast, reportSystemError]);

  return { importingGoogleCalendar, googleCalendarImported, importGoogleCalendar };
}
