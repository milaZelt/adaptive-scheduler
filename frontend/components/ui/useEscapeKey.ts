"use client";

import { useEffect } from "react";

/** Calls onClose on Escape. Shared by Modal, Drawer, and useFloatingPanel -
 *  every dismissible overlay in this app closes on Escape the same way. */
export function useEscapeKey(onClose: () => void): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
}
