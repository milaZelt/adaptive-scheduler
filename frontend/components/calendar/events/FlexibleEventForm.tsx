"use client";

import React, { useState } from "react";
import type { FlexibleTask, Priority } from "@/lib/calendar/types";
import { useAppState } from "../state/AppStateContext";
import { addDays, parseLocalDate, toISODate } from "@/lib/calendar/dateUtils";
import { PLANNING_HORIZON_DAYS } from "@/lib/calendar/constants";
import { getSelectableCategories } from "@/lib/calendar/categories";
import Drawer from "./Drawer";
import Button from "@/components/ui/Button";
import Select, { type SelectOption } from "@/components/ui/Select";
import fieldStyles from "./FormFields.module.css";

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: "High", label: "High" },
  { value: "Medium", label: "Medium" },
  { value: "Low", label: "Low" },
];

const MINUTE_OPTIONS: SelectOption[] = [
  { value: "0", label: "0 min" },
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
];

/** Converts decimal hours to separate hour/minute fields, snapped to the
 *  nearest 15 minutes. Storage always stays decimal - this only changes
 *  how the value is entered. Snapping matters for old rows that may not
 *  land on a 15-min boundary. */
function decimalToHM(decimal: number): { h: string; m: string } {
  const totalMinutes = Math.round(decimal * 60);
  const h = Math.floor(totalMinutes / 60);
  const snappedM = Math.round((totalMinutes % 60) / 15) * 15;
  return snappedM === 60 ? { h: String(h + 1), m: "0" } : { h: String(h), m: String(snappedM) };
}

function hmToDecimal(h: string, m: string): number {
  return (h === "" ? 0 : Number(h)) + (m === "" ? 0 : Number(m)) / 60;
}

/** Hours/minutes state for one duration field, starting from an optional
 *  prefill value. Estimate, min-session, and max-session all need the same
 *  two useState calls, so this is a hook instead of three copies of the
 *  same code. */
function useDurationField(
  initialDecimal: number | null | undefined,
): [string, string, (v: string) => void, (v: string) => void] {
  const initial = initialDecimal != null ? decimalToHM(initialDecimal) : { h: "", m: "0" };
  const [hours, setHours] = useState(initial.h);
  const [minutes, setMinutes] = useState(initial.m);
  return [hours, minutes, setHours, setMinutes];
}

interface DurationFieldProps {
  label: string;
  hours: string;
  minutes: string;
  onHoursChange: (v: string) => void;
  onMinutesChange: (v: string) => void;
}

function DurationField({ label, hours, minutes, onHoursChange, onMinutesChange }: DurationFieldProps) {
  return (
    <div className={fieldStyles.field}>
      <div className={fieldStyles.fieldLabel}>
        <span className={fieldStyles.req}>*</span>
        {label}
      </div>
      <div className={fieldStyles.fieldRow}>
        <div className={fieldStyles.field}>
          <input
            className={fieldStyles.fieldInput}
            type="number"
            min={0}
            step={1}
            placeholder="Hours"
            value={hours}
            onChange={(e) => onHoursChange(e.target.value)}
          />
        </div>
        <div className={fieldStyles.field}>
          <Select value={minutes} onChange={onMinutesChange} options={MINUTE_OPTIONS} />
        </div>
      </div>
    </div>
  );
}

interface FlexibleEventFormProps {
  prefill?: FlexibleTask;
  onClose: () => void;
}

export default function FlexibleEventForm({ prefill, onClose }: FlexibleEventFormProps) {
  const { today, categories, showToast, reportSystemError, createFlexibleTask, updateFlexibleTask } =
    useAppState();
  const isEdit = !!prefill;
  const [saving, setSaving] = useState(false);

  const selectableCategories = getSelectableCategories(categories);

  const [title, setTitle] = useState(prefill?.title ?? "");
  const [deadline, setDeadline] = useState(prefill?.deadline ?? "");

  const [estHours, estMinutes, setEstHours, setEstMinutes] = useDurationField(prefill?.estimateHours);

  const [splitOk, setSplitOk] = useState(prefill?.splitOk ?? false);

  const [minHours, minMinutes, setMinHours, setMinMinutes] = useDurationField(prefill?.sessionMin);
  const [maxHours, maxMinutes, setMaxHours, setMaxMinutes] = useDurationField(prefill?.sessionMax);

  const [description, setDescription] = useState(prefill?.description ?? "");
  const [priority, setPriority] = useState<Priority | "">(prefill?.priority ?? "");
  const [categoryId, setCategoryId] = useState(prefill?.categoryId ?? selectableCategories[0]?.id ?? "");

  // Deadlines past the planning window aren't tracked long-term. Instead
  // of adding separate fields for that, Save just stays blocked until the
  // user picks a date inside the window.
  const todayISO = toISODate(today);
  const horizonEndDate = addDays(today, PLANNING_HORIZON_DAYS - 1);
  const horizonEndISO = toISODate(horizonEndDate);
  const horizonEndLabel = horizonEndDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const parsedDeadline = deadline ? parseLocalDate(deadline) : null;
  const isOutOfWindow = Boolean(
    parsedDeadline && !isNaN(parsedDeadline.getTime()) && toISODate(parsedDeadline) > horizonEndISO,
  );

  const estimateDecimal = hmToDecimal(estHours, estMinutes);
  const sessionMinDecimal = hmToDecimal(minHours, minMinutes);
  const sessionMaxDecimal = hmToDecimal(maxHours, maxMinutes);

  const timeValid = estimateDecimal > 0;
  const splitValid = !splitOk || (sessionMinDecimal > 0 && sessionMaxDecimal >= sessionMinDecimal);
  const canSave = Boolean(
    title.trim() && priority && categoryId && deadline && !isOutOfWindow && timeValid && splitValid,
  );

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);

    const payload: Omit<FlexibleTask, "id" | "schedulingStatus" | "createdAt" | "updatedAt"> = {
      title: title.trim(),
      categoryId,
      priority: priority as Priority,
      deadline,
      estimateHours: estimateDecimal,
      splitOk,
      sessionMin: splitOk ? sessionMinDecimal : null,
      sessionMax: splitOk ? sessionMaxDecimal : null,
      description: description.trim() || undefined,
    };

    // Editing a task marks the schedule stale, so this resets its status
    // too. Otherwise it would keep showing an old, outdated placement.
    const success = isEdit
      ? await updateFlexibleTask(prefill!.id, { ...payload, schedulingStatus: "not_yet_scheduled" })
      : (await createFlexibleTask(payload)) !== null;

    setSaving(false);
    if (success) {
      showToast(isEdit ? "Task updated" : "Task created");
      onClose();
    } else {
      reportSystemError("Couldn't save that task. Please try again.");
    }
  }

  return (
    <Drawer
      title={isEdit ? "Edit Task" : "New Task"}
      onClose={onClose}
      footer={
        <Button variant="primary" disabled={!canSave || saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save"}
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
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className={fieldStyles.field}>
        <div className={fieldStyles.fieldLabel}>
          <span className={fieldStyles.req}>*</span>Deadline
        </div>
        <input
          className={fieldStyles.fieldInput}
          type="date"
          min={todayISO}
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>

      {isOutOfWindow && (
        <div className={fieldStyles.horizonNotice}>
          <p className={fieldStyles.horizonNoticeText}>
            That&rsquo;s outside Nextly&rsquo;s {PLANNING_HORIZON_DAYS}-day planning window (through{" "}
            {horizonEndLabel}). Set a deadline within that window for what you want done now. Time
            Estimate below is for that portion of the work.
          </p>
          <Button variant="plain" size="mini" onClick={() => setDeadline(horizonEndISO)}>
            Use {horizonEndLabel}
          </Button>
        </div>
      )}

      <DurationField
        label="Time Estimate"
        hours={estHours}
        minutes={estMinutes}
        onHoursChange={setEstHours}
        onMinutesChange={setEstMinutes}
      />

      <div className={fieldStyles.checkRow}>
        <input
          type="checkbox"
          id="fl-split"
          checked={splitOk}
          onChange={(e) => setSplitOk(e.target.checked)}
        />
        <label htmlFor="fl-split">Can this be split into sessions?</label>
      </div>

      {splitOk && (
        <>
          <DurationField
            label="Min Session"
            hours={minHours}
            minutes={minMinutes}
            onHoursChange={setMinHours}
            onMinutesChange={setMinMinutes}
          />
          <DurationField
            label="Max Session"
            hours={maxHours}
            minutes={maxMinutes}
            onHoursChange={setMaxHours}
            onMinutesChange={setMaxMinutes}
          />
        </>
      )}

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
          <span className={fieldStyles.req}>*</span>Priority
        </div>
        <Select
          value={priority}
          onChange={(v) => setPriority(v as Priority)}
          options={PRIORITY_OPTIONS}
          placeholder="Select priority"
        />
      </div>

      <div className={fieldStyles.field}>
        <div className={fieldStyles.fieldLabel}>
          <span className={fieldStyles.req}>*</span>Calendar
        </div>
        <Select
          value={categoryId}
          onChange={setCategoryId}
          options={selectableCategories.map((c) => ({ value: c.id, label: c.name, color: c.color }))}
          placeholder="Select calendar"
        />
      </div>
    </Drawer>
  );
}
