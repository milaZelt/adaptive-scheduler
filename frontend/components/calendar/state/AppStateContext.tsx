"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
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

interface AppState
  extends UseCategoriesResult,
    UseEventsResult,
    UseFlexibleTasksResult,
    UseScheduledSessionsResult,
    UseScheduleRunsResult,
    UseNoteResult {
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

  /** Errors/system problems, persisted in the Status area until dismissed -
   *  unlike showToast, which is for transient action confirmations that are
   *  fine to disappear on their own. */
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
  children,
}: {
  userId: string;
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

  // Wrap deleteCategory so it cascades into event/task/session removal (kept
  // here since it needs all four hooks' setters - none of them should know
  // about the others).
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

  // Same reasoning as deleteCategoryCascade: deleting a flexible task must
  // also drop its own already-placed sessions from local state, or an
  // orphaned session block lingers on the grid until the next reload.
  const deleteFlexibleTaskCascade = useCallback(
    async (id: string): Promise<boolean> => {
      const success = await flexibleTasksApi.deleteFlexibleTask(id);
      if (success) scheduledSessionsApi.removeScheduledSessionsByTask(id);
      return success;
    },
    [flexibleTasksApi, scheduledSessionsApi],
  );

  // Recategorizing a task must also update its already-placed sessions'
  // local categoryId - a DB trigger (migration 0009) keeps the server-side
  // denormalized copy in sync, but the currently-open tab's own local state
  // needs the same update or the grid keeps showing the old color/visibility
  // until the next reload.
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
    ...categoriesApi,
    deleteCategory: deleteCategoryCascade,
    ...eventsApi,
    ...flexibleTasksApi,
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
