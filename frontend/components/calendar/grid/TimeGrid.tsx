"use client";

import React from "react";
import { useAppState } from "../state/AppStateContext";
import { sameDay, toISODate } from "@/lib/calendar/dateUtils";
import { START_HOUR, END_HOUR, ROW_HEIGHT, DOW_SHORT } from "@/lib/calendar/constants";
import EventBlock from "./EventBlock";
import SessionBlock from "./SessionBlock";
import AllDayChip from "./AllDayChip";
import styles from "./Calendar.module.css";

interface TimeGridProps {
  days: Date[];
}

export default function TimeGrid({ days }: TimeGridProps) {
  const { today, categories, getEventsForDate, getSessionsForDate } = useAppState();

  const totalHeight = (END_HOUR - START_HOUR + 1) * ROW_HEIGHT;
  const colTemplate = `52px repeat(${days.length}, minmax(0, 1fr))`;

  const hourMarks: number[] = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) hourMarks.push(h);

  function hourLabel(h: number): string {
    if (h === 0) return "12 AM";
    if (h === 12) return "12 PM";
    return h < 12 ? `${h} AM` : `${h - 12} PM`;
  }

  return (
    <div className={styles.gridBodyScroll}>
      <div className={styles.tgGrid} style={{ gridTemplateColumns: colTemplate }}>
        {/* Row 1: all-day banners */}
        <div className={styles.tgSpacer} style={{ gridRow: 1, gridColumn: 1 }} />
        {days.map((d, i) => {
          const allDayEvents = getEventsForDate(d, categories).filter((e) => e.allDay);
          return (
            <div
              key={`allday-${i}`}
              className={styles.tgAlldayCell}
              style={{ gridRow: 1, gridColumn: i + 2 }}
            >
              {allDayEvents.map((e) => (
                <AllDayChip key={e.id} event={e} />
              ))}
            </div>
          );
        })}

        {/* Row 2: day headers */}
        <div className={styles.tgSpacer} style={{ gridRow: 2, gridColumn: 1 }} />
        {days.map((d, i) => {
          const isToday = sameDay(d, today);
          return (
            <div
              key={`head-${i}`}
              className={`${styles.gridDayHead} ${isToday ? styles.today : ""}`}
              style={{ gridRow: 2, gridColumn: i + 2 }}
            >
              {DOW_SHORT[d.getDay()]} <span className={styles.ghDom}>{d.getDate()}</span>
            </div>
          );
        })}

        {/* Row 3: time labels + hourly day columns */}
        <div
          className={styles.gridTimeCol}
          style={{ gridRow: 3, gridColumn: 1, height: totalHeight }}
        >
          {hourMarks.map((h) => (
            <div
              key={h}
              className={styles.gridTimeLabel}
              style={{ top: (h - START_HOUR) * ROW_HEIGHT }}
            >
              {hourLabel(h)}
            </div>
          ))}
        </div>

        {days.map((d, i) => {
          const timedEvents = getEventsForDate(d, categories).filter((e) => !e.allDay);
          const sessions = getSessionsForDate(d, categories);
          return (
            <div
              key={`col-${i}`}
              className={styles.gridDayCol}
              data-date-col={toISODate(d)}
              style={
                {
                  gridRow: 3,
                  gridColumn: i + 2,
                  height: totalHeight,
                  "--row-height": `${ROW_HEIGHT}px`,
                } as React.CSSProperties
              }
            >
              {timedEvents.map((e) => (
                <EventBlock key={e.id} event={e} />
              ))}
              {sessions.map((s) => (
                <SessionBlock key={s.id} session={s} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
