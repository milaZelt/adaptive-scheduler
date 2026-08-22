import styles from "./DemoBanner.module.css";

export default function DemoBanner() {
  return (
    <div className={styles.banner}>
      Demo mode: changes are temporary and limited to 5 tasks and 5 events.
    </div>
  );
}
