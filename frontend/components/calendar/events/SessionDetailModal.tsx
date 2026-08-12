"use client";

import React, { useState } from "react";
import type { PlacementReason, ScheduledSession } from "@/lib/calendar/types";
import { fmtHour, parseLocalDate } from "@/lib/calendar/dateUtils";
import { useAppState } from "../state/AppStateContext";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import styles from "./EventDetail.module.css";

interface SessionDetailModalProps {
  session: ScheduledSession;
  onClose: () => void;
}

/** Templated from the structured facts captured at solve time (Ticket 4) -
 *  not reconstructed after the fact, since "why" is a claim about calendar
 *  state at the moment of solving. Deliberately only states what
 *  placementReason actually carries (priority-tier composition, calendar
 *  adjacency, split position) rather than a claim about the solver's
 *  internal search that a single result can't honestly support. */
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

/** A scheduled session's only sanctioned direct interactions (decisions
 *  record): toggle Completed/Missed, or jump to the underlying flexible
 *  task to change what the next Update Schedule produces. No edit/delete/
 *  drag on the placement itself. */
export default function SessionDetailModal({ session, onClose }: SessionDetailModalProps) {
  const { getCategory, getFlexibleTaskById, openFlexibleEventDrawer, markSessionCompletion } =
    useAppState();
  const [saving, setSaving] = useState<"completed" | "missed" | null>(null);

  const category = getCategory(session.categoryId);
  const task = getFlexibleTaskById(session.taskId);
  const dateStr = parseLocalDate(session.date).toLocaleDateString("en-US", {
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
