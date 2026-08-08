"use client";

import React, { useEffect, useRef } from "react";
import styles from "./Popover.module.css";

interface PopoverProps {
  /** The element the popover should appear near. */
  anchorRect: DOMRect;
  /** Optional fixed width in px. */
  width?: number;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Positioned relative to the viewport (position: fixed), so it isn't clipped
 * by scrollable ancestors. For a larger app, wrap this in a portal
 * (createPortal to document.body) — omitted here to keep the primitive simple.
 */
export default function Popover({ anchorRect, width = 230, onClose, children }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    // Defer so the click that opened the popover doesn't immediately close it.
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

  const top = anchorRect.bottom + 8;
  const left = Math.max(10, anchorRect.right - width);

  return (
    <div
      ref={ref}
      className={styles.popover}
      style={{ top, left, width }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
