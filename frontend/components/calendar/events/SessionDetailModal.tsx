"use client";

import React, { useState } from "react";
import type { PlacementReason, ScheduledSession } from "@/lib/calendar/types";
import { fmtHour, fmtLongDate, parseLocalDate } from "@/lib/calendar/dateUtils";
import { useAppState } from "../state/AppStateContext";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import styles from "./EventDetail.module.css";

interface SessionDetailModalProps {
  session: ScheduledSession;
  onClose: () => void;
}

/** Built from facts saved when the solver ran, not guessed afterward. It
 *  only describes what placementReason actually stores, not how the
 *  solver's search worked internally. */
function explainPlacement(reason: PlacementReason): string {
  const priorityClause =
    reason.otherTierTasksCount === 0
      ? `This is your only ${reason.priority}-priority task this week`
      : `This is a ${reason.priority}-priority task`;

  const splitSuffix =
    reason.sessionCount > 1 ? ` This is part ${reason.sessionIndex} of ${reason.sessionCount}.` : "";

  if (reason.blockedBy) {
    const { title, start, end } = reason.blockedBy;
    return `${priorityClause}, but your ${title} (${fmtHour(start)}–${fmtHour(end)}) was in the way, so it landed here instead.${splitSuffix}`;
  }
  return `${priorityClause}, so it was scheduled as soon as possible.${splitSuffix}`;
}

/** A session can only be marked Completed/Missed, or opened to view its
 *  task. You can't edit, delete, or drag the placement itself. */
export default function SessionDetailModal({ session, onClose }: SessionDetailModalProps) {
  const {
    getCategory,
    getFlexibleTaskById,
    openFlexibleEventDrawer,
    markSessionCompletion,
    reportSystemError,
  } = useAppState();
  const [saving, setSaving] = useState<"completed" | "missed" | null>(null);

  const category = getCategory(session.categoryId);
  const task = getFlexibleTaskById(session.taskId);
  const dateStr = fmtLongDate(parseLocalDate(session.date));

  async function handleMark(status: "completed" | "missed") {
    if (saving) return;
    setSaving(status);
    const success = await markSessionCompletion(session.id, status);
    setSaving(null);
    if (success) {
      onClose();
    } else {
      reportSystemError("Couldn't update that session. Please try again.");
    }
  }

  function handleViewTask() {
    onClose();
    if (task) openFlexibleEventDrawer(task);
  }

  return (
    <Modal onClose={onClose}>
      <div className={styles.catRow}>
        <span className={styles.dot} style={{ background: category?.color ?? "#ccc" }} />
        <span className={styles.catName}>{category?.name ?? "Uncategorized"}</span>
      </div>
      <div className={styles.title}>{task?.title ?? "Untitled task"}</div>
      <div className={styles.time}>
        {dateStr} · {fmtHour(session.start)} – {fmtHour(session.end)}
      </div>

      {session.placementReason && (
        <div className={styles.whySection}>
          <div className={styles.whyLabel}>Why this slot?</div>
          <p className={styles.whyText}>{explainPlacement(session.placementReason)}</p>
        </div>
      )}

      <div className={styles.actions}>
        <Button variant="plain" onClick={handleViewTask} disabled={!task}>
          View Task
        </Button>
        <div className={styles.toggleGroup}>
          <Button
            variant={session.completionStatus === "completed" ? "primary" : "plain"}
            size="mini"
            disabled={saving !== null}
            onClick={() => handleMark("completed")}
          >
            {saving === "completed" ? "Saving…" : "Completed"}
          </Button>
          <Button
            variant={session.completionStatus === "missed" ? "danger" : "plain"}
            size="mini"
            disabled={saving !== null}
            onClick={() => handleMark("missed")}
          >
            {saving === "missed" ? "Saving…" : "Missed"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
