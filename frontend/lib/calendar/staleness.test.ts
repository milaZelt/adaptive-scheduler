import { describe, expect, it } from "vitest";
import type { CalendarEvent, FlexibleTask, ScheduledSession } from "./types";
import { computeStaleness } from "./staleness";

const LAST_RUN = new Date("2026-08-10T12:00:00Z");
const BEFORE_LAST_RUN = "2026-08-10T11:00:00Z";
const AFTER_LAST_RUN = "2026-08-10T13:00:00Z";
const TODAY = new Date(2026, 7, 12); // Aug 12, 2026

function task(overrides: Partial<FlexibleTask>): FlexibleTask {
  return {
    id: "t1",
    title: "Task",
    categoryId: "cat1",
    priority: "Medium",
    deadline: "2026-08-20",
    estimateHours: 1,
    splitOk: false,
    sessionMin: null,
    sessionMax: null,
    schedulingStatus: "scheduled",
    createdAt: BEFORE_LAST_RUN,
    updatedAt: BEFORE_LAST_RUN,
    ...overrides,
  };
}

function session(overrides: Partial<ScheduledSession>): ScheduledSession {
  return {
    id: "s1",
    taskId: "t1",
    categoryId: "cat1",
    date: "2026-08-13",
    start: 9,
    end: 10,
    placementReason: null,
    completionStatus: "unresolved",
    updatedAt: BEFORE_LAST_RUN,
    ...overrides,
  };
}

function event(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: "e1",
    title: "Event",
    date: "2026-08-13",
    allDay: false,
    start: 9,
    end: 10,
    categoryId: "cat1",
    type: "fixed",
    source: "local",
    repeat: "none",
    ...overrides,
  };
}

describe("computeStaleness", () => {
  it("is not stale when nothing changed since the last run", () => {
    const result = computeStaleness({
      today: TODAY,
      lastRunAt: LAST_RUN,
      flexibleTasks: [task({})],
      scheduledSessions: [session({})],
      events: [],
    });
    expect(result).toEqual({ stale: false, reasons: [] });
  });

  it("flags a task edited after the last run", () => {
    const result = computeStaleness({
      today: TODAY,
      lastRunAt: LAST_RUN,
      flexibleTasks: [task({ updatedAt: AFTER_LAST_RUN })],
      scheduledSessions: [],
      events: [],
    });
    expect(result.stale).toBe(true);
    expect(result.reasons).toContain("1 new or edited task");
  });

  it("pluralizes multiple changed tasks", () => {
    const result = computeStaleness({
      today: TODAY,
      lastRunAt: LAST_RUN,
      flexibleTasks: [
        task({ id: "t1", updatedAt: AFTER_LAST_RUN }),
        task({ id: "t2", updatedAt: AFTER_LAST_RUN }),
      ],
      scheduledSessions: [],
      events: [],
    });
    expect(result.reasons).toContain("2 new or edited tasks");
  });

  it("flags a session marked missed after the last run", () => {
    const result = computeStaleness({
      today: TODAY,
      lastRunAt: LAST_RUN,
      flexibleTasks: [],
      scheduledSessions: [session({ completionStatus: "missed", updatedAt: AFTER_LAST_RUN })],
      events: [],
    });
    expect(result.stale).toBe(true);
    expect(result.reasons).toContain("1 missed session");
  });

  it("does not flag a session marked completed", () => {
    const result = computeStaleness({
      today: TODAY,
      lastRunAt: LAST_RUN,
      flexibleTasks: [],
      scheduledSessions: [session({ completionStatus: "completed", updatedAt: AFTER_LAST_RUN })],
      events: [],
    });
    expect(result).toEqual({ stale: false, reasons: [] });
  });

  it("flags an upcoming session that overlaps a fixed event", () => {
    const result = computeStaleness({
      today: TODAY,
      lastRunAt: LAST_RUN,
      flexibleTasks: [],
      scheduledSessions: [session({ date: "2026-08-13", start: 9, end: 10 })],
      events: [event({ date: "2026-08-13", start: 9.5, end: 10.5 })],
    });
    expect(result.stale).toBe(true);
    expect(result.reasons).toContain("1 schedule conflict");
  });

  it("does not flag a session and event on the same day that don't overlap in time", () => {
    const result = computeStaleness({
      today: TODAY,
      lastRunAt: LAST_RUN,
      flexibleTasks: [],
      scheduledSessions: [session({ date: "2026-08-13", start: 9, end: 10 })],
      events: [event({ date: "2026-08-13", start: 11, end: 12 })],
    });
    expect(result).toEqual({ stale: false, reasons: [] });
  });

  it("treats an all-day event as conflicting regardless of session time", () => {
    const result = computeStaleness({
      today: TODAY,
      lastRunAt: LAST_RUN,
      flexibleTasks: [],
      scheduledSessions: [session({ date: "2026-08-13", start: 20, end: 21 })],
      events: [event({ date: "2026-08-13", allDay: true, start: null, end: null })],
    });
    expect(result.reasons).toContain("1 schedule conflict");
  });

  it("ignores a conflict against a session already in the past", () => {
    const result = computeStaleness({
      today: TODAY,
      lastRunAt: LAST_RUN,
      flexibleTasks: [],
      scheduledSessions: [session({ date: "2026-08-01", start: 9, end: 10 })],
      events: [event({ date: "2026-08-01", start: 9, end: 10 })],
    });
    expect(result).toEqual({ stale: false, reasons: [] });
  });

  it("treats every existing row as changed when the schedule has never run", () => {
    const result = computeStaleness({
      today: TODAY,
      lastRunAt: null,
      flexibleTasks: [task({ updatedAt: BEFORE_LAST_RUN })],
      scheduledSessions: [],
      events: [],
    });
    expect(result.stale).toBe(true);
    expect(result.reasons).toContain("1 new or edited task");
  });

  it("reports multiple simultaneous triggers together", () => {
    const result = computeStaleness({
      today: TODAY,
      lastRunAt: LAST_RUN,
      flexibleTasks: [task({ updatedAt: AFTER_LAST_RUN })],
      scheduledSessions: [session({ completionStatus: "missed", updatedAt: AFTER_LAST_RUN })],
      events: [],
    });
    expect(result.reasons).toHaveLength(2);
  });
});
