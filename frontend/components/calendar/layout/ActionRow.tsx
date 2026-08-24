"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAppState } from "../state/AppStateContext";
import ContextMenu from "@/components/ui/ContextMenu";
import styles from "./Sidebar.module.css";

// If the backend's been idle, Render can take up to a minute to wake it
// up. Rather than warn everyone up front (most requests are fast), only
// say something once a request has actually been running long enough
// that a cold start is the likely explanation.
const SLOW_UPDATE_NOTICE_MS = 8000;

export default function ActionRow() {
  const {
    isDemo,
    openFixedEventDrawer,
    openFlexibleEventDrawer,
    updateSchedule,
    updatingSchedule,
    importGoogleCalendar,
    importingGoogleCalendar,
  } = useAppState();
  const createBtnRef = useRef<HTMLButtonElement>(null);
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const [showWakingNote, setShowWakingNote] = useState(false);

  useEffect(() => {
    if (!updatingSchedule) return;
    const timer = setTimeout(() => setShowWakingNote(true), SLOW_UPDATE_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [updatingSchedule]);

  return (
    <div className={styles.actionRow}>
      <button
        className={`${styles.updateBtn} sans`}
        disabled={updatingSchedule}
        onClick={() => {
          setShowWakingNote(false);
          updateSchedule();
        }}
      >
        {updatingSchedule ? "Updating…" : "Update Schedule"}
      </button>
      {showWakingNote && updatingSchedule && (
        <p className={`${styles.wakingNote} sans`}>
          {"Still working — if the scheduler has been idle a while, it can take up to a minute to wake up."}
        </p>
      )}

      <button
        ref={createBtnRef}
        className={`${styles.linkBtn} sans`}
        onClick={() => setMenuAnchor(createBtnRef.current?.getBoundingClientRect() ?? null)}
      >
        Create <span>+</span>
      </button>
      {menuAnchor && (
        <ContextMenu
          anchorRect={menuAnchor}
          align="left"
          onClose={() => setMenuAnchor(null)}
          items={[
            {
              label: "Event",
              subtitle: "You choose when",
              onClick: () => {
                setMenuAnchor(null);
                openFixedEventDrawer();
              },
            },
            {
              label: "Task",
              subtitle: "Nextly finds the time",
              onClick: () => {
                setMenuAnchor(null);
                openFlexibleEventDrawer();
              },
            },
          ]}
        />
      )}

      <button
        className={`${styles.linkBtn} sans`}
        disabled={isDemo || importingGoogleCalendar}
        title={isDemo ? "Available after signing in" : undefined}
        onClick={() => importGoogleCalendar()}
      >
        {importingGoogleCalendar ? "Importing…" : "Import Google Calendar"} <span>⇩</span>
      </button>
    </div>
  );
}
