import { PLANNING_HORIZON_DAYS } from "./constants";
import { addDays, parseLocalDate, toISODate } from "./dateUtils";

export interface PlanningHorizon {
  today: Date;
  /** PLANNING_HORIZON_DAYS consecutive dates, starting today (day 0). */
  days: Date[];
  startISO: string;
  endISO: string;
}

/**
 * The planning window, starting from `today`. Both the solver and the
 * schedule-delete range use this same function, so the dates can't drift
 * apart.
 *
 * `today` always comes from the browser's own clock, sent by the client -
 * the server never guesses the time zone.
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
 * Day offset of `dateISO` from the horizon's first day (0-indexed, same as
 * the solver). Negative means it's before the horizon, i.e. overdue.
 * Callers should still check the upper bound too - see the comment on
 * `flexible_tasks.deadline` in migration 0003.
 */
export function dayOffsetInHorizon(horizon: PlanningHorizon, dateISO: string): number {
  const target = parseLocalDate(dateISO);
  const start = horizon.days[0];
  const utcTarget = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const utcStart = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  return Math.round((utcTarget - utcStart) / (24 * 60 * 60 * 1000));
}

/**
 * Gets `today` (the client's local date) out of a request body. Every
 * route uses this and wraps it in its own try/catch for its own error
 * response - this just returns null if it's missing or malformed.
 */
export function parseRequestToday(body: unknown): Date | null {
  const today = (body as { today?: unknown })?.today;
  if (typeof today !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const todayDate = parseLocalDate(today);
  return isNaN(todayDate.getTime()) ? null : todayDate;
}

/**
 * Gets `nowHour` (the client's current time as a decimal hour, e.g. 15.5
 * for 3:30pm) out of a request body. This tells Update Schedule which part
 * of today has already passed, so it never places a session earlier than
 * right now. Returns null if malformed.
 */
export function parseRequestNowHour(body: unknown): number | null {
  const nowHour = (body as { nowHour?: unknown })?.nowHour;
  if (typeof nowHour !== "number" || !Number.isFinite(nowHour)) return null;
  return nowHour >= 0 && nowHour < 24 ? nowHour : null;
}
