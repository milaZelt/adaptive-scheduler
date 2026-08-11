import type { CalendarEvent, FlexibleTask, ScheduledSession } from "./types";
import { eventOccursOnDate } from "./recurrence";
import { toISODate } from "./dateUtils";

export interface StalenessResult {
  stale: boolean;
  reasons: string[];
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Three triggers, matching the decisions record exactly - nothing else marks
 * the schedule stale (a task simply becoming overdue by day rollover, or a
 * session marked completed, are both explicitly "no staleness by itself").
 *
 * All three compare a row's own `updatedAt` against `lastRunAt`, not against
 * each other or "now" - `updatedAt` equals `createdAt` at insert time, and
 * apply_schedule_update (Ticket 4) touches every included task and bumps
 * schedule_runs.updated_at in the same transaction, so anything the last run
 * already accounted for reads as updatedAt <= lastRunAt, not stale.
 */
export function computeStaleness(params: {
  today: Date;
  lastRunAt: Date | null;
  flexibleTasks: FlexibleTask[];
  scheduledSessions: ScheduledSession[];
  events: CalendarEvent[];
}): StalenessResult {
  const { today, lastRunAt, flexibleTasks, scheduledSessions, events } = params;
  const reasons: string[] = [];

  const lastRunMs = lastRunAt ? lastRunAt.getTime() : null;
  const changedSince = (iso: string) => lastRunMs === null || new Date(iso).getTime() > lastRunMs;

  const changedTaskCount = flexibleTasks.filter((t) => changedSince(t.updatedAt)).length;
  if (changedTaskCount > 0) reasons.push(plural(changedTaskCount, "new or edited task"));

  const missedCount = scheduledSessions.filter(
    (s) => s.completionStatus === "missed" && changedSince(s.updatedAt),
  ).length;
  if (missedCount > 0) reasons.push(plural(missedCount, "missed session"));

  // Only today-or-future sessions represent a live, still-visible placement
  // that a new fixed event could actually collide with on the grid - a
  // conflict against a past session is moot, nothing left to reschedule.
  const todayISO = toISODate(today);
  const upcomingSessions = scheduledSessions.filter((s) => s.date >= todayISO);
  let conflictCount = 0;
  for (const session of upcomingSessions) {
    const sessionDate = new Date(session.date + "T00:00:00");
    const conflicts = events.some((event) => {
      if (!eventOccursOnDate(event, sessionDate)) return false;
      if (event.allDay) return true;
      if (event.start === null || event.end === null) return false;
      return session.start < event.end && session.end > event.start;
    });
    if (conflicts) conflictCount++;
  }
  if (conflictCount > 0) reasons.push(plural(conflictCount, "schedule conflict"));

  return { stale: reasons.length > 0, reasons };
}
