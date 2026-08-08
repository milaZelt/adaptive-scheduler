"use client";

import React, { useState } from "react";
import { PRESET_PALETTE } from "@/lib/calendar/constants";
import { isValidHex } from "@/lib/calendar/colorUtils";
import styles from "./ColorPicker.module.css";

interface ColorPickerProps {
  initialColor: string;
  onChange: (color: string) => void;
}

/** Swatch grid + custom hex input. Purely controlled — parent owns the selected value. */
export default function ColorPicker({ initialColor, onChange }: ColorPickerProps) {
  const [selected, setSelected] = useState(initialColor);
  const [hexValue, setHexValue] = useState(initialColor);

  function pickSwatch(color: string) {
    setSelected(color);
    setHexValue(color);
    onChange(color);
  }

  function onHexInput(value: string) {
    setHexValue(value);
    if (isValidHex(value)) {
      setSelected(value);
      onChange(value);
    }
  }

  return (
    <>
      <div className={styles.swatchGrid}>
        {PRESET_PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Choose color ${color}`}
            className={`${styles.swatch} ${
              color.toUpperCase() === selected.toUpperCase() ? styles.selected : ""
            }`}
            style={{ background: color }}
            onClick={() => pickSwatch(color)}
          />
        ))}
      </div>
      <div className={styles.hexRow}>
        <div className={styles.hexPreview} style={{ background: selected }} />
        <input
          className={styles.hexInput}
          type="text"
          placeholder="#custom hex"
          value={hexValue}
          onChange={(e) => onHexInput(e.target.value)}
        />
      </div>
    </>
  );
}
