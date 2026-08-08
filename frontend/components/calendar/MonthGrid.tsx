import { categories, getEventsForDate, type CategoryId } from "@/lib/calendar/data";
import { DOW_SHORT, buildMonthCells, sameDay } from "@/lib/calendar/date";
import styles from "./MonthGrid.module.css";

const MAX_VISIBLE_EVENTS = 3;

export default function MonthGrid({
  monthDate,
  today,
  activeCategories,
}: {
  monthDate: Date;
  today: Date;
  activeCategories: ReadonlySet<CategoryId>;
}) {
  const cells = buildMonthCells(monthDate);

  const categoryStyle = (id: CategoryId) => {
    const category = categories.find((c) => c.id === id);
    return category
      ? { background: category.bg, borderLeftColor: category.border }
      : undefined;
  };

  return (
    <div className={styles.monthGrid}>
      {DOW_SHORT.map((label) => (
        <div key={label} className={styles.monthDow}>
          {label}
        </div>
      ))}

      {cells.map((day) => {
        const inMonth = day.getMonth() === monthDate.getMonth();
        const isToday = sameDay(day, today);
        const events = getEventsForDate(day, activeCategories);
        const shown = events.slice(0, MAX_VISIBLE_EVENTS);
        const extra = events.length - shown.length;

        return (
          <div
            key={day.toISOString()}
            className={`${styles.monthCell} ${inMonth ? "" : styles.otherMonth} ${isToday ? styles.today : ""}`}
          >
            <span className={styles.monthDate}>{day.getDate()}</span>
            {shown.map((event) => (
              <div
                key={`${event.title}-${event.start}`}
                className={styles.monthEvent}
                style={categoryStyle(event.category)}
              >
                {event.title}
              </div>
            ))}
            {extra > 0 && <div className={styles.monthMore}>+{extra} more</div>}
          </div>
        );
      })}
    </div>
  );
}
