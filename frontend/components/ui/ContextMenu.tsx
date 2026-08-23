"use client";

import React from "react";
import { useFloatingPanel } from "./useFloatingPanel";
import styles from "./ContextMenu.module.css";

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  /** Small color dot before the label - used by Select for category-colored options. */
  color?: string;
  /** Muted second line under the label - used by the Create+ menu's explanatory text. */
  subtitle?: string;
}

interface ContextMenuProps {
  anchorRect: DOMRect;
  items: ContextMenuItem[];
  onClose: () => void;
  align?: "left" | "right";
  /** Sizes the menu to the anchor's own width instead of content-width.
   *  Select uses this so the open panel lines up with the closed field. */
  matchWidth?: boolean;
}

export default function ContextMenu({
  anchorRect,
  items,
  onClose,
  align = "right",
  matchWidth = false,
}: ContextMenuProps) {
  // No fixed width here - the menu sizes to its own content. So the
  // shared hook has to measure it after mount, for both alignment and
  // the flip check.
  const { ref, style } = useFloatingPanel({ anchorRect, onClose, align, matchWidth });

  return (
    <div ref={ref} className={styles.menu} style={style}>
      {items.map((item, i) => (
        <button
          key={`${i}-${item.label}`}
          className={item.danger ? styles.danger : ""}
          onClick={() => item.onClick()}
        >
          {item.color && <span className={styles.itemColor} style={{ background: item.color }} />}
          <span className={styles.itemLabel}>
            {item.label}
            {item.subtitle && <span className={styles.itemSubtitle}>{item.subtitle}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
