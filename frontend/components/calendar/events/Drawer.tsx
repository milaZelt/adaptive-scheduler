"use client";

import React from "react";
import { useEscapeKey } from "@/components/ui/useEscapeKey";
import styles from "./Drawer.module.css";

interface DrawerProps {
  title: string;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}

export default function Drawer({ title, onClose, footer, children }: DrawerProps) {
  useEscapeKey(onClose);

  return (
    <>
      <div className={styles.overlay} onClick={onClose} role="presentation" />
      <div className={styles.panel} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <div className={styles.title}>{title}</div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        <div className={styles.footer}>{footer}</div>
      </div>
    </>
  );
}
