"use client";

import React from "react";
import { useAppState } from "../state/AppStateContext";
import { getWeekDays } from "@/lib/calendar/dateUtils";
import { MONTH_NAMES, MONTH_SHORT } from "@/lib/calendar/constants";
import TimeGrid from "./TimeGrid";
import MonthGrid from "./MonthGrid";
import styles from "./Calendar.module.css";

export default function CalendarView() {
  const { currentView, currentDate, navigate, goToday } = useAppState();
  const weekDays = getWeekDays(currentDate);

  return (
    <div className={styles.panelCenter}>
      <div className={styles.centerHeader}>
        <div className={styles.centerTitle}>
          <CalendarTitle weekDays={weekDays} />
        </div>
        <div className={styles.navCluster}>
          <button className={`${styles.todayLink} sans`} onClick={goToday}>
            Today
          </button>
          <button onClick={() => navigate(-1)} aria-label="Previous">
            ‹
          </button>
          <button onClick={() => navigate(1)} aria-label="Next">
            ›
          </button>
        </div>
      </div>

      <div className={styles.viewBody}>
        {currentView === "day" && <TimeGrid days={[currentDate]} />}
        {currentView === "week" && <TimeGrid days={weekDays} />}
        {currentView === "month" && <MonthGrid anchor={currentDate} />}
      </div>
    </div>
  );
}

interface CalendarTitleProps {
  weekDays: Date[];
}

function CalendarTitle({ weekDays }: CalendarTitleProps) {
  const { currentView, currentDate } = useAppState();

  if (currentView === "day") {
    return (
      <>
        {currentDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </>
    );
  }

  if (currentView === "month") {
    return (
      <>
        {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
      </>
    );
  }

  // week
  const startMonth = MONTH_SHORT[weekDays[0].getMonth()];
  const endMonth = MONTH_SHORT[weekDays[6].getMonth()];
  return (
    <>
      {startMonth === endMonth
        ? `${MONTH_NAMES[weekDays[0].getMonth()]} ${weekDays[0].getFullYear()}`
        : `${startMonth} – ${endMonth} ${weekDays[6].getFullYear()}`}
    </>
  );
}
