"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface UseScheduleRunsResult {
  /** When Update Schedule last completed successfully for this user, or null
   *  if it never has. Written server-side only, by the apply_schedule_update
   *  RPC (Ticket 4) - this hook only ever reads it. */
  lastRunAt: Date | null;
  lastRunAtLoading: boolean;
  lastRunAtError: string | null;
  /** Adopts the fresh timestamp a successful Update Schedule run returns -
   *  same bulk-replace-on-success pattern as setFlexibleTasks/setScheduledSessions. */
  setLastRunAt: (date: Date | null) => void;
}

export function useScheduleRuns(userId: string): UseScheduleRunsResult {
  const [supabase] = useState(() => createClient());
  const [lastRunAt, setLastRunAtState] = useState<Date | null>(null);
  const [lastRunAtLoading, setLastRunAtLoading] = useState(true);
  const [lastRunAtError, setLastRunAtError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLastRunAtLoading(true);
      setLastRunAtError(null);

      const { data, error } = await supabase
        .from("schedule_runs")
        .select("updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setLastRunAtError("Couldn't check when your schedule last updated.");
        setLastRunAtLoading(false);
        return;
      }

      setLastRunAtState(data ? new Date(data.updated_at) : null);
      setLastRunAtLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  const setLastRunAt = useCallback((date: Date | null) => {
    setLastRunAtState(date);
  }, []);

  return { lastRunAt, lastRunAtLoading, lastRunAtError, setLastRunAt };
}
