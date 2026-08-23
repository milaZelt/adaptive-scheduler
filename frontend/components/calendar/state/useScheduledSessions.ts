"use client";

import { useCallback, useEffect, useState } from "react";
import type { Category, ScheduledSession } from "@/lib/calendar/types";
import { toISODate } from "@/lib/calendar/dateUtils";
import {
  scheduledSessionFromRow,
  type ScheduledSessionRow,
} from "@/lib/calendar/supabaseMappers";
import { createClient } from "@/lib/supabase/client";

export interface UseScheduledSessionsResult {
  scheduledSessions: ScheduledSession[];
  scheduledSessionsLoading: boolean;
  scheduledSessionsError: string | null;
  /** Sessions already have one fixed date each (no recurrence to expand,
   *  unlike getEventsForDate). Just matches the date, plus the same
   *  category-visibility filter events use. */
  getSessionsForDate: (date: Date, categories: Category[]) => ScheduledSession[];
  /** The only direct change allowed on a session - everything else is
   *  read-only. */
  markSessionCompletion: (id: string, status: "completed" | "missed") => Promise<boolean>;
  /** Replaces the whole sessions list. Used right after Update Schedule
   *  succeeds - the server already saved these rows, so the client just
   *  adopts them directly. */
  setScheduledSessions: (sessions: ScheduledSession[]) => void;
  /** Removes every session in a deleted category from local state (the DB
   *  already does this with ON DELETE CASCADE, same as events/tasks). */
  removeScheduledSessionsByCategory: (categoryId: string) => void;
  /** Removes a deleted task's own sessions from local state. The DB handles
   *  this server-side, but without this the block would stay on the grid
   *  until the next reload. */
  removeScheduledSessionsByTask: (taskId: string) => void;
  /** Updates a task's already-placed sessions when its category changes. A
   *  DB trigger keeps this in sync server-side; this does the same for
   *  local state, so the color updates right away instead of after reload. */
  updateScheduledSessionsCategoryForTask: (taskId: string, categoryId: string) => void;
}

export function useScheduledSessions(
  userId: string,
  onError: (message: string) => void,
): UseScheduledSessionsResult {
  const [supabase] = useState(() => createClient());
  const [scheduledSessions, setScheduledSessionsState] = useState<ScheduledSession[]>([]);
  const [scheduledSessionsLoading, setScheduledSessionsLoading] = useState(true);
  const [scheduledSessionsError, setScheduledSessionsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setScheduledSessionsLoading(true);
      setScheduledSessionsError(null);

      const { data, error } = await supabase
        .from("scheduled_sessions")
        .select("*")
        .eq("user_id", userId);

      if (cancelled) return;

      if (error) {
        setScheduledSessionsError("Couldn't load your scheduled sessions.");
        setScheduledSessionsLoading(false);
        return;
      }

      setScheduledSessionsState(((data ?? []) as ScheduledSessionRow[]).map(scheduledSessionFromRow));
      setScheduledSessionsLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  const getSessionsForDate = useCallback(
    (date: Date, categories: Category[]): ScheduledSession[] => {
      const iso = toISODate(date);
      const checkedIds = new Set(categories.filter((c) => c.checked).map((c) => c.id));
      return scheduledSessions
        .filter((s) => s.date === iso)
        .filter((s) => checkedIds.has(s.categoryId));
    },
    [scheduledSessions],
  );

  const markSessionCompletion = useCallback(
    async (id: string, status: "completed" | "missed"): Promise<boolean> => {
      const prev = scheduledSessions;
      setScheduledSessionsState((cur) =>
        cur.map((s) => (s.id === id ? { ...s, completionStatus: status } : s)),
      );

      const { error } = await supabase
        .from("scheduled_sessions")
        .update({ completion_status: status })
        .eq("id", id);

      if (error) {
        setScheduledSessionsState(prev);
        onError("Couldn't save that. Please try again.");
        return false;
      }
      return true;
    },
    [scheduledSessions, supabase, onError],
  );

  const setScheduledSessions = useCallback((sessions: ScheduledSession[]) => {
    setScheduledSessionsState(sessions);
  }, []);

  const removeScheduledSessionsByCategory = useCallback((categoryId: string) => {
    setScheduledSessionsState((cur) => cur.filter((s) => s.categoryId !== categoryId));
  }, []);

  const removeScheduledSessionsByTask = useCallback((taskId: string) => {
    setScheduledSessionsState((cur) => cur.filter((s) => s.taskId !== taskId));
  }, []);

  const updateScheduledSessionsCategoryForTask = useCallback((taskId: string, categoryId: string) => {
    setScheduledSessionsState((cur) =>
      cur.map((s) => (s.taskId === taskId ? { ...s, categoryId } : s)),
    );
  }, []);

  return {
    scheduledSessions,
    scheduledSessionsLoading,
    scheduledSessionsError,
    getSessionsForDate,
    markSessionCompletion,
    setScheduledSessions,
    removeScheduledSessionsByCategory,
    removeScheduledSessionsByTask,
    updateScheduledSessionsCategoryForTask,
  };
}
