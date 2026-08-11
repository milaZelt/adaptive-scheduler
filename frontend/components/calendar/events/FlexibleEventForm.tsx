"use client";

import React, { useState } from "react";
import type { FlexibleTask, Priority } from "@/lib/calendar/types";
import { useAppState } from "../state/AppStateContext";
import { addDays, toISODate } from "@/lib/calendar/dateUtils";
import { PLANNING_HORIZON_DAYS } from "@/lib/calendar/constants";
import Drawer from "./Drawer";
import Button from "@/components/ui/Button";
import fieldStyles from "./FormFields.module.css";

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
  const [estimateHours, setEstimateHours] = useState(
    prefill?.estimateHours != null ? String(prefill.estimateHours) : "",
  );
  const [splitOk, setSplitOk] = useState(prefill?.splitOk ?? false);
  const [sessionMin, setSessionMin] = useState(
    prefill?.sessionMin != null ? String(prefill.sessionMin) : "",
  );
  const [sessionMax, setSessionMax] = useState(
    prefill?.sessionMax != null ? String(prefill.sessionMax) : "",
  );
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

  const timeValid = estimateHours !== "" && Number(estimateHours) > 0;
  const splitValid =
    !splitOk ||
    (sessionMin !== "" &&
      sessionMax !== "" &&
      Number(sessionMax) >= Number(sessionMin) &&
      Number(sessionMin) > 0);
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
      estimateHours: Number(estimateHours),
      splitOk,
      sessionMin: splitOk ? Number(sessionMin) : null,
      sessionMax: splitOk ? Number(sessionMax) : null,
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
      title={isEdit ? "Edit Flexible Task" : "New Flexible Task"}
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

      <div className={fieldStyles.field}>
        <div className={fieldStyles.fieldLabel}>
          <span className={fieldStyles.req}>*</span>Time Estimate (hrs)
        </div>
        <input
          className={fieldStyles.fieldInput}
          type="number"
          min={0.25}
          step={0.25}
          placeholder="Hours"
          value={estimateHours}
          onChange={(e) => setEstimateHours(e.target.value)}
        />
      </div>

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
        <div className={fieldStyles.fieldRow}>
          <div className={fieldStyles.field}>
            <div className={fieldStyles.fieldLabel}>
              <span className={fieldStyles.req}>*</span>Min Session (hrs)
            </div>
            <input
              className={fieldStyles.fieldInput}
              type="number"
              min={0.25}
              step={0.25}
              value={sessionMin}
              onChange={(e) => setSessionMin(e.target.value)}
            />
          </div>
          <div className={fieldStyles.field}>
            <div className={fieldStyles.fieldLabel}>
              <span className={fieldStyles.req}>*</span>Max Session (hrs)
            </div>
            <input
              className={fieldStyles.fieldInput}
              type="number"
              min={0.25}
              step={0.25}
              value={sessionMax}
              onChange={(e) => setSessionMax(e.target.value)}
            />
          </div>
        </div>
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
        <select
          className={fieldStyles.fieldInput}
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority | "")}
        >
          <option value="">Select priority</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
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
