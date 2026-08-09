"use client";

import React from "react";
import type { CalendarEvent } from "@/lib/calendar/types";
import { shadeColor } from "@/lib/calendar/colorUtils";
import { useAppState } from "../state/AppStateContext";
import styles from "./Calendar.module.css";

interface AllDayChipProps {
  event: CalendarEvent;
}

export default function AllDayChip({ event }: AllDayChipProps) {
  const { getCategory, openEventDetail } = useAppState();
  const category = getCategory(event.categoryId);
  const bg = category ? category.color : "#eeeeee";
  const border = category ? shadeColor(category.color, -25) : "#cccccc";

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
