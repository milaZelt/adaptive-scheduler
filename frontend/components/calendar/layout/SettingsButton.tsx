"use client";

import React, { useRef, useState } from "react";
import Popover from "@/components/ui/Popover";
import styles from "./SettingsButton.module.css";

interface SchedulingSettings {
  startTime: string;
  endTime: string;
  minBreakMinutes: number;
}

const DEFAULT_SETTINGS: SchedulingSettings = {
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
  const [settings, setSettings] = useState<SchedulingSettings>(DEFAULT_SETTINGS);

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
        <Popover anchorRect={anchor} width={240} onClose={() => setAnchor(null)}>
          <div className={styles.title}>Settings</div>

          <label className={styles.fieldLabel}>Allowed start time</label>
          <input
            className={styles.fieldInput}
            type="time"
            value={settings.startTime}
            onChange={(e) => setSettings((s) => ({ ...s, startTime: e.target.value }))}
          />

          <label className={styles.fieldLabel}>Allowed end time</label>
          <input
            className={styles.fieldInput}
            type="time"
            value={settings.endTime}
            onChange={(e) => setSettings((s) => ({ ...s, endTime: e.target.value }))}
          />

          <label className={styles.fieldLabel}>Minimum break (minutes)</label>
          <input
            className={styles.fieldInput}
            type="number"
            min={0}
            step={5}
            value={settings.minBreakMinutes}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                minBreakMinutes: Math.max(0, Number(e.target.value)),
              }))
            }
          />
        </Popover>
      )}
    </>
  );
}
