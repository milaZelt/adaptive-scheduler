"use client";

import React from "react";
import styles from "./Button.module.css";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "plain" | "danger";
  size?: "normal" | "mini";
}

export default function Button({
  variant = "primary",
  size = "normal",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const classes = [styles.btn, styles[variant], size === "mini" ? styles.mini : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
