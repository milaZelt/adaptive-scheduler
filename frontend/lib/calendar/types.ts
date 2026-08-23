export interface Category {
  id: string;
  name: string;
  color: string;
  checked: boolean;
  /** True only for the special category that holds Google Calendar imports.
   *  These events are read-only copies, so this category can't be picked
   *  for new events/tasks, or renamed (see CategoryRow.tsx). */
  isGoogleImport: boolean;
}

export type EventType = "fixed" | "flexible";
/** 'google' events are read-only copies. Each import fully replaces them -
 *  they're never edited in place. */
export type EventSource = "local" | "google";
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

/** Only set when repeat === "custom" (Google Calendar's "Custom..." pattern). */
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
  source: EventSource;
  /** Only set when source === 'google' - the originating Google event id,
   *  used to de-dup across repeat imports. */
  googleEventId?: string;
}

export type SchedulingStatus = "not_yet_scheduled" | "scheduled" | "couldnt_fit" | "overdue";

/** A flexible task - input to the solver. It never has its own date/time;
 *  once Update Schedule places it, that placement is a separate
 *  scheduled_sessions row. */
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
  createdAt: string; // ISO timestamp
  // ISO timestamp. Starts equal to createdAt, then a DB trigger bumps it on
  // every update (including Update Schedule's own status updates). The
  // staleness check uses this to tell "changed since the last run" from
  // "just confirmed by that same run."
  updatedAt: string;
}

export type SessionCompletionStatus = "unresolved" | "completed" | "missed";

/** Facts captured when the solver runs, used to build a "why here"
 *  explanation later. We capture it now because calendar state at solve
 *  time can't be rebuilt afterward. We only record what the solver's real
 *  input/output can prove (like priority mix and nearby events) - not
 *  internal reasoning we can't verify. */
export interface PlacementReason {
  priority: Priority;
  deadline: string; // the task's deadline at solve time, ISO 'YYYY-MM-DD'
  sessionIndex: number; // 1-based - which of this task's sessions this is
  sessionCount: number; // how many sessions this task was split into
  otherTierTasksCount: number; // other tasks sharing this priority, at solve time
  // The nearest same-day item (fixed event or another flexible session)
  // ending close enough before this session's start to plausibly be why it
  // couldn't land earlier - null if nothing was close enough to credit.
  blockedBy: { title: string; start: number; end: number } | null;
}

/** One placed block of a flexible task - output from the solver. You can
 *  only change its completionStatus directly; everything else changes
 *  through the FlexibleTask or a new Update Schedule run. */
export interface ScheduledSession {
  id: string;
  taskId: string;
  categoryId: string;
  date: string; // ISO 'YYYY-MM-DD'
  start: number; // decimal hour
  end: number;
  placementReason: PlacementReason | null;
  completionStatus: SessionCompletionStatus;
  updatedAt: string; // ISO timestamp - bumped when markSessionCompletion changes this row.
}

/** A past scheduled session the user hasn't answered Completed/Missed for
 *  yet - blocks Update Schedule until resolved. */
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
  | {
      status: "ok";
      flexibleTasks: FlexibleTask[];
      scheduledSessions: ScheduledSession[];
      lastRunAt: string; // ISO timestamp - schedule_runs.updated_at as of this same transaction.
    }
  | { status: "error"; message: string };

/** POST /api/import-google-calendar response. "not_connected" is not an
 *  error - it means this user has no usable Google credentials yet (never
 *  connected, or their token was revoked). The UI should offer "sign in
 *  with Google" here, not a generic retry. */
export type ImportGoogleCalendarResponse =
  | { status: "ok"; events: CalendarEvent[] }
  | { status: "not_connected" }
  | { status: "error"; message: string };
