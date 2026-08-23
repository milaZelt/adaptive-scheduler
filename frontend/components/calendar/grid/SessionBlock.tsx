"use client";

import React from "react";
import type { ScheduledSession } from "@/lib/calendar/types";
import { fmtHour } from "@/lib/calendar/dateUtils";
import { getCategoryColors } from "@/lib/calendar/colorUtils";
import { getBlockGeometry } from "@/lib/calendar/gridLayout";
import { useAppState } from "../state/AppStateContext";
import styles from "./Calendar.module.css";

interface SessionBlockProps {
  session: ScheduledSession;
}

/** Solver-placed sessions are read-only (just the Completed/Missed toggle),
 *  so no drag/resize here. */
export default function SessionBlock({ session }: SessionBlockProps) {
  const { getCategory, getFlexibleTaskById, openSessionDetail } = useAppState();
  const category = getCategory(session.categoryId);
  const task = getFlexibleTaskById(session.taskId);

  const { start, end } = session;
  const { top, height, short } = getBlockGeometry(start, end);
  const resolved = session.completionStatus !== "unresolved";

  const { bg, border: categoryBorder } = getCategoryColors(category);
  const border = session.completionStatus === "missed" ? "var(--danger)" : categoryBorder;

  return (
    <button
      className={`${styles.gridEvent} ${styles.sessionBlock} ${short ? styles.short : ""} ${
        resolved ? styles.sessionResolved : ""
      }`}
      style={{ top, height, background: bg, borderLeftColor: border }}
      onClick={() => openSessionDetail(session)}
    >
      <span className={styles.geTitle}>
        {session.completionStatus === "completed" ? "✓ " : ""}
        {task?.title ?? "Untitled task"}
      </span>
      <span className={styles.geTime}>
        {fmtHour(start)} – {fmtHour(end)}
      </span>
    </button>
  );
}
