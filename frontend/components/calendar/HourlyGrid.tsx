import { categories, getEventsForDate, type CategoryId } from "@/lib/calendar/data";
import { DOW_SHORT, formatEventTime, formatHourLabel, sameDay } from "@/lib/calendar/date";
import styles from "./HourlyGrid.module.css";

const START_HOUR = 6;
const END_HOUR = 23;
const ROW_HEIGHT = 48;

const hours = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, i) => START_HOUR + i,
);

export default function HourlyGrid({
  days,
  today,
  activeCategories,
}: {
  days: Date[];
  today: Date;
  activeCategories: ReadonlySet<CategoryId>;
}) {
  const categoryStyle = (id: CategoryId) => {
    const category = categories.find((c) => c.id === id);
    return category
      ? { background: category.bg, borderLeftColor: category.border }
      : undefined;
  };

  return (
    <div
      className={styles.hourlyGrid}
      style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}
    >
      <div style={{ background: "transparent" }} />
      {days.map((day) => {
        const isToday = sameDay(day, today);
        return (
          <div
            key={day.toISOString()}
            className={`${styles.dayHead} ${isToday ? styles.today : ""}`}
          >
            <div className={styles.dow}>{DOW_SHORT[day.getDay()]}</div>
            <div className={styles.dom}>{day.getDate()}</div>
          </div>
        );
      })}

      <div className={styles.timeCol}>
        {hours.map((hour) => (
          <div key={hour} className={styles.timeSlot}>
            {formatHourLabel(hour)}
          </div>
        ))}
      </div>

      {days.map((day) => {
        const events = getEventsForDate(day, activeCategories);
        return (
          <div key={day.toISOString()} className={styles.dayCol}>
            {events.map((event) => {
              const top = (event.start - START_HOUR) * ROW_HEIGHT;
              const height = (event.end - event.start) * ROW_HEIGHT;
              return (
                <div
                  key={`${event.title}-${event.start}`}
                  className={styles.event}
                  style={{ top, height, ...categoryStyle(event.category) }}
                >
                  {event.title}
                  <span className={styles.eventTime}>
                    {formatEventTime(event.start, event.end)}
                  </span>
                </div>
              );
            })}
            {hours.map((hour) => (
              <div key={hour} className={styles.hourCell} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
