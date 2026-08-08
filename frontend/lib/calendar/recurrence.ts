import type { CustomRecurrence, RepeatOption } from "./types";
import { DOW_LONG, MONTH_SHORT } from "./constants";

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
  const d = new Date(iso + "T00:00:00");
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
