export interface Category {
  id: string;
  name: string;
  color: string;
  checked: boolean;
}

export type EventType = "fixed" | "flexible";
export type RepeatOption =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "annually"
  | "weekday"
  | "custom";
export type Priority = "High" | "Medium" | "Low";
export type ViewType = "day" | "week" | "month";

export type RecurrenceUnit = "day" | "week" | "month" | "year";
export type RecurrenceEndType = "never" | "on" | "after";

/** Only populated when repeat === "custom" — Google Calendar's "Custom..." pattern. */
export interface CustomRecurrence {
  interval: number;
  unit: RecurrenceUnit;
  /** 0=Sun … 6=Sat. Only meaningful when unit === "week". */
  daysOfWeek: number[];
  endType: RecurrenceEndType;
  endDate: string; // ISO date, used when endType === "on"
  endCount: number; // used when endType === "after"
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // ISO 'YYYY-MM-DD'
  allDay: boolean;
  start: number | null; // decimal hour, e.g. 9.5 = 9:30am
  end: number | null;
  categoryId: string;
  type: EventType;
  description?: string;
  repeat?: RepeatOption;
  customRecurrence?: CustomRecurrence;
}

/** Shape logged to console on tear-sheet Save (no backend submit yet). */
export interface FixedEventFormState {
  mode: "create" | "edit";
  id: string | null;
  type: "fixed";
  title: string;
  date: string;
  allDay: boolean;
  start: number | null;
  end: number | null;
  repeat: RepeatOption;
  customRecurrence: CustomRecurrence | null;
  description: string;
  categoryId: string;
}

export type SchedulingStatus = "not_yet_scheduled" | "scheduled" | "couldnt_fit" | "overdue";

/** A flexible task definition - solver input. Never has a date/time of its
 *  own; once Update Schedule places it, the placement lives as a separate
 *  scheduled_sessions row (Ticket 4), not on this record. */
export interface FlexibleTask {
  id: string;
  title: string;
  categoryId: string;
  priority: Priority;
  deadline: string; // ISO 'YYYY-MM-DD', always within the current planning horizon
  estimateHours: number; // required duration - the user decides how much, Nextly decides when
  splitOk: boolean;
  sessionMin: number | null;
  sessionMax: number | null;
  description?: string;
  schedulingStatus: SchedulingStatus;
}

export type SessionCompletionStatus = "unresolved" | "completed" | "missed";

/** Structured facts captured at solve time - templated into an explanation
 *  at display time (Ticket 6). Captured then because "why" is a claim about
 *  calendar state at the moment of solving, not reconstructable later. */
export interface PlacementReason {
  priority: Priority;
  deadline: string; // the task's deadline at solve time, ISO 'YYYY-MM-DD'
  sessionIndex: number; // 1-based - which of this task's sessions this is
  sessionCount: number; // how many sessions this task was split into
}

/** One placed block of a flexible task - solver output. Read-only in V1
 *  beyond completionStatus; edit/delete happens through the underlying
 *  FlexibleTask or a fresh Update Schedule run, never on this row directly. */
export interface ScheduledSession {
  id: string;
  taskId: string;
  categoryId: string;
  date: string; // ISO 'YYYY-MM-DD'
  start: number; // decimal hour
  end: number;
  placementReason: PlacementReason | null;
  completionStatus: SessionCompletionStatus;
}

/** A past scheduled session the user hasn't answered Completed/Missed for
 *  yet - blocks Update Schedule until resolved (decisions record). */
export interface UnresolvedSessionInfo {
  id: string;
  taskTitle: string;
  date: string;
  start: number;
  end: number;
}

/** POST /api/update-schedule response. */
export type UpdateScheduleResponse =
  | { status: "blocked"; unresolvedSessions: UnresolvedSessionInfo[] }
  | { status: "ok"; flexibleTasks: FlexibleTask[]; scheduledSessions: ScheduledSession[] }
  | { status: "error"; message: string };
