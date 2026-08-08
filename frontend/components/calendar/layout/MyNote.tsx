"use client";

import React, { useState } from "react";
import styles from "./RightPanel.module.css";

export default function MyNote() {
  const [note, setNote] = useState("");

  return (
    <div>
      <div className={styles.noteLabel}>My Note</div>
      <textarea
        className={styles.noteText}
        placeholder="Write yourself a note..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={4}
      />
    </div>
  );
}
