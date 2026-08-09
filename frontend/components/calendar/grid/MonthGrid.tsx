"use client";

import React from "react";
import { useAppState } from "../state/AppStateContext";
import { getMonthGridDays, sameDay } from "@/lib/calendar/dateUtils";
import { shadeColor } from "@/lib/calendar/colorUtils";
import { DOW_SHORT } from "@/lib/calendar/constants";
import styles from "./Calendar.module.css";

interface MonthGridProps {
  anchor: Date;
}

export default function MonthGrid({ anchor }: MonthGridProps) {
  const { today, categories, getEventsForDate, openEventDetail } = useAppState();
  const days = getMonthGridDays(anchor);
  const month = anchor.getMonth();

  return (
    <div className={styles.viewBody}>
      <div className={styles.monthDowRow}>
        {DOW_SHORT.map((d) => (
          <div key={d} className={styles.monthDow}>
            {d}
          </div>
        ))}
      </div>
      <div className={styles.monthGrid}>
        {days.map((d, i) => {
          const inMonth = d.getMonth() === month;
          const isToday = sameDay(d, today);
          const dayEvents = getEventsForDate(d, categories);

          return (
            <div
              key={i}
              className={`${styles.monthCell} ${inMonth ? "" : styles.otherMonth} ${
                isToday ? styles.today : ""
              }`}
            >
              <div className={styles.monthDate}>{d.getDate()}</div>
              <div className={styles.monthDots}>
                {dayEvents.map((e) => {
                  const cat = categories.find((c) => c.id === e.categoryId);
                  return (
                    <button
                      key={e.id}
                      className={styles.monthDot}
                      title={e.title}
                      style={{
                        background: cat ? cat.color : "#cccccc",
                        borderColor: cat ? shadeColor(cat.color, -30) : "#999999",
                      }}
                      onClick={() => openEventDetail(e)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
