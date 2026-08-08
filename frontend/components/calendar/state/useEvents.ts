"use client";

import { useCallback, useState } from "react";
import type { CalendarEvent, Category } from "@/lib/calendar/types";
import { generateSeedEvents } from "@/lib/calendar/seedEvents";
import { toISODate } from "@/lib/calendar/dateUtils";

export interface UseEventsResult {
  events: CalendarEvent[];
  getEventsForDate: (date: Date, categories: Category[]) => CalendarEvent[];
  getEventById: (id: string) => CalendarEvent | undefined;
  /** Cascades a category delete — removes every event tied to that category. */
  removeEventsByCategory: (categoryId: string) => void;
}

export function useEvents(initial?: CalendarEvent[]): UseEventsResult {
  // NOTE: create/edit from the tear sheets is intentionally console-log-only
  // for now (no backend submit yet), so events only change here via the
  // category-delete cascade below. Swap this for a real mutable store (or
  // the Supabase `events` table) when wiring up Save for real.
  const [localEvents, setLocalEvents] = useState<CalendarEvent[]>(
    () => initial ?? generateSeedEvents(),
  );

  const getEventsForDate = useCallback(
    (date: Date, categories: Category[]): CalendarEvent[] => {
      const iso = toISODate(date);
      const checkedIds = new Set(categories.filter((c) => c.checked).map((c) => c.id));
      return localEvents
        .filter((e) => e.date === iso)
        .filter((e) => checkedIds.has(e.categoryId))
        .sort((a, b) => Number(b.allDay) - Number(a.allDay));
    },
    [localEvents],
  );

  const getEventById = useCallback(
    (id: string) => localEvents.find((e) => e.id === id),
    [localEvents],
  );

  const removeEventsByCategory = useCallback((categoryId: string) => {
    setLocalEvents((prev) => prev.filter((e) => e.categoryId !== categoryId));
  }, []);

  return {
    events: localEvents,
    getEventsForDate,
    getEventById,
    removeEventsByCategory,
  };
}
