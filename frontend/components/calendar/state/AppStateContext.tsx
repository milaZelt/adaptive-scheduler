"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { CalendarEvent, ViewType } from "@/lib/calendar/types";
import { addDays, addMonths } from "@/lib/calendar/dateUtils";
import { useCategories, type UseCategoriesResult } from "./useCategories";
import { useEvents, type UseEventsResult } from "./useEvents";
import { useNote, type UseNoteResult } from "./useNote";

interface AppState extends UseCategoriesResult, UseEventsResult, UseNoteResult {
  today: Date;
  currentDate: Date;
  currentView: ViewType;
  setView: (v: ViewType) => void;
  navigate: (dir: -1 | 1) => void;
  goToday: () => void;

  // Floating UI (drawer for event forms, modal for detail/confirm)
  drawer: DrawerState | null;
  openFixedEventDrawer: (prefill?: CalendarEvent) => void;
  openFlexibleEventDrawer: (prefill?: CalendarEvent) => void;
  closeDrawer: () => void;

  detailEvent: CalendarEvent | null;
  openEventDetail: (event: CalendarEvent) => void;
  closeEventDetail: () => void;

  confirmDialog: ConfirmDialogState | null;
  showConfirmDialog: (state: Omit<ConfirmDialogState, "id">) => void;
  closeConfirmDialog: () => void;

  toast: string | null;
  showToast: (msg: string) => void;
}

interface DrawerState {
  type: "fixed" | "flexible";
  prefill?: CalendarEvent;
}

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

  const categoriesApi = useCategories(userId, showToast);
  const eventsApi = useEvents(userId, showToast);
  const noteApi = useNote(userId);

  const [today] = useState(() => new Date());
  const [currentDate, setCurrentDate] = useState<Date>(today);
  const [currentView, setCurrentView] = useState<ViewType>("week");

  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
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

  const openFlexibleEventDrawer = useCallback((prefill?: CalendarEvent) => {
    setDrawer({ type: "flexible", prefill });
  }, []);

  const closeDrawer = useCallback(() => setDrawer(null), []);

  const openEventDetail = useCallback((event: CalendarEvent) => {
    setDetailEvent(event);
  }, []);

  const closeEventDetail = useCallback(() => setDetailEvent(null), []);

  const showConfirmDialog = useCallback((state: Omit<ConfirmDialogState, "id">) => {
    setConfirmDialog(state);
  }, []);

  const closeConfirmDialog = useCallback(() => setConfirmDialog(null), []);

  // Wrap deleteCategory so it cascades into event removal (kept here since it
  // needs both hooks' setters — neither hook should know about the other).
  const deleteCategoryCascade = useCallback(
    (id: string): string => {
      const removedId = categoriesApi.deleteCategory(id);
      eventsApi.removeEventsByCategory(removedId);
      return removedId;
    },
    [categoriesApi, eventsApi],
  );

  const value: AppState = {
    ...categoriesApi,
    deleteCategory: deleteCategoryCascade,
    ...eventsApi,
    ...noteApi,
    today,
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
    confirmDialog,
    showConfirmDialog,
    closeConfirmDialog,
    toast,
    showToast,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
