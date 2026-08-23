"use client";

import { useCallback, useState } from "react";
import type {
  FlexibleTask,
  ScheduledSession,
  UnresolvedSessionInfo,
  UpdateScheduleResponse,
} from "@/lib/calendar/types";
import { toISODate } from "@/lib/calendar/dateUtils";

interface UseUpdateScheduleParams {
  today: Date;
  setFlexibleTasks: (tasks: FlexibleTask[]) => void;
  setScheduledSessions: (sessions: ScheduledSession[]) => void;
  setLastRunAt: (date: Date | null) => void;
  /** Transient confirmation only - the success case. */
  showToast: (msg: string) => void;
  /** Persisted in the Status area until dismissed - both failure cases. */
  reportSystemError: (text: string) => void;
}

export interface UseUpdateScheduleResult {
  updatingSchedule: boolean;
  /** Not null while the "what happened with these sessions?" prompt is
   *  blocking Update Schedule from running. */
  resolvePrompt: UnresolvedSessionInfo[] | null;
  closeResolvePrompt: () => void;
  updateSchedule: () => Promise<void>;
}

export function useUpdateSchedule({
  today,
  setFlexibleTasks,
  setScheduledSessions,
  setLastRunAt,
  showToast,
  reportSystemError,
}: UseUpdateScheduleParams): UseUpdateScheduleResult {
  const [updatingSchedule, setUpdatingSchedule] = useState(false);
  const [resolvePrompt, setResolvePrompt] = useState<UnresolvedSessionInfo[] | null>(null);

  const updateSchedule = useCallback(async () => {
    if (updatingSchedule) return;
    setUpdatingSchedule(true);

    let response: UpdateScheduleResponse;
    try {
      // Computed fresh right now, not from `today` above (that's fixed when
      // the tab loads). Otherwise a tab left open since this morning would
      // report the wrong hour.
      const now = new Date();
      const res = await fetch("/api/update-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Uses the browser's own clock - the server never guesses the time
        // zone.
        body: JSON.stringify({
          today: toISODate(today),
          nowHour: now.getHours() + now.getMinutes() / 60,
        }),
      });
      response = (await res.json()) as UpdateScheduleResponse;
    } catch {
      setUpdatingSchedule(false);
      reportSystemError("Couldn't update your schedule. Please try again.");
      return;
    }

    setUpdatingSchedule(false);

    if (response.status === "blocked") {
      setResolvePrompt(response.unresolvedSessions);
      return;
    }
    if (response.status === "error") {
      reportSystemError(response.message || "Couldn't update your schedule. Please try again.");
      return;
    }

    setFlexibleTasks(response.flexibleTasks);
    setScheduledSessions(response.scheduledSessions);
    setLastRunAt(new Date(response.lastRunAt));
    showToast("Schedule updated");
  }, [
    updatingSchedule,
    today,
    setFlexibleTasks,
    setScheduledSessions,
    setLastRunAt,
    showToast,
    reportSystemError,
  ]);

  const closeResolvePrompt = useCallback(() => setResolvePrompt(null), []);

  return { updatingSchedule, resolvePrompt, closeResolvePrompt, updateSchedule };
}
