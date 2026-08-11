import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { PLANNING_HORIZON_DAYS } from "@/lib/calendar/constants";
import { dayOffsetInHorizon, getPlanningHorizon, type PlanningHorizon } from "@/lib/calendar/horizon";
import { eventOccursOnDate } from "@/lib/calendar/recurrence";
import {
  eventFromRow,
  flexibleTaskFromRow,
  scheduledSessionFromRow,
  type EventRow,
  type FlexibleTaskRow,
  type ScheduledSessionRow,
} from "@/lib/calendar/supabaseMappers";
import { toISODate } from "@/lib/calendar/dateUtils";
import type {
  FlexibleTask,
  PlacementReason,
  ScheduledSession,
  SchedulingStatus,
  UpdateScheduleResponse,
} from "@/lib/calendar/types";

// --- Solver HTTP contract (mirrors backend/api/schemas.py) -----------------

interface SolverBusyInterval {
  day: number;
  start_hour: number;
  end_hour: number;
}

interface SolverTaskIn {
  id: string;
  priority: string;
  deadline_day: number;
  remaining_minutes: number;
  min_session_minutes: number;
  max_session_minutes: number;
  splittable: boolean;
}

interface SolverSessionOut {
  task_id: string;
  day: number;
  start_hour: number;
  end_hour: number;
}

interface SolverTaskResultOut {
  task_id: string;
  scheduled: boolean;
  sessions: SolverSessionOut[];
}

interface SolverResponse {
  task_results: Record<string, SolverTaskResultOut>;
  all_sessions: SolverSessionOut[];
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ status: "error", message } satisfies UpdateScheduleResponse, { status });
}

// Each step below either returns the data the next step needs, or a
// ready-to-return NextResponse (error or, for the pre-solve gate, "blocked")
// - the caller just checks `instanceof NextResponse` and returns it as-is,
// so POST itself reads as a single top-to-bottom sequence of named steps
// rather than one long procedural function.

async function parseToday(request: Request): Promise<NextResponse | Date> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Malformed request body.", 400);
  }

  // "today" is the client's own resolved local date (AppStateContext.today,
  // already computed from the user's real browser clock) - this route never
  // computes its own server-side "now" (decisions record: no server/solver
  // ever infers a timezone).
  const today = (body as { today?: unknown })?.today;
  if (typeof today !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return errorResponse("Missing or malformed 'today'.", 400);
  }
  const todayDate = new Date(today + "T00:00:00");
  if (isNaN(todayDate.getTime())) {
    return errorResponse("Missing or malformed 'today'.", 400);
  }
  return todayDate;
}

async function getAuthenticatedUser(supabase: SupabaseClient): Promise<NextResponse | User> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? errorResponse("Not authenticated.", 401);
}

/** Non-null return means "stop and return this" - either a DB error, or a
 *  successful "blocked" response listing what needs resolving first. Null
 *  means nothing unresolved was found and the caller should proceed. */
async function checkForUnresolvedPastSessions(
  supabase: SupabaseClient,
  userId: string,
  horizon: PlanningHorizon,
): Promise<NextResponse | null> {
  const { data: unresolvedRows, error } = await supabase
    .from("scheduled_sessions")
    .select("id, date, start_time, end_time, flexible_tasks(title)")
    .eq("user_id", userId)
    .lt("date", horizon.startISO)
    .eq("completion_status", "unresolved");

  if (error) {
    return errorResponse("Couldn't check for unresolved past sessions.", 500);
  }
  if (!unresolvedRows || unresolvedRows.length === 0) {
    return null;
  }

  const unresolvedSessions = unresolvedRows.map((row) => {
    const task = row.flexible_tasks as unknown as { title: string } | { title: string }[] | null;
    const taskTitle = Array.isArray(task) ? (task[0]?.title ?? "Untitled task") : (task?.title ?? "Untitled task");
    return {
      id: row.id as string,
      taskTitle,
      date: row.date as string,
      start: Number(row.start_time),
      end: Number(row.end_time),
    };
  });
  return NextResponse.json({ status: "blocked", unresolvedSessions } satisfies UpdateScheduleResponse);
}

/** Fixed events, expanded per horizon day into the flat busy-interval shape
 *  the solver expects. All-day events block the whole day, not just the
 *  solver's own 8AM-11PM window - "all day" means all day. */
async function gatherBusyIntervals(
  supabase: SupabaseClient,
  userId: string,
  horizon: PlanningHorizon,
): Promise<NextResponse | SolverBusyInterval[]> {
  const { data: eventRows, error } = await supabase.from("events").select("*").eq("user_id", userId);
  if (error) {
    return errorResponse("Couldn't load your fixed events.", 500);
  }

  const events = ((eventRows ?? []) as EventRow[]).map(eventFromRow);
  const busyIntervals: SolverBusyInterval[] = [];
  for (let dayOffset = 0; dayOffset < horizon.days.length; dayOffset++) {
    const day = horizon.days[dayOffset];
    for (const event of events) {
      if (!eventOccursOnDate(event, day)) continue;
      if (event.allDay) {
        busyIntervals.push({ day: dayOffset, start_hour: 0, end_hour: 24 });
      } else if (event.start !== null && event.end !== null) {
        busyIntervals.push({ day: dayOffset, start_hour: event.start, end_hour: event.end });
      }
    }
  }
  return busyIntervals;
}

interface EligibleTasks {
  solverTasks: SolverTaskIn[];
  allTasks: FlexibleTask[];
  /** task_id -> the status this run resolves it to, applied after the solve. */
  resolvedStatuses: Map<string, SchedulingStatus>;
}

/** Every flexible task, sorted into "resolved without the solver" (overdue,
 *  out-of-horizon, or already fully covered by completed sessions) versus
 *  "send to the solver" - remaining_minutes for the latter already deducts
 *  every completed session for that task, regardless of date (see the
 *  comment at its use below for why "regardless of date" matters). */
async function gatherEligibleTasks(
  supabase: SupabaseClient,
  userId: string,
  horizon: PlanningHorizon,
): Promise<NextResponse | EligibleTasks> {
  const { data: taskRows, error: tasksError } = await supabase
    .from("flexible_tasks")
    .select("*")
    .eq("user_id", userId);
  if (tasksError) {
    return errorResponse("Couldn't load your flexible tasks.", 500);
  }

  const { data: sessionRows, error: sessionsError } = await supabase
    .from("scheduled_sessions")
    .select("*")
    .eq("user_id", userId);
  if (sessionsError) {
    return errorResponse("Couldn't load your scheduled sessions.", 500);
  }

  const allTasks = ((taskRows ?? []) as FlexibleTaskRow[]).map(flexibleTaskFromRow);
  const allSessions = ((sessionRows ?? []) as ScheduledSessionRow[]).map(scheduledSessionFromRow);

  const solverTasks: SolverTaskIn[] = [];
  const resolvedStatuses = new Map<string, SchedulingStatus>();

  for (const task of allTasks) {
    const deadlineDayOffset = dayOffsetInHorizon(horizon, task.deadline);

    if (deadlineDayOffset < 0) {
      resolvedStatuses.set(task.id, "overdue");
      continue;
    }
    // Guarded, not assumed: flexible_tasks.deadline is constrained to the
    // horizon by both the creation-time UX and a DB CHECK constraint, but a
    // row that somehow violates that shouldn't silently corrupt a solve.
    if (deadlineDayOffset >= PLANNING_HORIZON_DAYS) {
      resolvedStatuses.set(task.id, "couldnt_fit");
      continue;
    }

    const requiredMinutes = Math.round(task.estimateHours * 60);
    // Not date-scoped to "before today": every session below is about to be
    // deleted and replaced by this same run (the RPC's delete range covers
    // the whole horizon, today included), so a session completed earlier
    // today would otherwise have its progress silently dropped - any
    // completed session for this task represents real, already-spent time
    // no matter which horizon window placed it.
    const completedMinutes = allSessions
      .filter((s) => s.taskId === task.id && s.completionStatus === "completed")
      .reduce((sum, s) => sum + Math.round((s.end - s.start) * 60), 0);
    const remainingMinutes = requiredMinutes - completedMinutes;

    if (remainingMinutes <= 0) {
      resolvedStatuses.set(task.id, "scheduled");
      continue;
    }

    const sessionMinutes = task.splitOk
      ? {
          min: Math.round((task.sessionMin ?? task.estimateHours) * 60),
          max: Math.round((task.sessionMax ?? task.estimateHours) * 60),
        }
      : { min: remainingMinutes, max: remainingMinutes };

    solverTasks.push({
      id: task.id,
      priority: task.priority,
      deadline_day: deadlineDayOffset,
      remaining_minutes: remainingMinutes,
      min_session_minutes: sessionMinutes.min,
      max_session_minutes: sessionMinutes.max,
      splittable: task.splitOk,
    });
  }

  return { solverTasks, allTasks, resolvedStatuses };
}

/** Fully stateless (see backend/api) - an empty task list never needs to
 *  reach the solver at all. */
async function callSolver(
  solverTasks: SolverTaskIn[],
  busyIntervals: SolverBusyInterval[],
): Promise<NextResponse | SolverResponse> {
  if (solverTasks.length === 0) {
    return { task_results: {}, all_sessions: [] };
  }

  const solverUrl = process.env.SOLVER_URL;
  const sharedSecret = process.env.SOLVER_SHARED_SECRET;
  if (!solverUrl || !sharedSecret) {
    return errorResponse("Solver service is not configured.", 500);
  }

  let solverRes: Response;
  try {
    solverRes = await fetch(`${solverUrl}/solve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Nextly-Shared-Secret": sharedSecret },
      body: JSON.stringify({
        horizon_days: PLANNING_HORIZON_DAYS,
        busy_intervals: busyIntervals,
        tasks: solverTasks,
      }),
    });
  } catch {
    return errorResponse("Couldn't reach the scheduling service.", 502);
  }

  if (!solverRes.ok) {
    // FastAPI's own HTTPException path (e.g. "solver failed to converge")
    // never throws, so there's no traceback in the backend's logs for
    // this - the only place the actual reason exists is the response body
    // itself, which nothing was reading. Surfaced both server-side (in
    // case it's noisy/technical) and to the client (this is a solo-user
    // tool, not multi-tenant - there's no one else to hide it from).
    const bodyText = await solverRes.text().catch(() => "");
    let detail = bodyText;
    try {
      const parsed = JSON.parse(bodyText);
      if (typeof parsed?.detail === "string") detail = parsed.detail;
    } catch {
      // Not JSON - fall back to the raw text as-is.
    }
    console.error(`Solver returned ${solverRes.status}: ${detail}`);
    return errorResponse(
      `The scheduling service couldn't process this request: ${detail || "unknown error"}`,
      502,
    );
  }

  try {
    return (await solverRes.json()) as SolverResponse;
  } catch {
    return errorResponse("The scheduling service returned an invalid response.", 502);
  }
}

interface SessionToInsert {
  task_id: string;
  category_id: string;
  date: string;
  start_time: number;
  end_time: number;
  placement_reason: PlacementReason;
}

/** Derived entirely from the already-validated `all_sessions` (grouped by
 *  task), not from task_results[x].sessions - validating one representation
 *  of the response and persisting from a different one would defeat the
 *  point of treating the response as untrusted. Also fills in the final
 *  scheduled/couldn't-fit status for every task the solver actually saw. */
function buildSessionsToInsert(
  solverResult: SolverResponse,
  allTasks: FlexibleTask[],
  horizon: PlanningHorizon,
  resolvedStatuses: Map<string, SchedulingStatus>,
): SessionToInsert[] {
  const taskById = new Map(allTasks.map((t) => [t.id, t]));

  const sessionsByTask = new Map<string, SolverSessionOut[]>();
  for (const s of solverResult.all_sessions) {
    if (!sessionsByTask.has(s.task_id)) sessionsByTask.set(s.task_id, []);
    sessionsByTask.get(s.task_id)!.push(s);
  }

  const sessionsToInsert: SessionToInsert[] = [];

  for (const [taskId, result] of Object.entries(solverResult.task_results)) {
    const task = taskById.get(taskId);
    if (!task) continue; // already validated to exist, but keep TS happy
    resolvedStatuses.set(taskId, result.scheduled ? "scheduled" : "couldnt_fit");
    if (!result.scheduled) continue;

    const orderedSessions = (sessionsByTask.get(taskId) ?? []).sort(
      (a, b) => a.day - b.day || a.start_hour - b.start_hour,
    );
    orderedSessions.forEach((s, index) => {
      sessionsToInsert.push({
        task_id: taskId,
        category_id: task.categoryId,
        date: toISODate(horizon.days[s.day]),
        start_time: s.start_hour,
        end_time: s.end_hour,
        placement_reason: {
          priority: task.priority,
          deadline: task.deadline,
          sessionIndex: index + 1,
          sessionCount: orderedSessions.length,
        },
      });
    });
  }

  return sessionsToInsert;
}

/** The transactional delete-then-insert-then-status-update - a single RPC
 *  call so it's atomic, since the JS Supabase client has no multi-statement
 *  transaction support of its own. */
async function persistScheduleUpdate(
  supabase: SupabaseClient,
  userId: string,
  horizon: PlanningHorizon,
  sessionsToInsert: SessionToInsert[],
  resolvedStatuses: Map<string, SchedulingStatus>,
): Promise<NextResponse | null> {
  const taskStatuses = Array.from(resolvedStatuses.entries()).map(([task_id, status]) => ({
    task_id,
    status,
  }));

  const { error } = await supabase.rpc("apply_schedule_update", {
    p_user_id: userId,
    p_start_date: horizon.startISO,
    p_end_date: horizon.endISO,
    p_sessions: sessionsToInsert,
    p_task_statuses: taskStatuses,
  });

  return error ? errorResponse("Couldn't save the new schedule. Please try again.", 500) : null;
}

interface FreshState {
  flexibleTasks: FlexibleTask[];
  scheduledSessions: ScheduledSession[];
  lastRunAt: string;
}

async function fetchFreshState(supabase: SupabaseClient, userId: string): Promise<NextResponse | FreshState> {
  const [{ data: freshTaskRows }, { data: freshSessionRows }, { data: scheduleRunRow }] = await Promise.all([
    supabase.from("flexible_tasks").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
    supabase.from("scheduled_sessions").select("*").eq("user_id", userId),
    supabase.from("schedule_runs").select("updated_at").eq("user_id", userId).maybeSingle(),
  ]);

  if (!scheduleRunRow) {
    // apply_schedule_update always upserts schedule_runs in the same
    // transaction as the writes above, which already succeeded - a missing
    // row here means something is genuinely wrong, not a case to paper over
    // with a fabricated timestamp.
    return errorResponse("Schedule saved, but couldn't confirm the run time. Please refresh.", 500);
  }

  return {
    flexibleTasks: ((freshTaskRows ?? []) as FlexibleTaskRow[]).map(flexibleTaskFromRow),
    scheduledSessions: ((freshSessionRows ?? []) as ScheduledSessionRow[]).map(scheduledSessionFromRow),
    lastRunAt: scheduleRunRow.updated_at,
  };
}

export async function POST(request: Request) {
  const todayDate = await parseToday(request);
  if (todayDate instanceof NextResponse) return todayDate;

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (user instanceof NextResponse) return user;

  const horizon = getPlanningHorizon(todayDate);

  const blockedOrError = await checkForUnresolvedPastSessions(supabase, user.id, horizon);
  if (blockedOrError) return blockedOrError;

  const busyIntervals = await gatherBusyIntervals(supabase, user.id, horizon);
  if (busyIntervals instanceof NextResponse) return busyIntervals;

  const eligible = await gatherEligibleTasks(supabase, user.id, horizon);
  if (eligible instanceof NextResponse) return eligible;
  const { solverTasks, allTasks, resolvedStatuses } = eligible;

  const solverResult = await callSolver(solverTasks, busyIntervals);
  if (solverResult instanceof NextResponse) return solverResult;

  // Validate the solver's response as untrusted input before acting on it.
  const sentTaskIds = new Set(solverTasks.map((t) => t.id));
  const validationError = validateSolverResponse(solverResult, sentTaskIds, busyIntervals);
  if (validationError) {
    return errorResponse(`Scheduling service returned an unexpected result: ${validationError}`, 502);
  }

  const sessionsToInsert = buildSessionsToInsert(solverResult, allTasks, horizon, resolvedStatuses);

  const persistError = await persistScheduleUpdate(supabase, user.id, horizon, sessionsToInsert, resolvedStatuses);
  if (persistError) return persistError;

  const freshState = await fetchFreshState(supabase, user.id);
  if (freshState instanceof NextResponse) return freshState;

  return NextResponse.json({
    status: "ok",
    ...freshState,
  } satisfies UpdateScheduleResponse);
}

function validateSolverResponse(
  result: SolverResponse,
  sentTaskIds: Set<string>,
  busyIntervals: SolverBusyInterval[],
): string | null {
  const resultTaskIds = new Set(Object.keys(result.task_results));
  for (const taskId of resultTaskIds) {
    if (!sentTaskIds.has(taskId)) return `unknown task id in response: ${taskId}`;
  }
  for (const taskId of sentTaskIds) {
    if (!resultTaskIds.has(taskId)) return `missing result for sent task id: ${taskId}`;
  }

  const sessionCountByTask = new Map<string, number>();
  const byDay = new Map<number, Array<{ start: number; end: number }>>();
  for (const session of result.all_sessions) {
    if (!sentTaskIds.has(session.task_id)) return `session for unknown task id: ${session.task_id}`;
    if (session.day < 0 || session.day >= PLANNING_HORIZON_DAYS) {
      return `session day out of horizon: ${session.day}`;
    }
    if (session.end_hour <= session.start_hour) return "session with end <= start";
    if (session.start_hour < 0 || session.end_hour > 24) return "session outside a 24h day";

    sessionCountByTask.set(session.task_id, (sessionCountByTask.get(session.task_id) ?? 0) + 1);
    if (!byDay.has(session.day)) byDay.set(session.day, []);
    byDay.get(session.day)!.push({ start: session.start_hour, end: session.end_hour });
  }

  // Cross-check the two representations of the same result agree - a task
  // marked scheduled=true must actually have session(s) in all_sessions,
  // and vice versa, rather than trusting either one independently.
  for (const [taskId, taskResult] of Object.entries(result.task_results)) {
    const hasSessions = (sessionCountByTask.get(taskId) ?? 0) > 0;
    if (taskResult.scheduled && !hasSessions) {
      return `task ${taskId} marked scheduled but has no sessions`;
    }
    if (!taskResult.scheduled && hasSessions) {
      return `task ${taskId} marked unscheduled but has sessions`;
    }
  }

  // Basic overlap sanity check - not a re-implementation of the solver's
  // 30-min padding rule, just "nothing directly overlaps," as a backstop.
  for (const [day, sessions] of byDay.entries()) {
    const sorted = [...sessions].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].start < sorted[i - 1].end) return `overlapping flexible sessions on day ${day}`;
    }
    for (const busy of busyIntervals.filter((b) => b.day === day)) {
      for (const s of sorted) {
        if (s.start < busy.end_hour && s.end > busy.start_hour) {
          return `flexible session overlaps a fixed event on day ${day}`;
        }
      }
    }
  }

  return null;
}
