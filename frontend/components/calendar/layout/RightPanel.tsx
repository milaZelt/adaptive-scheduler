"use client";

import React from "react";
import MyNote from "./MyNote";
import StatusList from "./StatusList";
import styles from "./RightPanel.module.css";

export default function RightPanel() {
  return (
    <div className={styles.panelRight}>
      <MyNote />
      <StatusList />
    </div>
  );
}
