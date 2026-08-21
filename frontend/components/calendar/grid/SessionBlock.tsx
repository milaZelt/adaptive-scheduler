"use client";

import React from "react";
import type { ScheduledSession } from "@/lib/calendar/types";
import { fmtHour } from "@/lib/calendar/dateUtils";
import { shadeColor } from "@/lib/calendar/colorUtils";
import { START_HOUR, ROW_HEIGHT } from "@/lib/calendar/constants";
import { useAppState } from "../state/AppStateContext";
import styles from "./Calendar.module.css";

interface SessionBlockProps {
  session: ScheduledSession;
}

/** Solver-placed - read-only beyond the Completed/Missed toggle, so unlike
 *  EventBlock this wires up no drag/resize. */
export default function SessionBlock({ session }: SessionBlockProps) {
  const { getCategory, getFlexibleTaskById, openSessionDetail } = useAppState();
  const category = getCategory(session.categoryId);
  const task = getFlexibleTaskById(session.taskId);

  const { start, end } = session;
  const duration = end - start;
  const top = (start - START_HOUR) * ROW_HEIGHT;
  const height = Math.max(duration * ROW_HEIGHT, 26);
  const short = duration < 0.8;
  const resolved = session.completionStatus !== "unresolved";

  const bg = category ? category.color : "#eeeeee";
  const border =
    session.completionStatus === "missed"
      ? "var(--danger)"
      : category
        ? shadeColor(category.color, -30)
        : "#cccccc";

  return (
    <button
      className={`${styles.gridEvent} ${styles.sessionBlock} ${short ? styles.short : ""} ${
        resolved ? styles.sessionResolved : ""
      }`}
      style={{ top, height, background: bg, borderLeftColor: border }}
      onClick={() => openSessionDetail(session)}
    >
      <span className={styles.geTime}>
        {fmtHour(start)} – {fmtHour(end)}
      </span>
      <span className={styles.geTitle}>
        {session.completionStatus === "completed" ? "✓ " : ""}
        {task?.title ?? "Untitled task"}
      </span>
    </button>
  );
}
