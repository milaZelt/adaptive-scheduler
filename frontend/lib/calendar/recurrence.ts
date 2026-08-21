import type { CalendarEvent, CustomRecurrence, RepeatOption } from "./types";
import { DOW_LONG, MONTH_SHORT } from "./constants";
import { parseLocalDate, toISODate } from "./dateUtils";

function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]}`;
}

export function defaultCustomRecurrence(anchorDate: Date): CustomRecurrence {
  return {
    interval: 1,
    unit: "week",
    daysOfWeek: [anchorDate.getDay()],
    endType: "never",
    endDate: "",
    endCount: 1,
  };
}

/** Static label for the non-custom Repeat dropdown options, matching Google Calendar's pattern. */
export function repeatOptionLabel(
  option: Exclude<RepeatOption, "custom">,
  anchorDate: Date,
): string {
  switch (option) {
    case "none":
      return "Does not repeat";
    case "daily":
      return "Daily";
    case "weekly":
      return `Weekly on ${DOW_LONG[anchorDate.getDay()]}`;
    case "monthly":
      return `Monthly on the ${ordinal(anchorDate.getDate())}`;
    case "annually":
      return `Annually on ${MONTH_SHORT[anchorDate.getMonth()]} ${anchorDate.getDate()}`;
    case "weekday":
      return "Every weekday (Mon–Fri)";
  }
}

function formatShortDate(iso: string): string {
  const d = parseLocalDate(iso);
  if (isNaN(d.getTime())) return iso;
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Live "Every 2 weeks on Monday, Wednesday, until Dec 1, 2026" style summary. */
export function formatCustomRecurrenceSummary(rule: CustomRecurrence): string {
  const unitWord = { day: "day", week: "week", month: "month", year: "year" }[rule.unit];
  const unitLabel = rule.interval === 1 ? unitWord : `${unitWord}s`;
  let text = rule.interval === 1 ? `Every ${unitLabel}` : `Every ${rule.interval} ${unitLabel}`;

  if (rule.unit === "week" && rule.daysOfWeek.length > 0) {
    const names = [...rule.daysOfWeek].sort((a, b) => a - b).map((d) => DOW_LONG[d]);
    text += ` on ${names.join(", ")}`;
  }

  if (rule.endType === "on" && rule.endDate) {
    text += `, until ${formatShortDate(rule.endDate)}`;
  } else if (rule.endType === "after" && rule.endCount) {
    text += `, ${rule.endCount} time${rule.endCount === 1 ? "" : "s"}`;
  }

  return text;
}

/** Interval + day-of-week selection + end condition must all be sane before saving. */
export function isValidCustomRecurrence(rule: CustomRecurrence): boolean {
  if (!Number.isFinite(rule.interval) || rule.interval < 1) return false;
  if (rule.unit === "week" && rule.daysOfWeek.length === 0) return false;
  if (rule.endType === "on") {
    const d = parseLocalDate(rule.endDate);
    if (!rule.endDate || isNaN(d.getTime())) return false;
  }
  if (rule.endType === "after" && (!Number.isFinite(rule.endCount) || rule.endCount < 1)) {
    return false;
  }
  return true;
}

function daysBetween(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / (24 * 60 * 60 * 1000));
}

function startOfWeekSunday(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

function weeksBetween(a: Date, b: Date): number {
  return Math.floor(daysBetween(startOfWeekSunday(a), startOfWeekSunday(b)) / 7);
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function matchesCustomRuleOnDate(rule: CustomRecurrence, anchor: Date, date: Date): boolean {
  const interval = Math.max(1, rule.interval || 1);
  switch (rule.unit) {
    case "day": {
      const diff = daysBetween(anchor, date);
      return diff >= 0 && diff % interval === 0;
    }
    case "week": {
      const diffWeeks = weeksBetween(anchor, date);
      if (diffWeeks < 0 || diffWeeks % interval !== 0) return false;
      const days = rule.daysOfWeek.length > 0 ? rule.daysOfWeek : [anchor.getDay()];
      return days.includes(date.getDay());
    }
    case "month": {
      const diffMonths = monthsBetween(anchor, date);
      return diffMonths >= 0 && diffMonths % interval === 0 && date.getDate() === anchor.getDate();
    }
    case "year": {
      const diffYears = date.getFullYear() - anchor.getFullYear();
      return (
        diffYears >= 0 &&
        diffYears % interval === 0 &&
        date.getMonth() === anchor.getMonth() &&
        date.getDate() === anchor.getDate()
      );
    }
    default:
      return false;
  }
}

// Safety cap on how far back we'll walk day-by-day to count "after N
// occurrences" custom recurrences - plenty for a personal scheduler, and
// keeps a single membership check bounded even for very old anchor dates.
const MAX_OCCURRENCE_WALK_DAYS = 3660;

function countCustomOccurrencesUpTo(rule: CustomRecurrence, anchor: Date, target: Date): number {
  const span = Math.min(daysBetween(anchor, target), MAX_OCCURRENCE_WALK_DAYS);
  if (span < 0) return 0;
  let count = 0;
  const cursor = new Date(anchor);
  for (let i = 0; i <= span; i++) {
    if (matchesCustomRuleOnDate(rule, anchor, cursor)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/**
 * Does `event`'s recurrence rule produce an occurrence on `date`?
 * Recurrence is expanded client-side from the single saved rule, not
 * stored as one row per occurrence. Editing or deleting a recurring event
 * always acts on the whole series - there's no per-occurrence override.
 */
export function eventOccursOnDate(event: CalendarEvent, date: Date): boolean {
  const anchor = parseLocalDate(event.date);
  if (isNaN(anchor.getTime())) return false;

  const repeat = event.repeat ?? "none";
  if (repeat === "none") {
    return toISODate(date) === event.date;
  }

  if (daysBetween(anchor, date) < 0) return false;

  switch (repeat) {
    case "daily":
      return true;
    case "weekly":
      return date.getDay() === anchor.getDay();
    case "monthly":
      return date.getDate() === anchor.getDate();
    case "annually":
      return date.getMonth() === anchor.getMonth() && date.getDate() === anchor.getDate();
    case "weekday": {
      const dow = date.getDay();
      return dow >= 1 && dow <= 5;
    }
    case "custom": {
      const rule = event.customRecurrence;
      if (!rule) return false;
      if (!matchesCustomRuleOnDate(rule, anchor, date)) return false;
      if (rule.endType === "on" && rule.endDate) {
        const end = parseLocalDate(rule.endDate);
        if (!isNaN(end.getTime()) && daysBetween(end, date) > 0) return false;
      } else if (rule.endType === "after" && rule.endCount) {
        const occurrenceNumber = countCustomOccurrencesUpTo(rule, anchor, date);
        if (occurrenceNumber > rule.endCount) return false;
      }
      return true;
    }
    default:
      return false;
  }
}
