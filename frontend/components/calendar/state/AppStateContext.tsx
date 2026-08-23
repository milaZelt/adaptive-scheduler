"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type {
  CalendarEvent,
  FlexibleTask,
  ScheduledSession,
  UnresolvedSessionInfo,
  ViewType,
} from "@/lib/calendar/types";
import { addDays, addMonths } from "@/lib/calendar/dateUtils";
import { useCategories, type UseCategoriesResult } from "./useCategories";
import { useEvents, type UseEventsResult } from "./useEvents";
import { useFlexibleTasks, type UseFlexibleTasksResult } from "./useFlexibleTasks";
import { useScheduledSessions, type UseScheduledSessionsResult } from "./useScheduledSessions";
import { useScheduleRuns, type UseScheduleRunsResult } from "./useScheduleRuns";
import { useUpdateSchedule } from "./useUpdateSchedule";
import { useGoogleImport } from "./useGoogleImport";
import { useNote, type UseNoteResult } from "./useNote";
import { useDemoLimits } from "./useDemoLimits";

interface AppState
  extends UseCategoriesResult,
    UseEventsResult,
    UseFlexibleTasksResult,
    UseScheduledSessionsResult,
    UseScheduleRunsResult,
    UseNoteResult {
  /** True during the "Try Demo" session. It's a real account and real
   *  solver, just disposable - this flag turns off things that need a real
   *  identity (like Google Calendar import) and shows the demo banner. */
  isDemo: boolean;
  today: Date;
  updatingSchedule: boolean;
  resolvePrompt: UnresolvedSessionInfo[] | null;
  closeResolvePrompt: () => void;
  updateSchedule: () => Promise<void>;
  importingGoogleCalendar: boolean;
  googleCalendarImported: boolean;
  importGoogleCalendar: () => Promise<void>;
  currentDate: Date;
  currentView: ViewType;
  setView: (v: ViewType) => void;
  navigate: (dir: -1 | 1) => void;
  goToday: () => void;

  // Floating UI (drawer for event forms, modal for detail/confirm)
  drawer: DrawerState | null;
  openFixedEventDrawer: (prefill?: CalendarEvent) => void;
  openFlexibleEventDrawer: (prefill?: FlexibleTask) => void;
  closeDrawer: () => void;

  detailEvent: CalendarEvent | null;
  openEventDetail: (event: CalendarEvent) => void;
  closeEventDetail: () => void;

  detailSession: ScheduledSession | null;
  openSessionDetail: (session: ScheduledSession) => void;
  closeSessionDetail: () => void;

  confirmDialog: ConfirmDialogState | null;
  showConfirmDialog: (state: Omit<ConfirmDialogState, "id">) => void;
  closeConfirmDialog: () => void;

  toast: string | null;
  showToast: (msg: string) => void;

  /** Errors and system problems - stay in the Status area until dismissed.
   *  (showToast is different: it's for quick confirmations that can just
   *  disappear.) */
  systemMessages: SystemMessage[];
  reportSystemError: (text: string) => void;
  dismissSystemMessage: (id: string) => void;
}

export interface SystemMessage {
  id: string;
  text: string;
}

type DrawerState =
  | { type: "fixed"; prefill?: CalendarEvent }
  | { type: "flexible"; prefill?: FlexibleTask };

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  onConfirm: () => void;
}

const AppStateContext = createContext<AppState | undefined>(undefined);

export function AppStateProvider({
  userId,
  isDemo,
  children,
}: {
  userId: string;
  isDemo: boolean;
  children: ReactNode;
}) {
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([]);

  const reportSystemError = useCallback((text: string) => {
    setSystemMessages((cur) => {
      if (cur.some((m) => m.text === text)) return cur;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return [...cur, { id, text }];
    });
  }, []);

  const dismissSystemMessage = useCallback((id: string) => {
    setSystemMessages((cur) => cur.filter((m) => m.id !== id));
  }, []);

  const categoriesApi = useCategories(userId, reportSystemError);
  const eventsApi = useEvents(userId, reportSystemError);
  const flexibleTasksApi = useFlexibleTasks(userId, reportSystemError);
  const scheduledSessionsApi = useScheduledSessions(userId, reportSystemError);
  const scheduleRunsApi = useScheduleRuns(userId);
  const noteApi = useNote(userId);

  const [today] = useState(() => new Date());
  const [currentDate, setCurrentDate] = useState<Date>(today);
  const [currentView, setCurrentView] = useState<ViewType>("week");

  const { updatingSchedule, resolvePrompt, closeResolvePrompt, updateSchedule } = useUpdateSchedule({
    today,
    setFlexibleTasks: flexibleTasksApi.setFlexibleTasks,
    setScheduledSessions: scheduledSessionsApi.setScheduledSessions,
    setLastRunAt: scheduleRunsApi.setLastRunAt,
    showToast,
    reportSystemError,
  });

  const { importingGoogleCalendar, googleCalendarImported, importGoogleCalendar } = useGoogleImport({
    today,
    setEvents: eventsApi.setEvents,
    showToast,
    reportSystemError,
  });

  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const [detailSession, setDetailSession] = useState<ScheduledSession | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const setView = useCallback((v: ViewType) => setCurrentView(v), []);

  const navigate = useCallback(
    (dir: -1 | 1) => {
      setCurrentDate((prev) => {
        if (currentView === "day") return addDays(prev, dir);
        if (currentView === "week") return addDays(prev, dir * 7);
        return addMonths(prev, dir);
      });
    },
    [currentView],
  );

  const goToday = useCallback(() => setCurrentDate(today), [today]);

  const openFixedEventDrawer = useCallback((prefill?: CalendarEvent) => {
    setDrawer({ type: "fixed", prefill });
  }, []);

  const openFlexibleEventDrawer = useCallback((prefill?: FlexibleTask) => {
    setDrawer({ type: "flexible", prefill });
  }, []);

  const closeDrawer = useCallback(() => setDrawer(null), []);

  const openEventDetail = useCallback((event: CalendarEvent) => {
    setDetailEvent(event);
  }, []);

  const closeEventDetail = useCallback(() => setDetailEvent(null), []);

  const openSessionDetail = useCallback((session: ScheduledSession) => {
    setDetailSession(session);
  }, []);

  const closeSessionDetail = useCallback(() => setDetailSession(null), []);

  const showConfirmDialog = useCallback((state: Omit<ConfirmDialogState, "id">) => {
    setConfirmDialog(state);
  }, []);

  const closeConfirmDialog = useCallback(() => setConfirmDialog(null), []);

  const demoLimits = useDemoLimits({
    isDemo,
    createEventReal: eventsApi.createEvent,
    deleteEventReal: eventsApi.deleteEvent,
    createFlexibleTaskReal: flexibleTasksApi.createFlexibleTask,
    reportSystemError,
  });

  // Wraps deleteCategory so it also removes that category's events/tasks/
  // sessions. Lives here because it needs all four hooks' setters, and none
  // of those hooks should know about each other.
  const deleteCategoryCascade = useCallback(
    (id: string): string => {
      const removedId = categoriesApi.deleteCategory(id);
      eventsApi.removeEventsByCategory(removedId);
      flexibleTasksApi.removeFlexibleTasksByCategory(removedId);
      scheduledSessionsApi.removeScheduledSessionsByCategory(removedId);
      return removedId;
    },
    [categoriesApi, eventsApi, flexibleTasksApi, scheduledSessionsApi],
  );

  // Same idea as deleteCategoryCascade: deleting a task must also remove its
  // already-placed sessions, or an orphaned block stays on the grid until
  // the next reload.
  const deleteFlexibleTaskCascade = useCallback(
    async (id: string): Promise<boolean> => {
      const success = await flexibleTasksApi.deleteFlexibleTask(id);
      if (success) {
        scheduledSessionsApi.removeScheduledSessionsByTask(id);
        demoLimits.untrackTask(id);
      }
      return success;
    },
    [flexibleTasksApi, scheduledSessionsApi, demoLimits],
  );

  // Changing a task's category must also update its already-placed sessions'
  // local categoryId. A DB trigger (migration 0009) keeps the server copy in
  // sync, but this tab's own local state needs the same update, or the grid
  // shows the old color until reload.
  const updateFlexibleTaskCascade = useCallback(
    async (id: string, patch: Partial<FlexibleTask>): Promise<boolean> => {
      const success = await flexibleTasksApi.updateFlexibleTask(id, patch);
      if (success && patch.categoryId !== undefined) {
        scheduledSessionsApi.updateScheduledSessionsCategoryForTask(id, patch.categoryId);
      }
      return success;
    },
    [flexibleTasksApi, scheduledSessionsApi],
  );

  const value: AppState = {
    isDemo,
    ...categoriesApi,
    deleteCategory: deleteCategoryCascade,
    ...eventsApi,
    createEvent: demoLimits.createEvent,
    deleteEvent: demoLimits.deleteEvent,
    ...flexibleTasksApi,
    createFlexibleTask: demoLimits.createFlexibleTask,
    deleteFlexibleTask: deleteFlexibleTaskCascade,
    updateFlexibleTask: updateFlexibleTaskCascade,
    ...scheduledSessionsApi,
    ...scheduleRunsApi,
    ...noteApi,
    today,
    updatingSchedule,
    resolvePrompt,
    closeResolvePrompt,
    updateSchedule,
    importingGoogleCalendar,
    googleCalendarImported,
    importGoogleCalendar,
    currentDate,
    currentView,
    setView,
    navigate,
    goToday,
    drawer,
    openFixedEventDrawer,
    openFlexibleEventDrawer,
    closeDrawer,
    detailEvent,
    openEventDetail,
    closeEventDetail,
    detailSession,
    openSessionDetail,
    closeSessionDetail,
    confirmDialog,
    showConfirmDialog,
    closeConfirmDialog,
    toast,
    showToast,
    systemMessages,
    reportSystemError,
    dismissSystemMessage,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
