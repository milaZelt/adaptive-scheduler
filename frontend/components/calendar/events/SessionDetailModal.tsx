"use client";

import React, { useState } from "react";
import type { ScheduledSession } from "@/lib/calendar/types";
import { fmtHour } from "@/lib/calendar/dateUtils";
import { useAppState } from "../state/AppStateContext";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import styles from "./EventDetail.module.css";

interface SessionDetailModalProps {
  session: ScheduledSession;
  onClose: () => void;
}

/** A scheduled session's only sanctioned direct interactions (decisions
 *  record): toggle Completed/Missed, or jump to the underlying flexible
 *  task to change what the next Update Schedule produces. No edit/delete/
 *  drag on the placement itself, and no placement-reason explanation yet
 *  (Ticket 6). */
export default function SessionDetailModal({ session, onClose }: SessionDetailModalProps) {
  const { getCategory, getFlexibleTaskById, openFlexibleEventDrawer, markSessionCompletion } =
    useAppState();
  const [saving, setSaving] = useState<"completed" | "missed" | null>(null);

  const category = getCategory(session.categoryId);
  const task = getFlexibleTaskById(session.taskId);
  const dateStr = new Date(session.date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  async function handleMark(status: "completed" | "missed") {
    if (saving) return;
    setSaving(status);
    const success = await markSessionCompletion(session.id, status);
    setSaving(null);
    if (success) onClose();
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
