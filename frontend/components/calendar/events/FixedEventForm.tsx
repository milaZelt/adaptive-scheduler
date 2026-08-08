"use client";

import React, { useState } from "react";
import type { CalendarEvent, FixedEventFormState, RepeatOption } from "@/lib/calendar/types";
import { useAppState } from "../state/AppStateContext";
import { toISODate, decimalToTimeInput, timeInputToDecimal } from "@/lib/calendar/dateUtils";
import { defaultCustomRecurrence, repeatOptionLabel } from "@/lib/calendar/recurrence";
import Drawer from "./Drawer";
import CustomRepeatPanel from "./CustomRepeatPanel";
import Button from "@/components/ui/Button";
import fieldStyles from "./FormFields.module.css";

const STATIC_REPEAT_OPTIONS: Exclude<RepeatOption, "custom">[] = [
  "none",
  "daily",
  "weekly",
  "monthly",
  "annually",
  "weekday",
];

interface FixedEventFormProps {
  prefill?: CalendarEvent;
  onClose: () => void;
}

export default function FixedEventForm({ prefill, onClose }: FixedEventFormProps) {
  const { currentDate, categories, showToast } = useAppState();
  const isEdit = !!prefill;

  const initialDate = prefill ? new Date(prefill.date + "T00:00:00") : new Date(currentDate);

  const [title, setTitle] = useState(prefill?.title ?? "");
  const [date, setDate] = useState(toISODate(initialDate));
  const [allDay, setAllDay] = useState(prefill?.allDay ?? false);
  const [start, setStart] = useState(
    prefill && !prefill.allDay && prefill.start !== null
      ? decimalToTimeInput(prefill.start)
      : "09:00",
  );
  const [end, setEnd] = useState(
    prefill && !prefill.allDay && prefill.end !== null ? decimalToTimeInput(prefill.end) : "10:00",
  );
  const [repeat, setRepeat] = useState<RepeatOption>(prefill?.repeat ?? "none");
  const [customRecurrence, setCustomRecurrence] = useState(
    prefill?.customRecurrence ?? defaultCustomRecurrence(initialDate),
  );
  const [description, setDescription] = useState(prefill?.description ?? "");
  const [categoryId, setCategoryId] = useState(prefill?.categoryId ?? categories[0]?.id ?? "");

  const dateForLabels = (() => {
    const d = new Date(date + "T00:00:00");
    return isNaN(d.getTime()) ? initialDate : d;
  })();

  const timeValid = allDay || (start && end);
  const canSave = Boolean(title.trim() && date && timeValid && categoryId);

  function handleSave() {
    const formState: FixedEventFormState = {
      mode: isEdit ? "edit" : "create",
      id: isEdit ? prefill!.id : null,
      type: "fixed",
      title: title.trim(),
      date,
      allDay,
      start: allDay ? null : timeInputToDecimal(start),
      end: allDay ? null : timeInputToDecimal(end),
      repeat,
      customRecurrence: repeat === "custom" ? customRecurrence : null,
      description,
      categoryId,
    };
    console.log("Fixed event form state:", formState);
    showToast("Saved — check console");
    onClose();
  }

  return (
    <Drawer
      title={isEdit ? "Edit Event" : "New Fixed Event"}
      onClose={onClose}
      footer={
        <Button variant="primary" disabled={!canSave} onClick={handleSave}>
          Save
        </Button>
      }
    >
      <div className={fieldStyles.field}>
        <div className={fieldStyles.fieldLabel}>
          <span className={fieldStyles.req}>*</span>Title
        </div>
        <input
          className={fieldStyles.fieldInput}
          type="text"
          placeholder="Event title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className={fieldStyles.field}>
        <div className={fieldStyles.fieldLabel}>
          <span className={fieldStyles.req}>*</span>Date
        </div>
        <input
          className={fieldStyles.fieldInput}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className={fieldStyles.checkRow}>
        <input
          type="checkbox"
          id="fx-allday"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
        />
        <label htmlFor="fx-allday">All day</label>
      </div>

      {!allDay && (
        <div className={fieldStyles.fieldRow}>
          <div className={fieldStyles.field}>
            <div className={fieldStyles.fieldLabel}>
              <span className={fieldStyles.req}>*</span>Start Time
            </div>
            <input
              className={fieldStyles.fieldInput}
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className={fieldStyles.field}>
            <div className={fieldStyles.fieldLabel}>
              <span className={fieldStyles.req}>*</span>End Time
            </div>
            <input
              className={fieldStyles.fieldInput}
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className={fieldStyles.field}>
        <div className={fieldStyles.fieldLabel}>Repeat</div>
        <select
          className={fieldStyles.fieldInput}
          value={repeat}
          onChange={(e) => setRepeat(e.target.value as RepeatOption)}
        >
          {STATIC_REPEAT_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {repeatOptionLabel(opt, dateForLabels)}
            </option>
          ))}
          <option value="custom">Custom...</option>
        </select>

        {repeat === "custom" && (
          <CustomRepeatPanel value={customRecurrence} onChange={setCustomRecurrence} />
        )}
      </div>

      <div className={fieldStyles.field}>
        <div className={fieldStyles.fieldLabel}>Description</div>
        <textarea
          className={fieldStyles.fieldInput}
          placeholder="Optional details"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className={fieldStyles.field}>
        <div className={fieldStyles.fieldLabel}>
          <span className={fieldStyles.req}>*</span>Calendar
        </div>
        <select
          className={fieldStyles.fieldInput}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </Drawer>
  );
}
