"use client";

import React, { useRef, useState } from "react";
import type { CalendarEvent } from "@/lib/calendar/types";
import { fmtHour } from "@/lib/calendar/dateUtils";
import { shadeColor } from "@/lib/calendar/colorUtils";
import { START_HOUR, END_HOUR, ROW_HEIGHT } from "@/lib/calendar/constants";
import { useAppState } from "../state/AppStateContext";
import styles from "./Calendar.module.css";

interface EventBlockProps {
  event: CalendarEvent;
}

const SNAP_HOURS = 0.25; // 15 minutes
const MIN_DURATION_HOURS = SNAP_HOURS;
const TOTAL_HOURS = END_HOUR - START_HOUR + 1;

interface DragState {
  dx: number;
  dy: number;
  resizing: boolean;
}

function snap(hour: number): number {
  return Math.round(hour / SNAP_HOURS) * SNAP_HOURS;
}

export default function EventBlock({ event }: EventBlockProps) {
  const { getCategory, openEventDetail, updateEvent, showToast } = useAppState();
  const category = getCategory(event.categoryId);
  const blockRef = useRef<HTMLButtonElement>(null);
  const suppressClickRef = useRef(false);
  const [dragState, setDragState] = useState<DragState | null>(null);

  if (event.start === null || event.end === null) return null;

  const start = event.start;
  const end = event.end;
  const duration = end - start;
  // Recurring events are edited as a whole series via the form (see
  // lib/calendar/recurrence.ts) — dragging one occurrence would otherwise
  // ambiguously shift the whole series' anchor date, so only plain
  // non-repeating events support direct drag/resize on the grid.
  const draggable = (event.repeat ?? "none") === "none";

  const top = (start - START_HOUR) * ROW_HEIGHT;
  const baseHeight = Math.max(duration * ROW_HEIGHT, 26);
  const short = duration < 0.8;
  const bg = category ? category.color : "#eeeeee";
  const border = category ? shadeColor(category.color, -30) : "#cccccc";

  let liveHeight = baseHeight;
  let transform: string | undefined;
  if (dragState) {
    if (dragState.resizing) {
      liveHeight = Math.max(baseHeight + dragState.dy, 20);
    } else {
      transform = `translate(${dragState.dx}px, ${dragState.dy}px)`;
    }
  }

  function findDayColumn(clientX: number, clientY: number): HTMLElement | null {
    const el = document.elementFromPoint(clientX, clientY);
    return el?.closest<HTMLElement>("[data-date-col]") ?? null;
  }

  function handleMovePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0 || !blockRef.current) return;
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const blockRect = blockRef.current.getBoundingClientRect();
    const grabOffsetY = startY - blockRect.top;
    let moved = false;

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      setDragState({ dx, dy, resizing: false });
    }

    async function onUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragState(null);
      if (!moved) return;
      suppressClickRef.current = true;

      const col = findDayColumn(ev.clientX, ev.clientY);
      const newDate = col?.dataset.dateCol;
      if (!col || !newDate) return;
      const rect = col.getBoundingClientRect();
      const topEdgeY = ev.clientY - grabOffsetY;
      const ratio = Math.min(Math.max((topEdgeY - rect.top) / rect.height, 0), 1);
      let newStart = snap(START_HOUR + ratio * TOTAL_HOURS);
      newStart = Math.min(Math.max(newStart, START_HOUR), START_HOUR + TOTAL_HOURS - duration);
      const newEnd = newStart + duration;

      if (newDate === event.date && newStart === start) return;

      const ok = await updateEvent(event.id, { date: newDate, start: newStart, end: newEnd });
      if (!ok) showToast("Couldn't move that event. Please try again.");
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function handleResizePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || !blockRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    const startY = e.clientY;
    const blockRect = blockRef.current.getBoundingClientRect();
    let moved = false;

    function onMove(ev: PointerEvent) {
      const dy = ev.clientY - startY;
      if (Math.abs(dy) > 3) moved = true;
      setDragState({ dx: 0, dy, resizing: true });
    }

    async function onUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragState(null);
      if (!moved) return;
      suppressClickRef.current = true;

      const col = blockRef.current?.closest<HTMLElement>("[data-date-col]");
      if (!col) return;
      const rect = col.getBoundingClientRect();
      const bottomEdgeY = blockRect.bottom + (ev.clientY - startY);
      const ratio = (bottomEdgeY - rect.top) / rect.height;
      let newEnd = snap(START_HOUR + ratio * TOTAL_HOURS);
      newEnd = Math.min(
        Math.max(newEnd, start + MIN_DURATION_HOURS),
        START_HOUR + TOTAL_HOURS,
      );

      if (newEnd === end) return;

      const ok = await updateEvent(event.id, { end: newEnd });
      if (!ok) showToast("Couldn't resize that event. Please try again.");
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function handleClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    openEventDetail(event);
  }

  return (
    <button
      ref={blockRef}
      className={`${styles.gridEvent} ${short ? styles.short : ""} ${
        draggable ? styles.draggable : ""
      } ${dragState ? styles.dragging : ""}`}
      style={{ top, height: liveHeight, background: bg, borderLeftColor: border, transform }}
      onPointerDown={draggable ? handleMovePointerDown : undefined}
      onClick={handleClick}
    >
      <span className={styles.geTime}>
        {fmtHour(start)} – {fmtHour(end)}
      </span>
      <span className={styles.geTitle}>{event.title}</span>
      {draggable && (
        <div className={styles.resizeHandle} onPointerDown={handleResizePointerDown} />
      )}
    </button>
  );
}
