"use client";

import React from "react";
import type { CalendarEvent } from "@/lib/calendar/types";
import { useAppState } from "../state/AppStateContext";
import { fmtHour } from "@/lib/calendar/dateUtils";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import styles from "./EventDetail.module.css";

interface EventDetailModalProps {
  event: CalendarEvent;
  onClose: () => void;
}

export default function EventDetailModal({ event, onClose }: EventDetailModalProps) {
  const {
    getCategory,
    openFixedEventDrawer,
    openFlexibleEventDrawer,
    showConfirmDialog,
    showToast,
  } = useAppState();

  const category = getCategory(event.categoryId);
  const timeStr =
    event.allDay || event.start === null || event.end === null
      ? "All day"
      : `${fmtHour(event.start)} – ${fmtHour(event.end)}`;
  const dateStr = new Date(event.date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  function handleEdit() {
    onClose();
    if (event.type === "flexible") openFlexibleEventDrawer(event);
    else openFixedEventDrawer(event);
  }

  function handleDelete() {
    onClose();
    showConfirmDialog({
      title: "Delete this event?",
      message: `"${event.title}" will be removed from your calendar. This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: () => {
        console.log("Would delete event:", event.id, event.title);
        showToast("Deleted (see console) — no backend yet");
      },
    });
  }

  return (
    <Modal onClose={onClose}>
      <div className={styles.catRow}>
        <span className={styles.dot} style={{ background: category?.color ?? "#ccc" }} />
        <span className={styles.catName}>
          {category?.name ?? "Uncategorized"}
          {event.type === "flexible" ? " · Flexible" : ""}
        </span>
      </div>
      <div className={styles.title}>{event.title}</div>
      <div className={styles.time}>
        {dateStr} · {timeStr}
      </div>
      <div className={`${styles.desc} ${event.description ? "" : styles.empty}`}>
        {event.description ? event.description : "No description added."}
      </div>
      <div className={styles.actions}>
        <Button variant="plain" onClick={handleDelete}>
          Delete
        </Button>
        <Button variant="primary" onClick={handleEdit}>
          Edit
        </Button>
      </div>
    </Modal>
  );
}
