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
  showToast: (msg: string) => void;
}

export interface UseUpdateScheduleResult {
  updatingSchedule: boolean;
  /** Non-null while the blocking "what happened with these?" prompt needs
   *  an answer before Update Schedule can actually run (decisions record). */
  resolvePrompt: UnresolvedSessionInfo[] | null;
  closeResolvePrompt: () => void;
  updateSchedule: () => Promise<void>;
}

export function useUpdateSchedule({
  today,
  setFlexibleTasks,
  setScheduledSessions,
  showToast,
}: UseUpdateScheduleParams): UseUpdateScheduleResult {
  const [updatingSchedule, setUpdatingSchedule] = useState(false);
  const [resolvePrompt, setResolvePrompt] = useState<UnresolvedSessionInfo[] | null>(null);

  const updateSchedule = useCallback(async () => {
    if (updatingSchedule) return;
    setUpdatingSchedule(true);

    let response: UpdateScheduleResponse;
    try {
      const res = await fetch("/api/update-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Client's own resolved local date - the server never infers a
        // timezone or computes its own "today" (decisions record).
        body: JSON.stringify({ today: toISODate(today) }),
      });
      response = (await res.json()) as UpdateScheduleResponse;
    } catch {
      setUpdatingSchedule(false);
      showToast("Couldn't update your schedule. Please try again.");
      return;
    }

    setUpdatingSchedule(false);

    if (response.status === "blocked") {
      setResolvePrompt(response.unresolvedSessions);
      return;
    }
    if (response.status === "error") {
      showToast(response.message || "Couldn't update your schedule. Please try again.");
      return;
    }

    setFlexibleTasks(response.flexibleTasks);
    setScheduledSessions(response.scheduledSessions);
    showToast("Schedule updated");
  }, [updatingSchedule, today, setFlexibleTasks, setScheduledSessions, showToast]);

  const closeResolvePrompt = useCallback(() => setResolvePrompt(null), []);

  return { updatingSchedule, resolvePrompt, closeResolvePrompt, updateSchedule };
}
