export interface Category {
  id: string;
  name: string;
  color: string;
  checked: boolean;
  /** True only for the one reserved category Google Calendar imports land
   *  in. Imported events are read-only mirrors of real Google events, so
   *  this category is excluded from new event/task creation and can't be
   *  renamed (see CategoryRow.tsx). */
  isGoogleImport: boolean;
}

export type EventType = "fixed" | "flexible";
/** 'google' events are read-only imported copies, replaced wholesale on
 *  each import, never edited in place. */
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
 *  scheduled_sessions row, not on this record. */
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
  updatedAt: string; // ISO timestamp - equals createdAt at insert time, bumped by the DB
  // trigger on every update (including the status update Update Schedule
  // itself performs). The staleness check compares this against
  // schedule_runs.updated_at to tell "changed since the last run" apart
  // from "just re-confirmed by that same run."
}

export type SessionCompletionStatus = "unresolved" | "completed" | "missed";

/** Structured facts captured at solve time, turned into an explanation
 *  later at display time. Captured now because "why" describes calendar
 *  state at the moment of solving, which can't be reconstructed
 *  afterward. Limited to what the solver's actual inputs/outputs can
 *  honestly support (tier composition, calendar adjacency) - not a claim
 *  about its internal search (e.g. "beat task X for this slot"), which the
 *  result data alone can't prove. */
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

/** POST /api/import-google-calendar response. "not_connected" is distinct
 *  from "error" - it means the request succeeded but this user has no
 *  usable Google credentials (never connected, or their refresh token was
 *  revoked), which the UI should offer to fix by signing in again rather
 *  than treating as a generic failure to retry. */
export type ImportGoogleCalendarResponse =
  | { status: "ok"; events: CalendarEvent[] }
  | { status: "not_connected" }
  | { status: "error"; message: string };
