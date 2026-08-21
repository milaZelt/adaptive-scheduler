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
  /** Sessions are already concrete single-date rows (no recurrence to
   *  expand, unlike getEventsForDate) - just a date match plus the same
   *  category-visibility filter events use. */
  getSessionsForDate: (date: Date, categories: Category[]) => ScheduledSession[];
  /** The only mutation a scheduled session supports directly - read-only
   *  beyond completion status. */
  markSessionCompletion: (id: string, status: "completed" | "missed") => Promise<boolean>;
  /** Replaces local state wholesale - used right after a successful Update
   *  Schedule run, whose Route Handler already persisted the fresh rows
   *  server-side and returns them for the client to adopt directly. */
  setScheduledSessions: (sessions: ScheduledSession[]) => void;
  /** Cascades a category delete - removes every session tied to that
   *  category from local state (the DB relationship is ON DELETE CASCADE
   *  already, same pattern as events/flexible tasks). */
  removeScheduledSessionsByCategory: (categoryId: string) => void;
  /** Cascades a flexible task delete - removes that task's own placed
   *  sessions from local state (ON DELETE CASCADE handles it server-side;
   *  without this, an already-rendered session block for the deleted task
   *  would linger on the grid until the next full reload). */
  removeScheduledSessionsByTask: (taskId: string) => void;
  /** Cascades a flexible task recategorize - a DB trigger keeps
   *  scheduled_sessions.category_id (denormalized at solve time) in sync
   *  server-side; this mirrors that for local state so an already-placed
   *  session's color/visibility updates immediately, not just after reload. */
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
