import LogoutButton from "@/components/calendar/LogoutButton";
import type { View } from "./CalendarApp";
import styles from "./TopBar.module.css";

const VIEWS: View[] = ["day", "week", "month"];

export default function TopBar({
  view,
  onViewChange,
}: {
  view: View;
  onViewChange: (view: View) => void;
}) {
  return (
    <div className={styles.topbar}>
      <div className={styles.logo}>Nextly</div>
      <div className={styles.viewToggle}>
        {VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            className={`${styles.viewButton} ${v === view ? styles.active : ""}`}
            onClick={() => onViewChange(v)}
          >
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>
      <LogoutButton />
    </div>
  );
}
