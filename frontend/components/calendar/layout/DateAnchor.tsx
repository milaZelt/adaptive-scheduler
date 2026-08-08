"use client";

import React from "react";
import { useAppState } from "../state/AppStateContext";
import { DOW_LONG, MONTH_NAMES } from "@/lib/calendar/constants";
import styles from "./Sidebar.module.css";

export default function DateAnchor() {
  const { today } = useAppState();

  return (
    <div className={styles.dateAnchor}>
      <div className={`${styles.daDow} sans`}>{DOW_LONG[today.getDay()].toUpperCase()}</div>
      <div className={styles.daNum}>{today.getDate()}</div>
      <div className={styles.daMonth}>
        {MONTH_NAMES[today.getMonth()]} {today.getFullYear()}
      </div>
    </div>
  );
}
