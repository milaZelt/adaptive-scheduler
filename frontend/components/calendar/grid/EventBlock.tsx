"use client";

import React from "react";
import type { CalendarEvent } from "@/lib/calendar/types";
import { fmtHour } from "@/lib/calendar/dateUtils";
import { shadeColor } from "@/lib/calendar/colorUtils";
import { START_HOUR, ROW_HEIGHT } from "@/lib/calendar/constants";
import { useAppState } from "../state/AppStateContext";
import styles from "./Calendar.module.css";

interface EventBlockProps {
  event: CalendarEvent;
}

export default function EventBlock({ event }: EventBlockProps) {
  const { getCategory, openEventDetail } = useAppState();
  const category = getCategory(event.categoryId);

  if (event.start === null || event.end === null) return null;

  const top = (event.start - START_HOUR) * ROW_HEIGHT;
  const height = Math.max((event.end - event.start) * ROW_HEIGHT, 26);
  const short = event.end - event.start < 0.8;
  const bg = category ? category.color : "#eeeeee";
  const border = category ? shadeColor(category.color, -30) : "#cccccc";

  return (
    <button
      className={`${styles.gridEvent} ${short ? styles.short : ""}`}
      style={{ top, height, background: bg, borderLeftColor: border }}
      onClick={() => openEventDetail(event.id)}
    >
      <span className={styles.geTime}>
        {fmtHour(event.start)} – {fmtHour(event.end)}
      </span>
      <span className={styles.geTitle}>{event.title}</span>
    </button>
  );
}
