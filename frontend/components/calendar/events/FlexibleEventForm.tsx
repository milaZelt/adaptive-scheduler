"use client";

import React, { useState } from "react";
import type {
  CalendarEvent,
  FlexibleEventFormState,
  Priority,
  TimeEstimateMode,
} from "@/lib/calendar/types";
import { useAppState } from "../state/AppStateContext";
import Drawer from "./Drawer";
import Button from "@/components/ui/Button";
import fieldStyles from "./FormFields.module.css";

interface FlexibleEventFormProps {
  prefill?: CalendarEvent;
  onClose: () => void;
}

export default function FlexibleEventForm({ prefill, onClose }: FlexibleEventFormProps) {
  const { categories, showToast } = useAppState();
  const isEdit = !!prefill;

  const [title, setTitle] = useState(prefill?.title ?? "");
  const [estMode, setEstMode] = useState<TimeEstimateMode>(prefill?.timeEstimateMode ?? "single");
  const [singleVal, setSingleVal] = useState(
    prefill?.timeEstimateMode === "single" && prefill.timeEstimateValue != null
      ? String(prefill.timeEstimateValue)
      : "",
  );
  const [rangeMin, setRangeMin] = useState(
    prefill?.timeEstimateMode === "range" && prefill.timeEstimateMin != null
      ? String(prefill.timeEstimateMin)
      : "",
  );
  const [rangeMax, setRangeMax] = useState(
    prefill?.timeEstimateMode === "range" && prefill.timeEstimateMax != null
      ? String(prefill.timeEstimateMax)
      : "",
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

  const timeValid = estMode === "single" ? !!singleVal : !!rangeMin && !!rangeMax;
  const canSave = Boolean(title.trim() && timeValid && priority && categoryId);

  function handleSave() {
    const formState: FlexibleEventFormState = {
      mode: isEdit ? "edit" : "create",
      id: isEdit ? prefill!.id : null,
      type: "flexible",
      title: title.trim(),
      timeEstimateMode: estMode,
      timeEstimateValue: estMode === "single" ? Number(singleVal) : null,
      timeEstimateMin: estMode === "range" ? Number(rangeMin) : null,
      timeEstimateMax: estMode === "range" ? Number(rangeMax) : null,
      splitOk,
      sessionMin: splitOk && sessionMin ? Number(sessionMin) : null,
      sessionMax: splitOk && sessionMax ? Number(sessionMax) : null,
      description,
      priority,
      categoryId,
    };
    console.log("Flexible event form state:", formState);
    showToast("Saved — check console");
    onClose();
  }

  return (
    <Drawer
      title={isEdit ? "Edit Flexible Task" : "New Flexible Task"}
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
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className={fieldStyles.field}>
        <div className={fieldStyles.fieldLabel}>
          <span className={fieldStyles.req}>*</span>Time Estimate
        </div>
        <div className={fieldStyles.toggleTabs}>
          <button
            type="button"
            className={`${fieldStyles.toggleTab} ${estMode === "single" ? fieldStyles.active : ""}`}
            onClick={() => setEstMode("single")}
          >
            I know how long
          </button>
          <button
            type="button"
            className={`${fieldStyles.toggleTab} ${estMode === "range" ? fieldStyles.active : ""}`}
            onClick={() => setEstMode("range")}
          >
            Give me a range
          </button>
        </div>

        {estMode === "single" ? (
          <input
            className={fieldStyles.fieldInput}
            type="number"
            min={0.25}
            step={0.25}
            placeholder="Hours"
            value={singleVal}
            onChange={(e) => setSingleVal(e.target.value)}
          />
        ) : (
          <div className={fieldStyles.fieldRow}>
            <input
              className={fieldStyles.fieldInput}
              type="number"
              min={0.25}
              step={0.25}
              placeholder="Min hours"
              value={rangeMin}
              onChange={(e) => setRangeMin(e.target.value)}
            />
            <input
              className={fieldStyles.fieldInput}
              type="number"
              min={0.25}
              step={0.25}
              placeholder="Max hours"
              value={rangeMax}
              onChange={(e) => setRangeMax(e.target.value)}
            />
          </div>
        )}
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
            <div className={fieldStyles.fieldLabel}>Min Session (hrs)</div>
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
            <div className={fieldStyles.fieldLabel}>Max Session (hrs)</div>
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
