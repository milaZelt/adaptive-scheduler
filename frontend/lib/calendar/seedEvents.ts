import type { CalendarEvent } from "./types";
import { toISODate, addDays } from "./dateUtils";

let idCounter = 1;
function nextId(): string {
  return `evt-${idCounter++}`;
}

/**
 * Generates a deterministic set of fake/local events across a demo window
 * so the calendar has something to show in Day/Week/Month views without a
 * backend. Replace with a real data source (the Supabase `events` table)
 * once Phase 2 wires it up — everything downstream only depends on the
 * CalendarEvent[] shape.
 */
export function generateSeedEvents(): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const start = new Date(2026, 6, 26); // Jul 26, 2026
  const end = new Date(2026, 8, 6); // Sep 6, 2026

  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const iso = toISODate(d);
    const dow = d.getDay();

    if (iso === "2026-08-06") {
      events.push({
        id: nextId(),
        title: "Finish Reading",
        date: iso,
        allDay: false,
        start: 15,
        end: 17,
        categoryId: "study",
        type: "flexible",
        description: "Chapters 4–6 for seminar discussion.",
        priority: "Medium",
        timeEstimateMode: "single",
        timeEstimateValue: 2,
        timeEstimateMin: null,
        timeEstimateMax: null,
        splitOk: true,
        sessionMin: 0.5,
        sessionMax: 1,
      });
    } else if (dow === 0 || dow === 6) {
      events.push({
        id: nextId(),
        title: "Friends",
        date: iso,
        allDay: false,
        start: 14,
        end: 16,
        categoryId: "friends",
        type: "fixed",
        description: "Catch up over coffee.",
        repeat: "none",
      });
    } else if (dow === 1 || dow === 3 || dow === 5) {
      events.push({
        id: nextId(),
        title: "Classes",
        date: iso,
        allDay: false,
        start: 9,
        end: 11,
        categoryId: "classes",
        type: "fixed",
        description: "Lecture + discussion section.",
        repeat: "weekday",
      });
      events.push({
        id: nextId(),
        title: "Study Time",
        date: iso,
        allDay: false,
        start: 11,
        end: 13,
        categoryId: "study",
        type: "fixed",
        description: "",
        repeat: "none",
      });
    } else {
      events.push({
        id: nextId(),
        title: "Study Time",
        date: iso,
        allDay: false,
        start: 10,
        end: 13,
        categoryId: "study",
        type: "fixed",
        description: "",
        repeat: "none",
      });
    }

    events.push({
      id: nextId(),
      title: "Sleep",
      date: iso,
      allDay: false,
      start: 22,
      end: 23.99,
      categoryId: "sleep",
      type: "fixed",
      description: "",
      repeat: "daily",
    });
  }

  events.push({
    id: nextId(),
    title: "Conference",
    date: "2026-08-04",
    allDay: true,
    start: null,
    end: null,
    categoryId: "events",
    type: "fixed",
    description: "Annual industry conference, downtown convention center.",
    repeat: "none",
  });

  return events;
}
