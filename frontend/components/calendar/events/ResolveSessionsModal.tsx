"use client";

import React, { useState } from "react";
import type { SessionCompletionStatus, UnresolvedSessionInfo } from "@/lib/calendar/types";
import { fmtHour, parseLocalDate } from "@/lib/calendar/dateUtils";
import { useAppState } from "../state/AppStateContext";
import Drawer from "./Drawer";
import Button from "@/components/ui/Button";
import styles from "./ResolveSessionsModal.module.css";

interface ResolveSessionsModalProps {
  sessions: UnresolvedSessionInfo[];
  onClose: () => void;
  /** Called after every session is marked and saved. The caller uses this
   *  to re-run Update Schedule. */
  onResolved: () => void;
}

function dateLabel(iso: string): string {
  const d = parseLocalDate(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function ResolveSessionsModal({ sessions, onClose, onResolved }: ResolveSessionsModalProps) {
  const { markSessionCompletion, reportSystemError } = useAppState();
  const [choices, setChoices] = useState<Record<string, SessionCompletionStatus>>({});
  const [saving, setSaving] = useState(false);

  const allChosen = sessions.every((s) => choices[s.id] === "completed" || choices[s.id] === "missed");

  async function handleContinue() {
    if (!allChosen || saving) return;
    setSaving(true);

    const results = await Promise.all(
      sessions.map((s) => markSessionCompletion(s.id, choices[s.id] as "completed" | "missed")),
    );

    setSaving(false);
    if (results.every(Boolean)) {
      onResolved();
    } else {
      reportSystemError("Couldn't save some of those. Please try again.");
    }
  }

  return (
    <Drawer
      title="What happened with these?"
      onClose={onClose}
      footer={
        <Button variant="primary" disabled={!allChosen || saving} onClick={handleContinue}>
          {saving ? "Saving…" : "Continue"}
        </Button>
      }
    >
      <p className={styles.intro}>
        Before updating your schedule, let Nextly know whether these past sessions actually happened.
        It needs this to know how much work remains.
      </p>

      <div className={styles.list}>
        {sessions.map((s) => (
          <div className={styles.row} key={s.id}>
            <div className={styles.rowInfo}>
              <span className={styles.rowTitle}>{s.taskTitle}</span>
              <span className={styles.rowMeta}>
                {dateLabel(s.date)} · {fmtHour(s.start)} – {fmtHour(s.end)}
              </span>
            </div>
            <div className={styles.rowChoices}>
              <Button
                variant={choices[s.id] === "completed" ? "primary" : "plain"}
                size="mini"
                onClick={() => setChoices((cur) => ({ ...cur, [s.id]: "completed" }))}
              >
                Completed
              </Button>
              <Button
                variant={choices[s.id] === "missed" ? "danger" : "plain"}
                size="mini"
                onClick={() => setChoices((cur) => ({ ...cur, [s.id]: "missed" }))}
              >
                Missed
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Drawer>
  );
}
