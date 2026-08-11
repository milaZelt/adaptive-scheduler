"use client";

import React, { useEffect } from "react";
import { AppStateProvider, useAppState } from "./state/AppStateContext";
import TopBar from "./layout/TopBar";
import Sidebar from "./layout/Sidebar";
import RightPanel from "./layout/RightPanel";
import CalendarView from "./grid/CalendarView";
import FixedEventForm from "./events/FixedEventForm";
import FlexibleEventForm from "./events/FlexibleEventForm";
import EventDetailModal from "./events/EventDetailModal";
import SessionDetailModal from "./events/SessionDetailModal";
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
    detailSession,
    closeSessionDetail,
    confirmDialog,
    closeConfirmDialog,
    resolvePrompt,
    closeResolvePrompt,
    updateSchedule,
    toast,
    reportSystemError,
    categoriesLoading,
    categoriesError,
    eventsLoading,
    eventsError,
    flexibleTasksLoading,
    flexibleTasksError,
    scheduledSessionsLoading,
    scheduledSessionsError,
    lastRunAtLoading,
    lastRunAtError,
  } = useAppState();

  useEffect(() => {
    for (const msg of [
      categoriesError,
      eventsError,
      flexibleTasksError,
      scheduledSessionsError,
      lastRunAtError,
    ]) {
      if (msg) reportSystemError(msg);
    }
  }, [categoriesError, eventsError, flexibleTasksError, scheduledSessionsError, lastRunAtError, reportSystemError]);

  const initialLoading =
    categoriesLoading ||
    eventsLoading ||
    flexibleTasksLoading ||
    scheduledSessionsLoading ||
    lastRunAtLoading;

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

      {detailSession && (
        <SessionDetailModal session={detailSession} onClose={closeSessionDetail} />
      )}

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
