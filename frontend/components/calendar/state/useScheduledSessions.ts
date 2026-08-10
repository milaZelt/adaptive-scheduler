"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScheduledSession } from "@/lib/calendar/types";
import {
  scheduledSessionFromRow,
  type ScheduledSessionRow,
} from "@/lib/calendar/supabaseMappers";
import { createClient } from "@/lib/supabase/client";

export interface UseScheduledSessionsResult {
  scheduledSessions: ScheduledSession[];
  scheduledSessionsLoading: boolean;
  scheduledSessionsError: string | null;
  /** The only mutation a scheduled session supports directly (decisions
   *  record: read-only in V1 beyond completion status). */
  markSessionCompletion: (id: string, status: "completed" | "missed") => Promise<boolean>;
  /** Replaces local state wholesale - used right after a successful Update
   *  Schedule run, whose Route Handler already persisted the fresh rows
   *  server-side and returns them for the client to adopt directly. */
  setScheduledSessions: (sessions: ScheduledSession[]) => void;
  /** Cascades a category delete — removes every session tied to that
   *  category from local state (the DB relationship is ON DELETE CASCADE
   *  already, same pattern as events/flexible tasks). */
  removeScheduledSessionsByCategory: (categoryId: string) => void;
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

  return {
    scheduledSessions,
    scheduledSessionsLoading,
    scheduledSessionsError,
    markSessionCompletion,
    setScheduledSessions,
    removeScheduledSessionsByCategory,
  };
}
