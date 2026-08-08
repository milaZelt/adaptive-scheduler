"use client";

import React from "react";
import { useAppState } from "../state/AppStateContext";
import type { ViewType } from "@/lib/calendar/types";
import LogoutButton from "./LogoutButton";
import SettingsButton from "./SettingsButton";
import styles from "./TopBar.module.css";

const VIEWS: { key: ViewType; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

export default function TopBar() {
  const { currentView, setView } = useAppState();

  return (
    <div className={styles.topbar}>
      <div className={styles.logo}>Nextly</div>

      <div className={`${styles.viewToggle} sans`}>
        {VIEWS.map((v) => (
          <button
            key={v.key}
            className={currentView === v.key ? styles.active : ""}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className={styles.actions}>
        <SettingsButton />
        <LogoutButton />
      </div>
    </div>
  );
}
