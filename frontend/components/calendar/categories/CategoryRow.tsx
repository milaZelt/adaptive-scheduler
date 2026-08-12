"use client";

import React, { useRef, useState } from "react";
import type { Category } from "@/lib/calendar/types";
import { useAppState } from "../state/AppStateContext";
import Popover from "@/components/ui/Popover";
import ContextMenu, { type ContextMenuItem } from "@/components/ui/ContextMenu";
import Button from "@/components/ui/Button";
import ColorPicker from "./ColorPicker";
import styles from "./CategoryRow.module.css";
import colorPickerStyles from "./ColorPicker.module.css";

interface CategoryRowProps {
  category: Category;
}

export default function CategoryRow({ category }: CategoryRowProps) {
  const {
    toggleCategory,
    renameCategory,
    recolorCategory,
    deleteCategory,
    showToast,
    showConfirmDialog,
  } = useAppState();

  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const dotRef = useRef<HTMLButtonElement>(null);

  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const [colorAnchor, setColorAnchor] = useState<DOMRect | null>(null);
  const [renameAnchor, setRenameAnchor] = useState<DOMRect | null>(null);
  const [renameValue, setRenameValue] = useState(category.name);
  const [pendingColor, setPendingColor] = useState(category.color);

  function handleDeleteClick() {
    setMenuAnchor(null);
    showConfirmDialog({
      title: `Delete "${category.name}"?`,
      message: `This will permanently remove the "${category.name}" calendar and any events assigned to it. This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: () => {
        deleteCategory(category.id);
        showToast(`"${category.name}" deleted`);
      },
    });
  }

  // The import category is found by its is_google_import flag (see
  // resolveImportCategoryId), not by name, so renaming it wouldn't actually
  // break the next import - this is blocked anyway so the name stays an
  // honest label for what the category actually contains.
  const menuItems: ContextMenuItem[] = [
    ...(category.isGoogleImport
      ? []
      : [
          {
            label: "Rename",
            onClick: () => {
              setMenuAnchor(null);
              setRenameValue(category.name);
              setRenameAnchor(menuBtnRef.current?.getBoundingClientRect() ?? null);
            },
          },
        ]),
    {
      label: "Change Color",
      onClick: () => {
        setMenuAnchor(null);
        setPendingColor(category.color);
        setColorAnchor(dotRef.current?.getBoundingClientRect() ?? null);
      },
    },
    { label: "Delete", danger: true, onClick: handleDeleteClick },
  ];

  return (
    <div className={`${styles.row} ${category.checked ? "" : styles.off}`}>
      <div
        className={`${styles.check} ${category.checked ? styles.checked : ""}`}
        role="checkbox"
        aria-checked={category.checked}
        tabIndex={0}
        onClick={() => toggleCategory(category.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") toggleCategory(category.id);
        }}
      />
      <button
        ref={dotRef}
        className={styles.dot}
        style={{ background: category.color }}
        aria-label={`Change color for ${category.name}`}
        onClick={() => {
          setPendingColor(category.color);
          setColorAnchor(dotRef.current?.getBoundingClientRect() ?? null);
        }}
      />
      <button className={styles.name} onClick={() => toggleCategory(category.id)}>
        {category.name}
      </button>
      <button
        ref={menuBtnRef}
        className={`${styles.menuBtn} sans`}
        aria-label={`Options for ${category.name}`}
        onClick={() => setMenuAnchor(menuBtnRef.current?.getBoundingClientRect() ?? null)}
      >
        ⋮
      </button>

      {menuAnchor && (
        <ContextMenu anchorRect={menuAnchor} onClose={() => setMenuAnchor(null)} items={menuItems} />
      )}

      {renameAnchor && (
        <Popover anchorRect={renameAnchor} width={220} onClose={() => setRenameAnchor(null)}>
          <label className={colorPickerStyles.fieldLabel}>Rename Calendar</label>
          <input
            className={colorPickerStyles.nameInput}
            type="text"
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
          />
          <div className={colorPickerStyles.actions}>
            <Button variant="plain" size="mini" onClick={() => setRenameAnchor(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="mini"
              onClick={() => {
                const trimmedName = renameValue.trim();
                if (trimmedName) renameCategory(category.id, trimmedName);
                setRenameAnchor(null);
              }}
            >
              Save
            </Button>
          </div>
        </Popover>
      )}

      {colorAnchor && (
        <Popover anchorRect={colorAnchor} width={220} onClose={() => setColorAnchor(null)}>
          <label className={colorPickerStyles.fieldLabel}>Change Color</label>
          <ColorPicker initialColor={category.color} onChange={setPendingColor} />
          <div className={colorPickerStyles.actions}>
            <Button variant="plain" size="mini" onClick={() => setColorAnchor(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="mini"
              onClick={() => {
                recolorCategory(category.id, pendingColor);
                setColorAnchor(null);
              }}
            >
              Save
            </Button>
          </div>
        </Popover>
      )}
    </div>
  );
}
