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
export type TimeEstimateMode = "single" | "range";
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

  // flexible-event-only fields
  priority?: Priority;
  timeEstimateMode?: TimeEstimateMode;
  timeEstimateValue?: number | null;
  timeEstimateMin?: number | null;
  timeEstimateMax?: number | null;
  splitOk?: boolean;
  sessionMin?: number | null;
  sessionMax?: number | null;
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

export interface FlexibleEventFormState {
  mode: "create" | "edit";
  id: string | null;
  type: "flexible";
  title: string;
  timeEstimateMode: TimeEstimateMode;
  timeEstimateValue: number | null;
  timeEstimateMin: number | null;
  timeEstimateMax: number | null;
  splitOk: boolean;
  sessionMin: number | null;
  sessionMax: number | null;
  description: string;
  priority: Priority | "";
  categoryId: string;
}
