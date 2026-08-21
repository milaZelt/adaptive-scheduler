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
 * Positioned relative to the viewport (position: fixed), so it isn't clipped
 * by scrollable ancestors. For a larger app, wrap this in a portal
 * (createPortal to document.body) - omitted here to keep the primitive simple.
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
