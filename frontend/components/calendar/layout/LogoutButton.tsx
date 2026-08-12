"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAppState } from "../state/AppStateContext";
import styles from "./LogoutButton.module.css";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { reportSystemError } = useAppState();

  const handleLogout = async () => {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setLoading(false);
      reportSystemError("Couldn't log out. Please try again.");
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={styles.logout}
    >
      {loading ? "Logging out…" : "Log Out"}
    </button>
  );
}
