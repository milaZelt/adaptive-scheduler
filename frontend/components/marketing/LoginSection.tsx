"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./LoginSection.module.css";

export default function LoginSection() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <section id="login" className={styles.login}>
      <div className={styles.card}>
        <span className={styles.tag}>Welcome back!</span>
        <h2 className={styles.title}>Sign in to continue.</h2>
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className={styles.googleButton}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.42 3.58v2.98h3.91c2.29-2.11 3.53-5.22 3.53-8.8z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.91-2.98c-1.08.72-2.47 1.16-4.02 1.16-3.13 0-5.78-2.11-6.73-4.96H1.24v3.09C3.21 21.3 7.31 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.27 14.31c-.25-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.66H1.24C.45 8.24 0 10.07 0 12s.45 3.76 1.24 5.34l4.03-3.03z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.76 0 3.34.61 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.21 2.7 1.24 6.66l4.03 3.09C6.22 6.87 8.87 4.75 12 4.75z"
            />
          </svg>
          {loading ? "Redirecting…" : "Sign in with Google"}
        </button>
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </section>
  );
}
