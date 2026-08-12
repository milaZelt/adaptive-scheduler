"use client";

import React, { useMemo } from "react";
import type { FlexibleTask, SchedulingStatus } from "@/lib/calendar/types";
import { useAppState } from "../state/AppStateContext";
import { computeStaleness } from "@/lib/calendar/staleness";
import { fmtShortDate } from "@/lib/calendar/dateUtils";
import styles from "./RightPanel.module.css";

function estimateLabel(t: FlexibleTask): string {
  return `${t.estimateHours}h`;
}

/** Each state implies a different next action (decisions record) - couldn't
 *  fit / overdue get a reason line explaining what to do about it instead of
 *  the generic priority/deadline/estimate line the other two states use. */
function metaLabel(t: FlexibleTask): string {
  switch (t.schedulingStatus) {
    case "couldnt_fit":
      return `Couldn't fit before ${fmtShortDate(t.deadline)}`;
    case "overdue":
      return `Deadline passed on ${fmtShortDate(t.deadline)}`;
    default:
      return `${t.priority} · due ${fmtShortDate(t.deadline)} · ${estimateLabel(t)}`;
  }
}

const SECTIONS: { status: SchedulingStatus; label: string }[] = [
  { status: "not_yet_scheduled", label: "Not yet scheduled" },
  { status: "couldnt_fit", label: "Couldn't fit" },
  { status: "overdue", label: "Overdue" },
  { status: "scheduled", label: "Scheduled" },
];

export default function StatusList() {
  const {
    flexibleTasks,
    scheduledSessions,
    events,
    today,
    lastRunAt,
    googleCalendarImported,
    getCategory,
    openFlexibleEventDrawer,
    deleteFlexibleTask,
    showConfirmDialog,
    showToast,
    systemMessages,
    dismissSystemMessage,
  } = useAppState();

  const staleness = useMemo(
    () => computeStaleness({ today, lastRunAt, flexibleTasks, scheduledSessions, events }),
    [today, lastRunAt, flexibleTasks, scheduledSessions, events],
  );

  function handleDelete(task: FlexibleTask) {
    showConfirmDialog({
      title: `Delete "${task.title}"?`,
      message: "This flexible task will be removed. This can't be undone.",
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        const success = await deleteFlexibleTask(task.id);
        if (success) showToast("Task deleted");
      },
    });
  }

  return (
    <div>
      <div className={`${styles.statusLabel} sans`}>Status</div>

      {systemMessages.length > 0 && (
        <div className={styles.systemMessages}>
          {systemMessages.map((m) => (
            <div className={styles.systemMessageRow} key={m.id}>
              <span className={`${styles.dot} ${styles.warn}`} />
              <span className={styles.systemMessageText}>{m.text}</span>
              <button
                className={styles.taskDelete}
                aria-label="Dismiss"
                onClick={() => dismissSystemMessage(m.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.statusItem}>
        <span className={`${styles.dot} ${staleness.stale ? styles.warn : ""}`} />
        {staleness.stale
          ? `Schedule needs updating: ${staleness.reasons.join(", ")}`
          : "Schedule up to date"}
      </div>

      {googleCalendarImported && (
        <div className={styles.statusItem}>
          <span className={styles.dot} />
          Google Calendar imported successfully
        </div>
      )}

      {SECTIONS.map(({ status, label }) => {
        const tasks = flexibleTasks.filter((t) => t.schedulingStatus === status);
        if (tasks.length === 0) return null;

        return (
          <div key={status} className={styles.taskSection}>
            <div className={`${styles.taskSectionLabel} sans`}>{label}</div>
            {tasks.map((t) => (
              <div className={styles.taskRow} key={t.id}>
                <button className={styles.taskMain} onClick={() => openFlexibleEventDrawer(t)}>
                  <span className={styles.taskTitleRow}>
                    <span
                      className={styles.taskColorDot}
                      style={{ background: getCategory(t.categoryId)?.color ?? "#ccc" }}
                    />
                    <span className={styles.taskTitle}>{t.title}</span>
                  </span>
                  <span className={styles.taskMeta}>{metaLabel(t)}</span>
                </button>
                <button
                  className={styles.taskDelete}
                  aria-label={`Delete ${t.title}`}
                  onClick={() => handleDelete(t)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
