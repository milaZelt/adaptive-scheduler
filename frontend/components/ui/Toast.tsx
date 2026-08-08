"use client";

import React, { useEffect, useState } from "react";
import styles from "./Toast.module.css";

interface ToastProps {
  message: string;
}

export default function Toast({ message }: ToastProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(raf);
  }, [message]);

  return <div className={`${styles.toast} ${show ? styles.show : ""}`}>{message}</div>;
}
