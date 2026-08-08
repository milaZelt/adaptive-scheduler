import type { Category, CategoryId } from "@/lib/calendar/data";
import styles from "./Sidebar.module.css";

export default function Sidebar({
  categories,
  activeCategories,
  onToggle,
}: {
  categories: Category[];
  activeCategories: ReadonlySet<CategoryId>;
  onToggle: (id: CategoryId) => void;
}) {
  return (
    <div className={styles.sidebar}>
      <button type="button" className={styles.btnCreate}>
        + Create
      </button>
      <button type="button" className={styles.btnRegenerate}>
        ↻ Regenerate
      </button>

      <div className={styles.sectionLabel}>Calendar Categories</div>
      <ul className={styles.categoryList}>
        {categories.map((category) => {
          const isOn = activeCategories.has(category.id);
          return (
            <li key={category.id}>
              <label
                className={`${styles.categoryItem} ${isOn ? "" : styles.off}`}
              >
                <input
                  type="checkbox"
                  className={styles.hiddenInput}
                  checked={isOn}
                  onChange={() => onToggle(category.id)}
                />
                <span
                  className={`${styles.checkbox} ${isOn ? styles.checked : ""}`}
                  aria-hidden="true"
                />
                {category.label}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
