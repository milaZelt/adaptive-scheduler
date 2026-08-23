"use client";

import React from "react";
import { useFloatingPanel } from "./useFloatingPanel";
import styles from "./Popover.module.css";

interface PopoverProps {
  /** The element the popover should appear near. */
  anchorRect: DOMRect;
  /** Fixed width in px. */
  width?: number;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Uses position: fixed, so a scrolling parent can't clip it. A bigger app
 * might wrap this in a portal instead - skipped here to keep it simple.
 */
export default function Popover({ anchorRect, width = 230, onClose, children }: PopoverProps) {
  const { ref, style } = useFloatingPanel({ anchorRect, onClose, width, gap: 8 });

  return (
    <div
      ref={ref}
      className={styles.popover}
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
