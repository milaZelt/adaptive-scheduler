"use client";

import React from "react";
import type { CalendarEvent } from "@/lib/calendar/types";
import { getCategoryColors } from "@/lib/calendar/colorUtils";
import { useAppState } from "../state/AppStateContext";
import styles from "./Calendar.module.css";

interface AllDayChipProps {
  event: CalendarEvent;
}

export default function AllDayChip({ event }: AllDayChipProps) {
  const { getCategory, openEventDetail } = useAppState();
  const category = getCategory(event.categoryId);
  const { bg, border } = getCategoryColors(category);

  return (
    <button
      className={styles.alldayChip}
      style={{ background: bg, borderLeftColor: border }}
      onClick={() => openEventDetail(event)}
    >
      {event.title}
    </button>
  );
}
