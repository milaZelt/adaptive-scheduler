"use client";

import React, { useRef, useState } from "react";
import Popover from "@/components/ui/Popover";
import { fmtHour, timeInputToDecimal } from "@/lib/calendar/dateUtils";
import styles from "./SettingsButton.module.css";

// Display-only for now - these become editable once the scheduler backend
// can actually respect them.
const SCHEDULING_SETTINGS = {
  startTime: "08:00",
  endTime: "23:00",
  minBreakMinutes: 30,
};

function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export default function SettingsButton() {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={styles.gearBtn}
        aria-label="Scheduling settings"
        onClick={() => setAnchor(btnRef.current?.getBoundingClientRect() ?? null)}
      >
        <GearIcon />
      </button>

      {anchor && (
        <Popover anchorRect={anchor} width={220} onClose={() => setAnchor(null)}>
          <div className={styles.title}>Settings</div>

          <div className={styles.row}>
            <span className={styles.fieldLabel}>Allowed start time</span>
            <span className={styles.value}>
              {fmtHour(timeInputToDecimal(SCHEDULING_SETTINGS.startTime))}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.fieldLabel}>Allowed end time</span>
            <span className={styles.value}>
              {fmtHour(timeInputToDecimal(SCHEDULING_SETTINGS.endTime))}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.fieldLabel}>Minimum break</span>
            <span className={styles.value}>{SCHEDULING_SETTINGS.minBreakMinutes} min</span>
          </div>
        </Popover>
      )}
    </>
  );
}
