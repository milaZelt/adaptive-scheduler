import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/routeAuth";
import { PLANNING_HORIZON_DAYS } from "@/lib/calendar/constants";
import {
  dayOffsetInHorizon,
  getPlanningHorizon,
  parseRequestNowHour,
  parseRequestToday,
  type PlanningHorizon,
} from "@/lib/calendar/horizon";
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

/** SolverBusyInterval plus a display name. The solver never sees the title
 *  itself (we strip it before sending), but we need it to explain the
 *  schedule later. */
interface NamedBusyInterval extends SolverBusyInterval {
  title: string;
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

// Only applies to anonymous "Try Demo" users - real accounts have no limit.
// Stored in memory per server, so it resets on restart. Fine for this
// project's scale.
//
// A generous ceiling, not a tight budget - real demo usage stays well under
// 20 (6 seeded tasks + 5 more the client allows). This just stops scripted
// abuse. Keep it with headroom instead of tracking the real max exactly -
// that's what broke once before, when the seed data grew and this number
// didn't.
const DEMO_MAX_TASKS = 20;
const DEMO_RATE_LIMIT = 5;
const DEMO_RATE_WINDOW_MS = 60_000;
const demoRequestLog = new Map<string, number[]>();

// Records this request and checks the limit - not a pure check, it also
// writes to demoRequestLog (hence the name). Also drops any other user's
// fully-expired entry first, so the map doesn't grow forever while the
// server keeps running.
function recordAndCheckDemoRateLimit(userId: string): boolean {
  const now = Date.now();
  for (const [id, timestamps] of demoRequestLog) {
    if (timestamps.every((t) => now - t >= DEMO_RATE_WINDOW_MS)) {
      demoRequestLog.delete(id);
    }
  }

  const recent = (demoRequestLog.get(userId) ?? []).filter((t) => now - t < DEMO_RATE_WINDOW_MS);
  recent.push(now);
  demoRequestLog.set(userId, recent);
  return recent.length > DEMO_RATE_LIMIT;
}

// Each step function below returns either the data the next step needs, or a
// ready NextResponse (error, or "blocked"). The caller just checks
// `instanceof NextResponse` and returns it as-is - so POST reads as a simple
// top-to-bottom list of steps.

async function parseToday(request: Request): Promise<NextResponse | { today: Date; nowHour: number }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Malformed request body.", 400);
  }

  const todayDate = parseRequestToday(body);
  if (!todayDate) return errorResponse("Missing or malformed 'today'.", 400);

  const nowHour = parseRequestNowHour(body);
  if (nowHour === null) return errorResponse("Missing or malformed 'nowHour'.", 400);

  return { today: todayDate, nowHour };
}

/** A non-null return means "stop and send this back" - either a DB error,
 *  or a "blocked" response listing what needs resolving first. Null means
 *  nothing was unresolved, so the caller should continue. */
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

/** Expands fixed events into the flat busy-interval shape the solver wants,
 *  one per horizon day. Each interval keeps its title too, but only for
 *  explaining the schedule later - the actual solver request strips titles
 *  back out. All-day events block the entire day, not just the solver's
 *  normal hours. */
async function gatherBusyIntervals(
  supabase: SupabaseClient,
  userId: string,
  horizon: PlanningHorizon,
): Promise<NextResponse | NamedBusyInterval[]> {
  const { data: eventRows, error } = await supabase.from("events").select("*").eq("user_id", userId);
  if (error) {
    return errorResponse("Couldn't load your fixed events.", 500);
  }

  const events = ((eventRows ?? []) as EventRow[]).map(eventFromRow);
  const busyIntervals: NamedBusyInterval[] = [];
  for (let dayOffset = 0; dayOffset < horizon.days.length; dayOffset++) {
    const day = horizon.days[dayOffset];
    for (const event of events) {
      if (!eventOccursOnDate(event, day)) continue;
      if (event.allDay) {
        busyIntervals.push({ day: dayOffset, start_hour: 0, end_hour: 24, title: event.title });
      } else if (event.start !== null && event.end !== null) {
        busyIntervals.push({ day: dayOffset, start_hour: event.start, end_hour: event.end, title: event.title });
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

/** Sorts every flexible task into two groups: resolved without the solver
 *  (overdue, outside the horizon, or already fully done), and sent to the
 *  solver. For the second group, remaining_minutes already subtracts every
 *  completed session for that task, no matter its date (see the comment
 *  below for why that matters). */
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
    // We check this instead of assuming it. The UI and a DB constraint both
    // keep deadlines inside the horizon, but if a row ever breaks that rule,
    // it shouldn't quietly corrupt a solve.
    if (deadlineDayOffset >= PLANNING_HORIZON_DAYS) {
      resolvedStatuses.set(task.id, "couldnt_fit");
      continue;
    }

    const requiredMinutes = Math.round(task.estimateHours * 60);
    // Not limited to "before today" - this run is about to delete and
    // replace every session in the whole horizon, including today. So a
    // session completed earlier today still counts; skipping it would
    // silently lose real progress.
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

/** Fully stateless (see backend/api). An empty task list skips the solver
 *  call entirely. */
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
    // FastAPI's HTTPException (e.g. "solver failed to converge") doesn't
    // throw, so the backend logs have no trace of it - the real reason only
    // lives in the response body. We log it here and also send it to the
    // client, since this is a solo-user tool with no one else to hide it
    // from.
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

/** Built only from the already-validated `all_sessions` (grouped by task),
 *  never from task_results[x].sessions - validating one version of the
 *  response and then saving a different one would defeat the point of
 *  validating at all. Also sets the final scheduled/couldn't-fit status for
 *  every task the solver saw. */
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

    // Easy to compute here, from just this task's tier and the full task
    // list already in scope. blockedBy is different - it needs data from
    // every task's sessions, which don't all exist yet, so
    // attachBlockedByReasons fills that in later.
    const otherTierTasksCount = allTasks.filter((t) => t.priority === task.priority && t.id !== task.id).length;

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
          otherTierTasksCount,
          blockedBy: null,
        },
      });
    });
  }

  return sessionsToInsert;
}

// Loose enough to survive small rounding errors, tight enough to only credit
// something that's plausibly the real reason (the solver's 30-min padding
// rule) - not just anything earlier that day. This is only used to explain
// the schedule to the user; it never affects the actual schedule.
const BLOCKED_BY_WINDOW_HOURS = 32 / 60;

interface BlockerCandidate {
  title: string;
  start: number;
  end: number;
  gap: number; // decimal hours between this candidate's end and the session's start
}

/** Adds {title, start, end} as a blockedBy candidate if it ends close enough
 *  before sessionStart. Shared by both candidate sources below (a fixed
 *  event, or another task's session). */
function addBlockerCandidateIfClose(
  candidates: BlockerCandidate[],
  sessionStart: number,
  title: string,
  start: number,
  end: number,
): void {
  const gap = sessionStart - end;
  if (gap >= 0 && gap <= BLOCKED_BY_WINDOW_HOURS) {
    candidates.push({ title, start, end, gap });
  }
}

/** For each session, finds the nearest same-day thing that ends right
 *  before it starts (a fixed event, or another task's session) - that's the
 *  likely reason it couldn't be placed earlier. Fills in
 *  placement_reason.blockedBy. Mutates sessionsToInsert in place; nothing
 *  else holds a reference to it yet, so that's safe. */
function attachBlockedByReasons(
  sessionsToInsert: SessionToInsert[],
  namedBusyIntervals: NamedBusyInterval[],
  allTasks: FlexibleTask[],
  horizon: PlanningHorizon,
): void {
  const taskById = new Map(allTasks.map((t) => [t.id, t]));

  for (const session of sessionsToInsert) {
    const candidates: BlockerCandidate[] = [];

    for (const nbi of namedBusyIntervals) {
      if (toISODate(horizon.days[nbi.day]) !== session.date) continue;
      addBlockerCandidateIfClose(candidates, session.start_time, nbi.title, nbi.start_hour, nbi.end_hour);
    }
    for (const other of sessionsToInsert) {
      // Skip the same session, and skip other sessions of the same task. The
      // solver does pad between two sessions of one task, but naming a task
      // as its own blocker would just be confusing, not helpful.
      if (other === session || other.task_id === session.task_id || other.date !== session.date) continue;
      // Should never actually happen (every task_id here comes from
      // allTasks). Kept as a safe fallback anyway, since this text gets
      // shown to the user as "your ___".
      const otherTitle = taskById.get(other.task_id)?.title ?? "other session";
      addBlockerCandidateIfClose(candidates, session.start_time, otherTitle, other.start_time, other.end_time);
    }

    if (candidates.length === 0) continue;
    const nearest = candidates.reduce((a, b) => (a.gap <= b.gap ? a : b));
    session.placement_reason.blockedBy = { title: nearest.title, start: nearest.start, end: nearest.end };
  }
}

/** Deletes, inserts, and updates statuses - all as one RPC call, so it's
 *  atomic. The JS Supabase client can't do multi-statement transactions on
 *  its own. */
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
    // apply_schedule_update always saves a schedule_runs row in the same
    // transaction as the writes above, which already succeeded. So a
    // missing row here means something is really wrong - we shouldn't paper
    // over it with a fake timestamp.
    return errorResponse("Schedule saved, but couldn't confirm the run time. Please refresh.", 500);
  }

  return {
    flexibleTasks: ((freshTaskRows ?? []) as FlexibleTaskRow[]).map(flexibleTaskFromRow),
    scheduledSessions: ((freshSessionRows ?? []) as ScheduledSessionRow[]).map(scheduledSessionFromRow),
    lastRunAt: scheduleRunRow.updated_at,
  };
}

// Vercel's default function timeout (10s on the Hobby plan) is shorter
// than a cold Render free-tier instance can take to wake up. Without
// this, the very first solve after any idle period gets killed by Vercel
// before the solver even responds.
export const maxDuration = 60;

export async function POST(request: Request) {
  const parsedToday = await parseToday(request);
  if (parsedToday instanceof NextResponse) return parsedToday;
  const { today: todayDate, nowHour } = parsedToday;

  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) return errorResponse("Not authenticated.", 401);

  if (user.is_anonymous && recordAndCheckDemoRateLimit(user.id)) {
    return errorResponse("Too many requests - please wait a moment and try again.", 429);
  }

  const horizon = getPlanningHorizon(todayDate);

  const blockedOrError = await checkForUnresolvedPastSessions(supabase, user.id, horizon);
  if (blockedOrError) return blockedOrError;

  const namedBusyIntervals = await gatherBusyIntervals(supabase, user.id, horizon);
  if (namedBusyIntervals instanceof NextResponse) return namedBusyIntervals;
  // The solver only needs day/start/end - title is only for explaining the
  // schedule later (see attachBlockedByReasons).
  const busyIntervals: SolverBusyInterval[] = namedBusyIntervals.map(({ day, start_hour, end_hour }) => ({
    day,
    start_hour,
    end_hour,
  }));

  // Blocks whatever time has already passed today, so nothing gets placed
  // earlier than right now (e.g. running this at 3pm shouldn't place
  // anything at 10am). Kept separate from namedBusyIntervals on purpose -
  // "it's already 3pm" doesn't need a "why this slot" explanation the way a
  // real event does.
  if (nowHour > 0) {
    busyIntervals.push({ day: 0, start_hour: 0, end_hour: nowHour });
  }

  const eligible = await gatherEligibleTasks(supabase, user.id, horizon);
  if (eligible instanceof NextResponse) return eligible;
  const { solverTasks, allTasks, resolvedStatuses } = eligible;

  if (user.is_anonymous && solverTasks.length > DEMO_MAX_TASKS) {
    return errorResponse(`Demo accounts are limited to ${DEMO_MAX_TASKS} tasks.`, 403);
  }

  const solverResult = await callSolver(solverTasks, busyIntervals);
  if (solverResult instanceof NextResponse) return solverResult;

  // Validate the solver's response as untrusted input before acting on it.
  const sentTaskIds = new Set(solverTasks.map((t) => t.id));
  const validationError = validateSolverResponse(solverResult, sentTaskIds, busyIntervals);
  if (validationError) {
    return errorResponse(`Scheduling service returned an unexpected result: ${validationError}`, 502);
  }

  const sessionsToInsert = buildSessionsToInsert(solverResult, allTasks, horizon, resolvedStatuses);
  attachBlockedByReasons(sessionsToInsert, namedBusyIntervals, allTasks, horizon);

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

  // Checks that the two parts of the response agree: a task marked
  // scheduled=true must actually have sessions in all_sessions, and vice
  // versa. Don't trust either one alone.
  for (const [taskId, taskResult] of Object.entries(result.task_results)) {
    const hasSessions = (sessionCountByTask.get(taskId) ?? 0) > 0;
    if (taskResult.scheduled && !hasSessions) {
      return `task ${taskId} marked scheduled but has no sessions`;
    }
    if (!taskResult.scheduled && hasSessions) {
      return `task ${taskId} marked unscheduled but has sessions`;
    }
  }

  // Basic overlap check, just a backstop - not a full copy of the solver's
  // 30-min padding rule, just "nothing directly overlaps."
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
