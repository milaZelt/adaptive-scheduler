"use client";

import React, { useEffect, useRef } from "react";
import styles from "./ContextMenu.module.css";

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  anchorRect: DOMRect;
  items: ContextMenuItem[];
  onClose: () => void;
  align?: "left" | "right";
}

export default function ContextMenu({
  anchorRect,
  items,
  onClose,
  align = "right",
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    const t = setTimeout(() => {
      document.addEventListener("click", onDocClick, true);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("click", onDocClick, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const top = anchorRect.bottom + 6;
  const left = align === "right" ? Math.max(10, anchorRect.right - 150) : anchorRect.left;

  return (
    <div ref={ref} className={styles.menu} style={{ top, left }}>
      {items.map((item) => (
        <button
          key={item.label}
          className={item.danger ? styles.danger : ""}
          onClick={() => item.onClick()}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
