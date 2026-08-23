"use client";

import React from "react";
import { useAppState } from "../state/AppStateContext";
import { getMonthGridDays, sameDay } from "@/lib/calendar/dateUtils";
import { getCategoryColors } from "@/lib/calendar/colorUtils";
import { DOW_SHORT } from "@/lib/calendar/constants";
import styles from "./Calendar.module.css";

interface MonthGridProps {
  anchor: Date;
}

export default function MonthGrid({ anchor }: MonthGridProps) {
  const {
    today,
    categories,
    getCategory,
    getEventsForDate,
    getSessionsForDate,
    getFlexibleTaskById,
    openEventDetail,
    openSessionDetail,
  } = useAppState();
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
          const daySessions = getSessionsForDate(d, categories);

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
                  const { bg, border } = getCategoryColors(getCategory(e.categoryId));
                  return (
                    <button
                      key={e.id}
                      className={styles.monthDot}
                      title={e.title}
                      style={{ background: bg, borderColor: border }}
                      onClick={() => openEventDetail(e)}
                    />
                  );
                })}
                {daySessions.map((s) => {
                  const { bg, border } = getCategoryColors(getCategory(s.categoryId));
                  const taskTitle = getFlexibleTaskById(s.taskId)?.title ?? "Untitled task";
                  return (
                    <button
                      key={s.id}
                      className={`${styles.monthDot} ${styles.sessionDot}`}
                      title={taskTitle}
                      style={{ background: bg, borderColor: border }}
                      onClick={() => openSessionDetail(s)}
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
