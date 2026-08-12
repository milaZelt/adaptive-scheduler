"use client";

import { useCallback, useEffect, useState } from "react";
import type { CalendarEvent, Category } from "@/lib/calendar/types";
import { toISODate } from "@/lib/calendar/dateUtils";
import { eventOccursOnDate } from "@/lib/calendar/recurrence";
import { eventFromRow, eventToRowPatch, type EventRow } from "@/lib/calendar/supabaseMappers";
import { createClient } from "@/lib/supabase/client";

export interface UseEventsResult {
  events: CalendarEvent[];
  eventsLoading: boolean;
  eventsError: string | null;
  /** Recurring events are expanded client-side from their single stored rule —
   *  the returned occurrence keeps the series' id but has `date` set to the
   *  actual day being rendered. */
  getEventsForDate: (date: Date, categories: Category[]) => CalendarEvent[];
  getEventById: (id: string) => CalendarEvent | undefined;
  createEvent: (input: Omit<CalendarEvent, "id">) => Promise<CalendarEvent | null>;
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => Promise<boolean>;
  deleteEvent: (id: string) => Promise<boolean>;
  /** Cascades a category delete — removes every event tied to that category
   *  from local state (the DB relationship is ON DELETE CASCADE already). */
  removeEventsByCategory: (categoryId: string) => void;
  /** Replaces the full events list - used by useGoogleImport to merge in
   *  the fresh state a successful import returns, same pattern as
   *  useUpdateSchedule's setFlexibleTasks/setScheduledSessions. */
  setEvents: (events: CalendarEvent[]) => void;
}

export function useEvents(
  userId: string,
  onError: (message: string) => void,
): UseEventsResult {
  const [supabase] = useState(() => createClient());
  const [events, setEventsState] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setEventsLoading(true);
      setEventsError(null);

      const { data, error } = await supabase.from("events").select("*").eq("user_id", userId);

      if (cancelled) return;

      if (error) {
        setEventsError("Couldn't load your events.");
        setEventsLoading(false);
        return;
      }

      setEventsState(((data ?? []) as EventRow[]).map(eventFromRow));
      setEventsLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  const getEventsForDate = useCallback(
    (date: Date, categories: Category[]): CalendarEvent[] => {
      const iso = toISODate(date);
      const checkedIds = new Set(categories.filter((c) => c.checked).map((c) => c.id));
      return events
        .filter((e) => checkedIds.has(e.categoryId))
        .filter((e) => eventOccursOnDate(e, date))
        .map((e) => (e.date === iso ? e : { ...e, date: iso }))
        .sort((a, b) => Number(b.allDay) - Number(a.allDay));
    },
    [events],
  );

  const getEventById = useCallback(
    (id: string) => events.find((e) => e.id === id),
    [events],
  );

  const createEvent = useCallback(
    async (input: Omit<CalendarEvent, "id">): Promise<CalendarEvent | null> => {
      const row = eventToRowPatch(input);
      const { data, error } = await supabase
        .from("events")
        .insert({ ...row, user_id: userId })
        .select("*")
        .single();

      if (error || !data) {
        onError("Couldn't save that event. Please try again.");
        return null;
      }

      const created = eventFromRow(data as EventRow);
      setEventsState((cur) => [...cur, created]);
      return created;
    },
    [supabase, userId, onError],
  );

  const updateEvent = useCallback(
    async (id: string, patch: Partial<CalendarEvent>): Promise<boolean> => {
      const prev = events;
      setEventsState((cur) => cur.map((e) => (e.id === id ? { ...e, ...patch } : e)));

      const rowPatch = eventToRowPatch(patch);
      const { error } = await supabase.from("events").update(rowPatch).eq("id", id);

      if (error) {
        setEventsState(prev);
        onError("Couldn't save your changes. Please try again.");
        return false;
      }
      return true;
    },
    [events, supabase, onError],
  );

  const deleteEvent = useCallback(
    async (id: string): Promise<boolean> => {
      const prev = events;
      setEventsState((cur) => cur.filter((e) => e.id !== id));

      const { error } = await supabase.from("events").delete().eq("id", id);

      if (error) {
        setEventsState(prev);
        onError("Couldn't delete that event. Please try again.");
        return false;
      }
      return true;
    },
    [events, supabase, onError],
  );

  const removeEventsByCategory = useCallback((categoryId: string) => {
    setEventsState((cur) => cur.filter((e) => e.categoryId !== categoryId));
  }, []);

  const setEvents = useCallback((next: CalendarEvent[]) => {
    setEventsState(next);
  }, []);

  return {
    events,
    eventsLoading,
    eventsError,
    getEventsForDate,
    getEventById,
    createEvent,
    updateEvent,
    deleteEvent,
    removeEventsByCategory,
    setEvents,
  };
}
