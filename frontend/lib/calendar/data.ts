export type CategoryId = "classes" | "study" | "sleep" | "friends";

export interface Category {
  id: CategoryId;
  label: string;
  /** Event block background */
  bg: string;
  /** Event block left border / accent */
  border: string;
}

export const categories: Category[] = [
  { id: "classes", label: "Classes", bg: "#f6e3d8", border: "#cf9a6d" },
  { id: "study", label: "Study Time", bg: "#e6ecf0", border: "#8fa8ba" },
  { id: "sleep", label: "Sleep", bg: "#e9e3f0", border: "#9b87b8" },
  { id: "friends", label: "Friends", bg: "#e2f0e5", border: "#7fab8a" },
];

export const defaultActiveCategories: CategoryId[] = [
  "classes",
  "study",
  "sleep",
];

export interface CalendarEvent {
  title: string;
  /** Hour of day, may be fractional (e.g. 9.5 = 9:30) */
  start: number;
  end: number;
  category: CategoryId;
}

/**
 * Deterministic sample schedule based on day-of-week, standing in for the
 * real `events` table until Phase 2 wires up Supabase. Filtered by which
 * categories are currently toggled on.
 */
export function getEventsForDate(
  date: Date,
  activeCategories: ReadonlySet<CategoryId>,
): CalendarEvent[] {
  const dow = date.getDay();
  const events: CalendarEvent[] = [];

  if (dow === 0 || dow === 6) {
    events.push({ title: "Friends", start: 14, end: 16, category: "friends" });
  } else if (dow === 1 || dow === 3 || dow === 5) {
    events.push({ title: "Classes", start: 9, end: 11, category: "classes" });
    events.push({ title: "Study Time", start: 11, end: 13, category: "study" });
  } else {
    events.push({ title: "Study Time", start: 10, end: 13, category: "study" });
  }
  events.push({ title: "Sleep", start: 22, end: 23.99, category: "sleep" });

  return events.filter((e) => activeCategories.has(e.category));
}
