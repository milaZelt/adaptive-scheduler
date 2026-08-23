"use client";

import React, { useState } from "react";
import MyNote from "./MyNote";
import StatusList from "./StatusList";
import styles from "./RightPanel.module.css";

export default function RightPanel() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`${styles.panelRight} ${collapsed ? styles.collapsed : ""}`}>
      <button
        type="button"
        className={styles.toggleBtn}
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Show notes and status panel" : "Hide notes and status panel"}
        aria-expanded={!collapsed}
      >
        {collapsed ? "‹" : "›"}
      </button>
      <div className={styles.panelContent}>
        <MyNote />
        <StatusList />
      </div>
    </div>
  );
}
