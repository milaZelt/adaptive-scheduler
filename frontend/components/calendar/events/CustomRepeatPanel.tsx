"use client";

import React from "react";
import type { CustomRecurrence, RecurrenceUnit } from "@/lib/calendar/types";
import { DOW_SHORT } from "@/lib/calendar/constants";
import { formatCustomRecurrenceSummary } from "@/lib/calendar/recurrence";
import styles from "./CustomRepeatPanel.module.css";

const UNIT_OPTIONS: { value: RecurrenceUnit; singular: string; plural: string }[] = [
  { value: "day", singular: "day", plural: "days" },
  { value: "week", singular: "week", plural: "weeks" },
  { value: "month", singular: "month", plural: "months" },
  { value: "year", singular: "year", plural: "years" },
];

interface CustomRepeatPanelProps {
  value: CustomRecurrence;
  onChange: (value: CustomRecurrence) => void;
}

export default function CustomRepeatPanel({ value, onChange }: CustomRepeatPanelProps) {
  function toggleDay(day: number) {
    const next = value.daysOfWeek.includes(day)
      ? value.daysOfWeek.filter((d) => d !== day)
      : [...value.daysOfWeek, day];
    onChange({ ...value, daysOfWeek: next });
  }

  return (
    <div className={styles.panel}>
      <div className={styles.row}>
        <span className={styles.label}>Repeat every</span>
        <input
          className={styles.numberInput}
          type="number"
          min={1}
          value={value.interval}
          onChange={(e) => onChange({ ...value, interval: Math.max(1, Number(e.target.value)) })}
        />
        <select
          className={styles.unitSelect}
          value={value.unit}
          onChange={(e) => onChange({ ...value, unit: e.target.value as RecurrenceUnit })}
        >
          {UNIT_OPTIONS.map((u) => (
            <option key={u.value} value={u.value}>
              {value.interval === 1 ? u.singular : u.plural}
            </option>
          ))}
        </select>
      </div>

      {value.unit === "week" && (
        <div className={styles.dayToggleRow}>
          {DOW_SHORT.map((label, i) => (
            <button
              key={i}
              type="button"
              aria-label={label}
              aria-pressed={value.daysOfWeek.includes(i)}
              className={`${styles.dayToggle} ${value.daysOfWeek.includes(i) ? styles.dayToggleActive : ""}`}
              onClick={() => toggleDay(i)}
            >
              {label[0]}
            </button>
          ))}
        </div>
      )}

      <div className={styles.endsBlock}>
        <span className={styles.label}>Ends</span>
        <label className={styles.endOption}>
          <input
            type="radio"
            name="repeat-ends"
            checked={value.endType === "never"}
            onChange={() => onChange({ ...value, endType: "never" })}
          />
          Never
        </label>
        <label className={styles.endOption}>
          <input
            type="radio"
            name="repeat-ends"
            checked={value.endType === "on"}
            onChange={() => onChange({ ...value, endType: "on" })}
          />
          On
          <input
            type="date"
            className={styles.inlineInput}
            value={value.endDate}
            onFocus={() => onChange({ ...value, endType: "on" })}
            onChange={(e) => onChange({ ...value, endType: "on", endDate: e.target.value })}
          />
        </label>
        <label className={styles.endOption}>
          <input
            type="radio"
            name="repeat-ends"
            checked={value.endType === "after"}
            onChange={() => onChange({ ...value, endType: "after" })}
          />
          After
          <input
            type="number"
            min={1}
            className={`${styles.inlineInput} ${styles.inlineNumberInput}`}
            value={value.endCount}
            onFocus={() => onChange({ ...value, endType: "after" })}
            onChange={(e) =>
              onChange({ ...value, endType: "after", endCount: Math.max(1, Number(e.target.value)) })
            }
          />
          occurrences
        </label>
      </div>

      <p className={styles.summary}>{formatCustomRecurrenceSummary(value)}</p>
    </div>
  );
}
