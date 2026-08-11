"use client";

import React, { useState } from "react";
import type { FlexibleTask, Priority } from "@/lib/calendar/types";
import { useAppState } from "../state/AppStateContext";
import { addDays, toISODate } from "@/lib/calendar/dateUtils";
import { PLANNING_HORIZON_DAYS } from "@/lib/calendar/constants";
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

/** decimal hours <-> separate hours/minutes form fields, snapping to the
 *  nearest 15-min option - storage stays a single decimal number throughout
 *  (FlexibleTask.estimateHours/sessionMin/sessionMax, DB numeric(5,2)),
 *  this only changes how the value is entered. Snapping matters for editing
 *  older rows saved before this UI existed, which may not land on a
 *  15-min boundary. */
function decimalToHM(decimal: number): { h: string; m: string } {
  const totalMinutes = Math.round(decimal * 60);
  const h = Math.floor(totalMinutes / 60);
  const snappedM = Math.round((totalMinutes % 60) / 15) * 15;
  return snappedM === 60 ? { h: String(h + 1), m: "0" } : { h: String(h), m: String(snappedM) };
}

function hmToDecimal(h: string, m: string): number {
  return (h === "" ? 0 : Number(h)) + (m === "" ? 0 : Number(m)) / 60;
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
  const { today, categories, showToast, createFlexibleTask, updateFlexibleTask } = useAppState();
  const isEdit = !!prefill;
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(prefill?.title ?? "");
  const [deadline, setDeadline] = useState(prefill?.deadline ?? "");

  const initialEstimate = prefill?.estimateHours != null ? decimalToHM(prefill.estimateHours) : { h: "", m: "0" };
  const [estHours, setEstHours] = useState(initialEstimate.h);
  const [estMinutes, setEstMinutes] = useState(initialEstimate.m);

  const [splitOk, setSplitOk] = useState(prefill?.splitOk ?? false);

  const initialMin = prefill?.sessionMin != null ? decimalToHM(prefill.sessionMin) : { h: "", m: "0" };
  const [minHours, setMinHours] = useState(initialMin.h);
  const [minMinutes, setMinMinutes] = useState(initialMin.m);

  const initialMax = prefill?.sessionMax != null ? decimalToHM(prefill.sessionMax) : { h: "", m: "0" };
  const [maxHours, setMaxHours] = useState(initialMax.h);
  const [maxMinutes, setMaxMinutes] = useState(initialMax.m);

  const [description, setDescription] = useState(prefill?.description ?? "");
  const [priority, setPriority] = useState<Priority | "">(prefill?.priority ?? "");
  const [categoryId, setCategoryId] = useState(prefill?.categoryId ?? categories[0]?.id ?? "");

  // Horizon check (decisions record, round 3): a deadline beyond the rolling
  // planning window isn't tracked long-term. Rather than collect a second,
  // parallel "near-term" allocation in a shadow panel, the Deadline and Time
  // Estimate fields below are always what actually gets saved — an
  // out-of-window date just blocks Save until the user adjusts it.
  const todayISO = toISODate(today);
  const horizonEndDate = addDays(today, PLANNING_HORIZON_DAYS - 1);
  const horizonEndISO = toISODate(horizonEndDate);
  const horizonEndLabel = horizonEndDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const parsedDeadline = deadline ? new Date(deadline + "T00:00:00") : null;
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

    // Editing marks the schedule stale (decisions record, round 4) - reset
    // so a previously-placed task doesn't keep showing a now-outdated status.
    const success = isEdit
      ? await updateFlexibleTask(prefill!.id, { ...payload, schedulingStatus: "not_yet_scheduled" })
      : (await createFlexibleTask(payload)) !== null;

    setSaving(false);
    if (success) {
      showToast(isEdit ? "Task updated" : "Task created");
      onClose();
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
            {horizonEndLabel}). Set a deadline within that window for what you want done now — Time
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
          options={categories.map((c) => ({ value: c.id, label: c.name, color: c.color }))}
          placeholder="Select calendar"
        />
      </div>
    </Drawer>
  );
}
