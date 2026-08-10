"use client";

import React from "react";
import MyNote from "./MyNote";
import FlexibleTaskList from "./FlexibleTaskList";
import StatusList from "./StatusList";
import styles from "./RightPanel.module.css";

export default function RightPanel() {
  return (
    <div className={styles.panelRight}>
      <MyNote />
      <FlexibleTaskList />
      <StatusList />
    </div>
  );
}
