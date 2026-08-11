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
  /** Size the menu to the anchor's own width instead of content-width - used by
   *  Select so its open panel lines up with the closed field it opened from. */
  matchWidth?: boolean;
}

export default function ContextMenu({
  anchorRect,
  items,
  onClose,
  align = "right",
  matchWidth = false,
}: ContextMenuProps) {
  // No explicit `width` - the menu sizes to its content (CSS min-width),
  // unlike Popover's fixed-width forms, so the shared hook measures it
  // post-mount for both the right-alignment math and the flip check.
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
