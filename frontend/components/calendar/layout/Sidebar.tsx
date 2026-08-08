"use client";

import React from "react";
import DateAnchor from "./DateAnchor";
import ActionRow from "./ActionRow";
import CategorySidebar from "../categories/CategorySidebar";
import styles from "./Sidebar.module.css";

export default function Sidebar() {
  return (
    <div className={styles.panelLeft}>
      <DateAnchor />
      <ActionRow />
      <CategorySidebar />
    </div>
  );
}
