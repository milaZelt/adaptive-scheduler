"use client";

import React, { useRef, useState } from "react";
import { useAppState } from "../state/AppStateContext";
import ContextMenu from "@/components/ui/ContextMenu";
import styles from "./Sidebar.module.css";

export default function ActionRow() {
  const { openFixedEventDrawer, openFlexibleEventDrawer, updateSchedule, updatingSchedule } = useAppState();
  const createBtnRef = useRef<HTMLButtonElement>(null);
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);

  return (
    <div className={styles.actionRow}>
      <button
        ref={createBtnRef}
        className={`${styles.linkBtn} sans`}
        onClick={() => setMenuAnchor(createBtnRef.current?.getBoundingClientRect() ?? null)}
      >
        Create <span>+</span>
      </button>
      {menuAnchor && (
        <ContextMenu
          anchorRect={menuAnchor}
          align="left"
          onClose={() => setMenuAnchor(null)}
          items={[
            {
              label: "Event",
              subtitle: "You choose when",
              onClick: () => {
                setMenuAnchor(null);
                openFixedEventDrawer();
              },
            },
            {
              label: "Task",
              subtitle: "Nextly finds the time",
              onClick: () => {
                setMenuAnchor(null);
                openFlexibleEventDrawer();
              },
            },
          ]}
        />
      )}

      <button
        className={`${styles.linkBtn} sans`}
        disabled={updatingSchedule}
        onClick={() => updateSchedule()}
      >
        {updatingSchedule ? "Updating…" : "Update Schedule"} <span>↻</span>
      </button>
    </div>
  );
}
