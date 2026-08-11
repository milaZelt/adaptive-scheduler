"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const ref = useRef<HTMLDivElement>(null);

  const left = matchWidth
    ? anchorRect.left
    : align === "right"
      ? Math.max(10, anchorRect.right - 150)
      : anchorRect.left;
  const width = matchWidth ? anchorRect.width : undefined;

  // Below the anchor by default, matching a native <select>'s usual open
  // direction - but forms can put a field (e.g. the always-last "Calendar"
  // select) anywhere in a scrollable drawer, including right at the bottom
  // of the viewport, so this has to be able to flip upward like a native
  // dropdown would. Measured post-mount via useLayoutEffect (fires before
  // paint, so no visible flicker) since the menu's real height depends on
  // its item count, which isn't known until it's actually rendered.
  const [top, setTop] = useState(anchorRect.bottom + 6);
  useLayoutEffect(() => {
    const menuHeight = ref.current?.offsetHeight ?? 0;
    const spaceBelow = window.innerHeight - anchorRect.bottom - 6;
    const spaceAbove = anchorRect.top - 6;
    setTop(
      menuHeight > spaceBelow && spaceAbove > spaceBelow
        ? Math.max(10, anchorRect.top - menuHeight - 6)
        : anchorRect.bottom + 6,
    );
  }, [anchorRect]);

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

  return (
    <div ref={ref} className={styles.menu} style={{ top, left, width }}>
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
