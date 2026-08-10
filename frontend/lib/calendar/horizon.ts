import { PLANNING_HORIZON_DAYS } from "./constants";
import { addDays, toISODate } from "./dateUtils";

export interface PlanningHorizon {
  today: Date;
  /** PLANNING_HORIZON_DAYS consecutive dates, starting today (day 0). */
  days: Date[];
  startISO: string;
  endISO: string;
}

/**
 * The rolling planning window, anchored to `today`. Used identically for
 * both the solve-request range and the Update Schedule delete-scope range
 * (decisions record) - one function, not two independently-written date
 * computations that could quietly drift apart at an edge.
 *
 * `today` must be the caller's own resolved local date - FastAPI never
 * infers a timezone, and neither does this function. The Route Handler
 * that calls this receives `today` as an ISO string from the client (the
 * browser's own `AppStateContext.today`, already resolved from the user's
 * real local clock) rather than ever computing its own server-side "now."
 */
export function getPlanningHorizon(today: Date): PlanningHorizon {
  const days = Array.from({ length: PLANNING_HORIZON_DAYS }, (_, i) => addDays(today, i));
  return {
    today,
    days,
    startISO: toISODate(days[0]),
    endISO: toISODate(days[days.length - 1]),
  };
}

/**
 * 0-indexed day offset of `dateISO` from the horizon's first day, matching
 * the solver's own day-0-through-day-13 convention. Negative means before
 * the horizon (overdue). Callers should still guard the upper bound rather
 * than assume it - see the comment above `flexible_tasks.deadline` in
 * migration 0003.
 */
export function dayOffsetInHorizon(horizon: PlanningHorizon, dateISO: string): number {
  const target = new Date(dateISO + "T00:00:00");
  const start = horizon.days[0];
  const utcTarget = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const utcStart = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  return Math.round((utcTarget - utcStart) / (24 * 60 * 60 * 1000));
}
