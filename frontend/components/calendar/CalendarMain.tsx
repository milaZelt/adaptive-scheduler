import type { CategoryId } from "@/lib/calendar/data";
import {
  formatDayTitle,
  formatMonthTitle,
  formatWeekTitle,
  startOfWeek,
  weekDays,
} from "@/lib/calendar/date";
import type { View } from "./CalendarApp";
import HourlyGrid from "./HourlyGrid";
import MonthGrid from "./MonthGrid";
import styles from "./CalendarMain.module.css";

export default function CalendarMain({
  view,
  currentDate,
  today,
  activeCategories,
  onToday,
  onNavigate,
}: {
  view: View;
  currentDate: Date;
  today: Date;
  activeCategories: ReadonlySet<CategoryId>;
  onToday: () => void;
  onNavigate: (direction: 1 | -1) => void;
}) {
  const days =
    view === "day" ? [currentDate] : weekDays(startOfWeek(currentDate));

  const title =
    view === "day"
      ? formatDayTitle(currentDate)
      : view === "week"
        ? formatWeekTitle(days)
        : formatMonthTitle(currentDate);

  return (
    <div className={styles.main}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button type="button" className={styles.todayButton} onClick={onToday}>
            Today
          </button>
          <div className={styles.nav}>
            <button
              type="button"
              className={styles.navButton}
              onClick={() => onNavigate(-1)}
              aria-label="Previous"
            >
              ‹
            </button>
            <button
              type="button"
              className={styles.navButton}
              onClick={() => onNavigate(1)}
              aria-label="Next"
            >
              ›
            </button>
          </div>
          <div className={styles.title}>{title}</div>
        </div>
      </div>

      {view === "month" ? (
        <MonthGrid
          monthDate={currentDate}
          today={today}
          activeCategories={activeCategories}
        />
      ) : (
        <HourlyGrid days={days} today={today} activeCategories={activeCategories} />
      )}
    </div>
  );
}
