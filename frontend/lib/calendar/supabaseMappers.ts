import type {
  CalendarEvent,
  Category,
  CustomRecurrence,
  EventType,
  FlexibleTask,
  PlacementReason,
  Priority,
  RepeatOption,
  ScheduledSession,
  SchedulingStatus,
  SessionCompletionStatus,
} from "./types";

export interface CategoryRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  checked: boolean;
}

export function categoryFromRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    checked: row.checked,
  };
}

export interface EventRow {
  id: string;
  user_id: string;
  category_id: string;
  title: string;
  event_type: EventType;
  date: string;
  all_day: boolean;
  // PostgREST serializes `numeric` columns as strings to avoid float
  // precision loss, so these arrive as e.g. "9.50", not 9.5.
  start_time: number | string | null;
  end_time: number | string | null;
  description: string | null;
  repeat: RepeatOption;
  custom_recurrence: CustomRecurrence | null;
}

function toNumberOrNull(value: number | string | null): number | null {
  return value === null ? null : Number(value);
}

export function eventFromRow(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    allDay: row.all_day,
    start: toNumberOrNull(row.start_time),
    end: toNumberOrNull(row.end_time),
    categoryId: row.category_id,
    type: row.event_type,
    description: row.description ?? undefined,
    repeat: row.repeat,
    customRecurrence: row.custom_recurrence ?? undefined,
  };
}

/** Partial CalendarEvent -> snake_case row patch, for inserts/updates. */
export function eventToRowPatch(
  patch: Partial<CalendarEvent>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.date !== undefined) row.date = patch.date;
  if (patch.allDay !== undefined) row.all_day = patch.allDay;
  if (patch.start !== undefined) row.start_time = patch.start;
  if (patch.end !== undefined) row.end_time = patch.end;
  if (patch.categoryId !== undefined) row.category_id = patch.categoryId;
  if (patch.type !== undefined) row.event_type = patch.type;
  if (patch.description !== undefined) row.description = patch.description || null;
  if (patch.repeat !== undefined) row.repeat = patch.repeat;
  if (patch.customRecurrence !== undefined) row.custom_recurrence = patch.customRecurrence ?? null;
  return row;
}

export interface FlexibleTaskRow {
  id: string;
  user_id: string;
  category_id: string;
  title: string;
  priority: Priority;
  deadline: string;
  estimate_hours: number | string;
  split_ok: boolean;
  session_min: number | string | null;
  session_max: number | string | null;
  description: string | null;
  scheduling_status: SchedulingStatus;
  created_at: string;
  updated_at: string;
}

export function flexibleTaskFromRow(row: FlexibleTaskRow): FlexibleTask {
  return {
    id: row.id,
    title: row.title,
    categoryId: row.category_id,
    priority: row.priority,
    deadline: row.deadline,
    estimateHours: Number(row.estimate_hours),
    splitOk: row.split_ok,
    sessionMin: toNumberOrNull(row.session_min),
    sessionMax: toNumberOrNull(row.session_max),
    description: row.description ?? undefined,
    schedulingStatus: row.scheduling_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Partial FlexibleTask -> snake_case row patch, for inserts/updates. */
export function flexibleTaskToRowPatch(patch: Partial<FlexibleTask>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.categoryId !== undefined) row.category_id = patch.categoryId;
  if (patch.priority !== undefined) row.priority = patch.priority;
  if (patch.deadline !== undefined) row.deadline = patch.deadline;
  if (patch.estimateHours !== undefined) row.estimate_hours = patch.estimateHours;
  if (patch.splitOk !== undefined) row.split_ok = patch.splitOk;
  if (patch.sessionMin !== undefined) row.session_min = patch.sessionMin;
  if (patch.sessionMax !== undefined) row.session_max = patch.sessionMax;
  if (patch.description !== undefined) row.description = patch.description || null;
  if (patch.schedulingStatus !== undefined) row.scheduling_status = patch.schedulingStatus;
  return row;
}

export interface ScheduledSessionRow {
  id: string;
  user_id: string;
  task_id: string;
  category_id: string;
  date: string;
  start_time: number | string;
  end_time: number | string;
  placement_reason: PlacementReason | null;
  completion_status: SessionCompletionStatus;
  updated_at: string;
}

export function scheduledSessionFromRow(row: ScheduledSessionRow): ScheduledSession {
  return {
    id: row.id,
    taskId: row.task_id,
    categoryId: row.category_id,
    date: row.date,
    start: Number(row.start_time),
    end: Number(row.end_time),
    placementReason: row.placement_reason,
    completionStatus: row.completion_status,
    updatedAt: row.updated_at,
  };
}
