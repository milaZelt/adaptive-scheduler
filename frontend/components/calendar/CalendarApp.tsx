"use client";

import React, { useEffect, useRef } from "react";
import { AppStateProvider, useAppState } from "./state/AppStateContext";
import TopBar from "./layout/TopBar";
import Sidebar from "./layout/Sidebar";
import RightPanel from "./layout/RightPanel";
import CalendarView from "./grid/CalendarView";
import FixedEventForm from "./events/FixedEventForm";
import FlexibleEventForm from "./events/FlexibleEventForm";
import EventDetailModal from "./events/EventDetailModal";
import ResolveSessionsModal from "./events/ResolveSessionsModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Toast from "@/components/ui/Toast";
import styles from "./CalendarApp.module.css";

interface CalendarAppProps {
  userId: string;
}

export default function CalendarApp({ userId }: CalendarAppProps) {
  return (
    <AppStateProvider userId={userId}>
      <CalendarAppShell />
    </AppStateProvider>
  );
}

function CalendarAppShell() {
  const {
    drawer,
    closeDrawer,
    detailEvent,
    closeEventDetail,
    confirmDialog,
    closeConfirmDialog,
    resolvePrompt,
    closeResolvePrompt,
    updateSchedule,
    toast,
    showToast,
    categoriesLoading,
    categoriesError,
    eventsLoading,
    eventsError,
    flexibleTasksLoading,
    flexibleTasksError,
    scheduledSessionsLoading,
    scheduledSessionsError,
  } = useAppState();

  const reportedErrors = useRef(new Set<string>());
  useEffect(() => {
    for (const msg of [categoriesError, eventsError, flexibleTasksError, scheduledSessionsError]) {
      if (msg && !reportedErrors.current.has(msg)) {
        reportedErrors.current.add(msg);
        showToast(msg);
      }
    }
  }, [categoriesError, eventsError, flexibleTasksError, scheduledSessionsError, showToast]);

  const initialLoading =
    categoriesLoading || eventsLoading || flexibleTasksLoading || scheduledSessionsLoading;

  return (
    <div className={styles.app}>
      <TopBar />
      {initialLoading ? (
        <div className={styles.loadingState}>Loading your calendar…</div>
      ) : (
        <div className={styles.layout}>
          <Sidebar />
          <CalendarView />
          <RightPanel />
        </div>
      )}

      {drawer?.type === "fixed" && (
        <FixedEventForm prefill={drawer.prefill} onClose={closeDrawer} />
      )}
      {drawer?.type === "flexible" && (
        <FlexibleEventForm prefill={drawer.prefill} onClose={closeDrawer} />
      )}

      {detailEvent && <EventDetailModal event={detailEvent} onClose={closeEventDetail} />}

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          danger={confirmDialog.danger}
          onConfirm={confirmDialog.onConfirm}
          onClose={closeConfirmDialog}
        />
      )}

      {resolvePrompt && (
        <ResolveSessionsModal
          sessions={resolvePrompt}
          onClose={closeResolvePrompt}
          onResolved={() => {
            closeResolvePrompt();
            updateSchedule();
          }}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
