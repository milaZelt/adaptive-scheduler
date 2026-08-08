"use client";

import React, { useRef, useState } from "react";
import { useAppState } from "../state/AppStateContext";
import { PRESET_PALETTE } from "@/lib/calendar/constants";
import Popover from "@/components/ui/Popover";
import Button from "@/components/ui/Button";
import CategoryRow from "./CategoryRow";
import styles from "../layout/Sidebar.module.css";
import colorPickerStyles from "./ColorPicker.module.css";
import ColorPicker from "./ColorPicker";

export default function CategorySidebar() {
  const { categories, addCategory, showToast } = useAppState();

  const addBtnRef = useRef<HTMLButtonElement>(null);
  const [addAnchor, setAddAnchor] = useState<DOMRect | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_PALETTE[0]);

  function resetAddForm() {
    setName("");
    setColor(PRESET_PALETTE[0]);
  }

  function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    addCategory(trimmed, color);
    showToast(`"${trimmed}" calendar added`);
    resetAddForm();
    setAddAnchor(null);
  }

  return (
    <div>
      <div className={styles.sectionHead}>
        <div className={styles.sectionLabel}>Calendars</div>
        <button
          ref={addBtnRef}
          className={styles.iconBtn}
          aria-label="Add calendar"
          onClick={() => setAddAnchor(addBtnRef.current?.getBoundingClientRect() ?? null)}
        >
          +
        </button>
      </div>

      <div className={styles.categoryList}>
        {categories.map((c) => (
          <CategoryRow key={c.id} category={c} />
        ))}
      </div>

      {addAnchor && (
        <Popover
          anchorRect={addAnchor}
          width={230}
          onClose={() => {
            setAddAnchor(null);
            resetAddForm();
          }}
        >
          <label className={colorPickerStyles.fieldLabel}>Calendar Name</label>
          <input
            className={colorPickerStyles.nameInput}
            type="text"
            autoFocus
            placeholder="e.g. Gym"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className={colorPickerStyles.fieldLabel}>Color</label>
          <ColorPicker initialColor={color} onChange={setColor} />
          <div className={colorPickerStyles.actions}>
            <Button
              variant="plain"
              size="mini"
              onClick={() => {
                setAddAnchor(null);
                resetAddForm();
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" size="mini" disabled={!name.trim()} onClick={handleAdd}>
              Add
            </Button>
          </div>
        </Popover>
      )}
    </div>
  );
}
