"use client";

import React, { useRef, useState } from "react";
import ContextMenu from "./ContextMenu";
import styles from "./Select.module.css";

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}

/** A styled stand-in for the native <select>, since you can't style a
 *  native dropdown's open list across browsers. Renders a button that
 *  opens the same floating ContextMenu used elsewhere, sized to match. */
export default function Select({ value, onChange, options, placeholder = "Select…" }: SelectProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const selected = options.find((o) => o.value === value);
  const open = anchor !== null;

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        className={`${styles.select} ${open ? styles.open : ""}`}
        onClick={() => setAnchor(btnRef.current?.getBoundingClientRect() ?? null)}
      >
        {selected?.color && <span className={styles.swatch} style={{ background: selected.color }} />}
        <span className={`${styles.label} ${selected ? "" : styles.placeholder}`}>
          {selected?.label ?? placeholder}
        </span>
        <span className={`${styles.arrow} ${open ? styles.open : ""}`} />
      </button>
      {anchor && (
        <ContextMenu
          anchorRect={anchor}
          align="left"
          matchWidth
          onClose={() => setAnchor(null)}
          items={options.map((o) => ({
            label: o.label,
            color: o.color,
            onClick: () => {
              onChange(o.value);
              setAnchor(null);
            },
          }))}
        />
      )}
    </>
  );
}
