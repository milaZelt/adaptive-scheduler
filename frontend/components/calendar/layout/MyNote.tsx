"use client";

import React from "react";
import { useAppState } from "../state/AppStateContext";
import type { NoteSaveState } from "../state/useNote";
import styles from "./RightPanel.module.css";

function statusText(state: NoteSaveState): string {
  switch (state) {
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "error":
      return "Couldn't save";
    default:
      return "";
  }
}

export default function MyNote() {
  const { note, setNote, noteLoading, noteSaveState } = useAppState();

  return (
    <div>
      <div className={styles.noteLabel}>
        <span>My Note</span>
        {statusText(noteSaveState) && (
          <span
            className={`${styles.noteStatus} ${noteSaveState === "error" ? styles.noteStatusError : ""}`}
          >
            {statusText(noteSaveState)}
          </span>
        )}
      </div>
      <textarea
        className={styles.noteText}
        placeholder={noteLoading ? "Loading…" : "Write yourself a note..."}
        value={note}
        disabled={noteLoading}
        onChange={(e) => setNote(e.target.value)}
        rows={4}
      />
    </div>
  );
}
