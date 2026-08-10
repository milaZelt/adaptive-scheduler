"use client";

import React from "react";
import type { FlexibleTask } from "@/lib/calendar/types";
import { useAppState } from "../state/AppStateContext";
import styles from "./RightPanel.module.css";

function estimateLabel(t: FlexibleTask): string {
  if (t.timeEstimateMode === "single" && t.timeEstimateValue != null) {
    return `${t.timeEstimateValue}h`;
  }
  if (t.timeEstimateMode === "range" && t.timeEstimateMin != null && t.timeEstimateMax != null) {
    return `${t.timeEstimateMin}–${t.timeEstimateMax}h`;
  }
  return "";
}

function deadlineLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function FlexibleTaskList() {
  const { flexibleTasks, openFlexibleEventDrawer, deleteFlexibleTask, showConfirmDialog, showToast } =
    useAppState();

  if (flexibleTasks.length === 0) return null;

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
      <div className={`${styles.statusLabel} sans`}>Flexible Tasks</div>
      {flexibleTasks.map((t) => (
        <div className={styles.taskRow} key={t.id}>
          <button className={styles.taskMain} onClick={() => openFlexibleEventDrawer(t)}>
            <span className={styles.taskTitle}>{t.title}</span>
            <span className={styles.taskMeta}>
              {t.priority} · due {deadlineLabel(t.deadline)}
              {estimateLabel(t) ? ` · ${estimateLabel(t)}` : ""}
            </span>
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
}
