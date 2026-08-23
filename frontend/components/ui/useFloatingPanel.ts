"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useEscapeKey } from "./useEscapeKey";

interface FloatingPanelOptions {
  anchorRect: DOMRect;
  onClose: () => void;
  align?: "left" | "right";
  /** Sets the panel's own CSS width. Leave it out to size to content
   *  instead - matchWidth overrides this option either way. */
  width?: number;
  /** Uses the anchor's width instead of `width` or content-sizing. Lines
   *  the panel up exactly under the field it opened from. */
  matchWidth?: boolean;
  gap?: number;
}

/**
 * Shared positioning, outside-click, and Escape-close logic for a floating
 * panel next to a trigger element. Popover, ContextMenu, and anything built
 * on them use this.
 * It opens below the anchor by default, right-aligned like a native
 * select, and flips to the other side if that has more room.
 * Size is measured after mount, so there's no flicker even though the
 * first position is just a placeholder.
 */
export function useFloatingPanel({
  anchorRect,
  onClose,
  align = "right",
  width,
  matchWidth = false,
  gap = 6,
}: FloatingPanelOptions) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: anchorRect.bottom + gap, left: anchorRect.left });

  useLayoutEffect(() => {
    const el = ref.current;
    const panelWidth = matchWidth ? anchorRect.width : (width ?? el?.offsetWidth ?? 0);
    const panelHeight = el?.offsetHeight ?? 0;

    const left = matchWidth
      ? anchorRect.left
      : align === "right"
        ? Math.max(10, anchorRect.right - panelWidth)
        : anchorRect.left;

    const spaceBelow = window.innerHeight - anchorRect.bottom - gap;
    const spaceAbove = anchorRect.top - gap;
    const top =
      panelHeight > spaceBelow && spaceAbove > spaceBelow
        ? Math.max(10, anchorRect.top - panelHeight - gap)
        : anchorRect.bottom + gap;

    setPosition({ top, left });
  }, [anchorRect, align, width, matchWidth, gap]);

  useEscapeKey(onClose);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    // Defer so the click that opened the panel doesn't immediately close it.
    const t = setTimeout(() => {
      document.addEventListener("click", onDocClick, true);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("click", onDocClick, true);
    };
  }, [onClose]);

  return {
    ref,
    style: {
      top: position.top,
      left: position.left,
      width: matchWidth ? anchorRect.width : width,
    },
  };
}
