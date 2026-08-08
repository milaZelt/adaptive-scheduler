"use client";

import React from "react";
import styles from "./RightPanel.module.css";

interface StatusMessage {
  text: string;
  warn?: boolean;
}

const DEMO_STATUS: StatusMessage[] = [
  { text: "All tasks placed. No conflicts detected." },
  { text: "“Gym” couldn’t fit today. Try Regenerate.", warn: true },
];

export default function StatusList() {
  return (
    <div>
      <div className={`${styles.statusLabel} sans`}>Status</div>
      {DEMO_STATUS.map((s) => (
        <div className={styles.statusItem} key={s.text}>
          <span className={`${styles.dot} ${s.warn ? styles.warn : ""}`} />
          {s.text}
        </div>
      ))}
    </div>
  );
}
