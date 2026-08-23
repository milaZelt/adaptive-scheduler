import type { CalendarEvent, FlexibleTask, ScheduledSession } from "./types";
import { eventOccursOnDate } from "./recurrence";
import { parseLocalDate, toISODate } from "./dateUtils";

export interface StalenessResult {
  stale: boolean;
  reasons: string[];
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Only three things make the schedule stale: new/edited tasks, missed
 * sessions, or new conflicts. Becoming overdue, or marking a session
 * completed, does NOT make it stale by itself.
 *
 * We compare each row's `updatedAt` to `lastRunAt`, never to "now". A row's
 * `updatedAt` starts equal to `createdAt`, and every successful run bumps
 * both together - so anything the last run already saw is not stale.
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

  // Only look at today-or-later sessions. A past session can't really
  // conflict with anything - there's nothing left to reschedule.
  const todayISO = toISODate(today);
  const upcomingSessions = scheduledSessions.filter((s) => s.date >= todayISO);
  let conflictCount = 0;
  for (const session of upcomingSessions) {
    const sessionDate = parseLocalDate(session.date);
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
