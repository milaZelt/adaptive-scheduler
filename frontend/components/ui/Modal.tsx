"use client";

import React from "react";
import { useEscapeKey } from "./useEscapeKey";
import styles from "./Modal.module.css";

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
}

export default function Modal({ onClose, children }: ModalProps) {
  useEscapeKey(onClose);

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick} role="presentation">
      <div className={styles.box} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}
